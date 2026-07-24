"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppointmentStatus,
  AuditActorType,
  CandidateStatus,
  CandidateSubmissionStatus,
  GroupTimeSlot,
  InterviewerStatus,
  Prisma
} from "@prisma/client";
import { buildAppointmentLockRows } from "@/lib/business/appointment-lock";
import {
  deriveCandidateStatus,
  isSchedulingIntegrityConflict,
  SchedulingConflictError,
  SchedulingValidationError
} from "@/lib/business/scheduling-integrity";
import {
  assertContinuousSlots,
  assertSlotsSelectableForAppointment,
  assertSlotsSelectable,
  uniqueSlotIds
} from "@/lib/business/slot-selection";
import { requireAdmin } from "@/lib/auth/session";
import { addMinutes } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import {
  lockStateResources,
  serializableTransactionOptions,
  withSerializableRetry
} from "@/lib/db/transaction";
import { buildAppointmentEmailContext } from "@/lib/mail/appointment-email-context";
import { getAppointmentConfirmedEmailTemplate } from "@/lib/mail/email-template-store";
import { groupSchedulingRoles, requireGroupPermission } from "@/lib/permissions/admin";
import { formValue, formValues } from "@/lib/validation/common";
import { scheduleAppointmentSchema } from "@/lib/validation/appointment";
import {
  createCandidateEmailDelivery,
  deliverPersistedCandidateEmailDelivery
} from "@/server/services/candidate-email";
import { notifyOwnerAboutAppointment } from "@/server/services/owner-notification-email";

function redirectWithScheduleMailStatus(
  groupId: string,
  candidateId: string,
  params: { mail: "sent" | "error"; dryRun?: boolean; batchId?: string }
): never {
  const url = new URL(`http://local/admin/groups/${groupId}/candidates/${candidateId}`);
  url.searchParams.set("mail", params.mail);
  url.searchParams.set("mailCount", params.mail === "sent" ? "1" : "0");
  if (params.mail === "error") {
    url.searchParams.set("mailFailed", "1");
  }
  if (params.dryRun) {
    url.searchParams.set("mailDryRun", "1");
  }
  if (params.batchId) {
    url.searchParams.set("mailBatch", params.batchId);
  }
  redirect(`${url.pathname}${url.search}`);
}

function redirectWithAppointmentStatus(
  groupId: string,
  candidateId: string,
  appointment: "scheduled" | "rescheduled" | "invalid" | "conflict"
): never {
  const url = new URL(`http://local/admin/groups/${groupId}/candidates/${candidateId}`);
  url.searchParams.set("appointment", appointment);
  redirect(`${url.pathname}${url.search}`);
}

function uniqueInterviewerIds(interviewerIds: string[]) {
  return [...new Set(interviewerIds.map((interviewerId) => interviewerId.trim()).filter(Boolean))];
}

async function areInterviewersSelectable(
  tx: Prisma.TransactionClient,
  {
    projectId,
    interviewerIds
  }: {
    projectId: string | null;
    interviewerIds: string[];
  }
) {
  if (interviewerIds.length === 0) {
    return true;
  }
  if (!projectId) {
    return false;
  }

  const interviewers = await tx.interviewer.findMany({
    where: {
      id: { in: interviewerIds },
      projectId,
      status: InterviewerStatus.ACTIVE
    },
    select: { id: true }
  });
  return interviewers.length === interviewerIds.length;
}

async function hasInterviewerScheduleConflict(
  tx: Prisma.TransactionClient,
  {
    interviewerIds,
    startAt,
    endAt,
    excludeAppointmentId
  }: {
    interviewerIds: string[];
    startAt: Date;
    endAt: Date;
    excludeAppointmentId?: string;
  }
) {
  if (interviewerIds.length === 0) {
    return false;
  }

  const conflict = await tx.appointmentInterviewer.findFirst({
    where: {
      interviewerId: { in: interviewerIds },
      appointment: {
        status: AppointmentStatus.SCHEDULED,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {})
      }
    },
    select: { id: true }
  });

  return Boolean(conflict);
}

function deriveAppointmentInterval(
  slots: Pick<GroupTimeSlot, "startAt" | "endAt">[],
  interviewDurationMinutes: number
) {
  const sortedSlots = [...slots].sort(
    (left, right) => left.startAt.getTime() - right.startAt.getTime()
  );
  const firstSlot = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];

  if (!firstSlot || !lastSlot) {
    throw new SchedulingValidationError();
  }

  const endAt = addMinutes(firstSlot.startAt, interviewDurationMinutes);
  if (endAt.getTime() > lastSlot.endAt.getTime()) {
    throw new SchedulingValidationError("所选连续开放时间不足以覆盖面试时长。");
  }

  return {
    startAt: firstSlot.startAt,
    endAt
  };
}

function assertScheduleSlots(
  slots: Array<
    Pick<GroupTimeSlot, "id" | "startAt" | "endAt" | "status"> & {
      activeLock?: { id: string; appointmentId?: string | null } | null;
    }
  >,
  slotIds: string[],
  existingAppointmentId?: string
) {
  try {
    if (existingAppointmentId) {
      assertSlotsSelectableForAppointment(
        slots.map((slot) => ({
          ...slot,
          activeLock: slot.activeLock
            ? {
                id: slot.activeLock.id,
                appointmentId: slot.activeLock.appointmentId ?? null
              }
            : null
        })),
        slotIds,
        existingAppointmentId
      );
    } else {
      assertSlotsSelectable(
        slots.map((slot) => ({
          ...slot,
          activeLock: slot.activeLock ? { id: slot.activeLock.id } : null
        })),
        slotIds
      );
    }
    assertContinuousSlots(slots);
  } catch (error) {
    if (error instanceof SchedulingValidationError) {
      throw error;
    }
    throw new SchedulingValidationError(
      error instanceof Error ? error.message : "所选开放时间已不可用。"
    );
  }
}

function transactionResources({
  candidateId,
  slotIds,
  interviewerIds,
  appointmentId
}: {
  candidateId: string;
  slotIds: string[];
  interviewerIds: string[];
  appointmentId?: string;
}) {
  return [
    `candidate:${candidateId}`,
    ...(appointmentId ? [`appointment:${appointmentId}`] : []),
    ...slotIds.map((slotId) => `slot:${slotId}`),
    ...interviewerIds.map((interviewerId) => `interviewer:${interviewerId}`)
  ];
}

type CancelledAppointmentResult = {
  appointment: {
    id: string;
    candidateId: string;
    startAt: Date;
    endAt: Date;
    meetingLocation: string | null;
    candidateVisibleMessage: string | null;
  };
  group: { id: string; name: string; groupCode: string; timezone: string };
  candidate: { id: string; name: string; email: string };
};

type AppointmentCandidateEmailDraft = {
  batchId: string;
  templateKey: string;
  subject: string;
  bodyTemplate: string;
  ccEmails?: string[];
};

type PersistedAppointmentCandidateEmail = Pick<AppointmentCandidateEmailDraft, "batchId"> & {
  deliveryId: string;
};

async function createAppointmentCandidateEmailDraft(input: {
  emailSubject?: string;
  emailBody?: string;
  ccEmails?: string[];
}): Promise<AppointmentCandidateEmailDraft> {
  const appointmentEmailTemplate = await getAppointmentConfirmedEmailTemplate();
  return {
    batchId: randomUUID(),
    templateKey: appointmentEmailTemplate.key,
    subject: input.emailSubject ?? appointmentEmailTemplate.subject,
    bodyTemplate: input.emailBody ?? appointmentEmailTemplate.body,
    ccEmails: input.ccEmails
  };
}

async function sendPersistedAppointmentCandidateEmailAndRedirect({
  adminId,
  groupId,
  candidate,
  appointment,
  delivery
}: {
  adminId: string;
  groupId: string;
  candidate: { id: string; name: string; email: string };
  appointment: {
    id: string;
  };
  delivery: PersistedAppointmentCandidateEmail;
}) {
  const result = await deliverPersistedCandidateEmailDelivery(delivery.deliveryId);

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: adminId,
      groupId,
      action: "admin.send_appointment_email",
      entityType: "CandidateEmailDelivery",
      entityId: result.deliveryId,
      afterData: {
        appointmentId: appointment.id,
        candidateId: candidate.id,
        deliveryId: result.deliveryId,
        status: result.status,
        emailId: result.emailId,
        error: result.error,
        batchId: delivery.batchId
      }
    }
  });

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidate.id}`);
  if (result.status === "failure") {
    redirectWithScheduleMailStatus(groupId, candidate.id, {
      mail: "error",
      batchId: delivery.batchId
    });
  }
  redirectWithScheduleMailStatus(groupId, candidate.id, {
    mail: "sent",
    dryRun: result.status === "preview",
    batchId: delivery.batchId
  });
}

type ScheduleTransactionInput = {
  candidateVisibleMessage?: string;
  meetingLocation?: string;
  internalNote?: string;
};

async function createScheduledAppointment({
  adminId,
  adminEmail,
  groupId,
  candidateId,
  slotIds,
  interviewerIds,
  input,
  appointmentEmail
}: {
  adminId: string;
  adminEmail: string;
  groupId: string;
  candidateId: string;
  slotIds: string[];
  interviewerIds: string[];
  input: ScheduleTransactionInput;
  appointmentEmail?: AppointmentCandidateEmailDraft | null;
}) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockStateResources(tx, transactionResources({ candidateId, slotIds, interviewerIds }));

      const candidate = await tx.candidate.findFirst({
        where: { id: candidateId, groupId },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              groupCode: true,
              timezone: true,
              projectId: true,
              roundId: true,
              interviewDurationMinutes: true
            }
          },
          activeSubmission: {
            include: {
              slots: {
                select: { slotId: true }
              }
            }
          }
        }
      });

      if (!candidate?.activeSubmission) {
        throw new SchedulingValidationError("候选人没有当前有效的可用时间提交。");
      }
      if (candidate.status === CandidateStatus.SCHEDULED) {
        throw new SchedulingConflictError("候选人已有正式面试安排，请刷新后重试。");
      }
      if (candidate.status !== CandidateStatus.SUBMITTED) {
        throw new SchedulingValidationError("候选人当前有待处理的状态，暂不能安排面试。");
      }
      if (
        !(await areInterviewersSelectable(tx, {
          projectId: candidate.group.projectId,
          interviewerIds
        }))
      ) {
        throw new SchedulingValidationError("所选面试官不存在、已停用或不属于当前项目。");
      }

      const activeSubmissionSlotIds = new Set(
        candidate.activeSubmission.slots.map((slot) => slot.slotId)
      );
      if (slotIds.some((slotId) => !activeSubmissionSlotIds.has(slotId))) {
        throw new SchedulingValidationError("只能安排候选人当前有效提交中的可用时间。");
      }

      const slots = await tx.groupTimeSlot.findMany({
        where: {
          groupId,
          id: { in: slotIds }
        },
        include: {
          activeLock: {
            select: { id: true, appointmentId: true }
          }
        }
      });
      assertScheduleSlots(slots, slotIds);
      const interval = deriveAppointmentInterval(slots, candidate.group.interviewDurationMinutes);

      const existingScheduledAppointment = await tx.appointment.findFirst({
        where: {
          candidateId,
          status: AppointmentStatus.SCHEDULED
        },
        select: { id: true }
      });
      if (existingScheduledAppointment) {
        throw new SchedulingConflictError("候选人已有正式面试安排，请刷新后重试。");
      }
      if (
        await hasInterviewerScheduleConflict(tx, {
          interviewerIds,
          startAt: interval.startAt,
          endAt: interval.endAt
        })
      ) {
        throw new SchedulingConflictError(
          "所选面试官在该时间已有面试安排，请调整时间或更换面试官。"
        );
      }

      const appointment = await tx.appointment.create({
        data: {
          groupId,
          roundId: candidate.group.roundId,
          candidateId,
          startAt: interval.startAt,
          endAt: interval.endAt,
          status: AppointmentStatus.SCHEDULED,
          candidateVisibleMessage: input.candidateVisibleMessage || null,
          meetingLocation: input.meetingLocation || null,
          internalNote: input.internalNote || null,
          scheduledByAdminId: adminId,
          slots: {
            create: slotIds.map((slotId) => ({ slotId }))
          }
        }
      });

      if (interviewerIds.length > 0) {
        await tx.appointmentInterviewer.createMany({
          data: interviewerIds.map((interviewerId) => ({
            appointmentId: appointment.id,
            interviewerId
          }))
        });
      }

      await tx.timeSlotLock.createMany({
        data: buildAppointmentLockRows({
          groupId,
          appointmentId: appointment.id,
          slotIds,
          candidateName: candidate.name,
          lockedByAdminId: adminId
        })
      });

      const candidateUpdate = await tx.candidate.updateMany({
        where: {
          id: candidate.id,
          groupId,
          status: CandidateStatus.SUBMITTED,
          activeSubmissionId: candidate.activeSubmission.id
        },
        data: { status: CandidateStatus.SCHEDULED }
      });
      if (candidateUpdate.count !== 1) {
        throw new SchedulingConflictError("候选人状态已变化，请刷新后重试。");
      }

      const candidateEmailDelivery = appointmentEmail
        ? await createCandidateEmailDelivery(
            {
              adminId,
              group: candidate.group,
              candidate: {
                id: candidate.id,
                name: candidate.name,
                email: candidate.email
              },
              batchId: appointmentEmail.batchId,
              templateKey: appointmentEmail.templateKey,
              subject: appointmentEmail.subject,
              bodyTemplate: appointmentEmail.bodyTemplate,
              ccEmails: appointmentEmail.ccEmails,
              templateValues: buildAppointmentEmailContext(
                {
                  startAt: appointment.startAt,
                  endAt: appointment.endAt,
                  meetingLocation: appointment.meetingLocation,
                  candidateVisibleMessage: appointment.candidateVisibleMessage
                },
                candidate.group.timezone
              )
            },
            tx
          )
        : null;

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: adminId,
          groupId,
          action: "admin.schedule_appointment",
          entityType: "Appointment",
          entityId: appointment.id,
          afterData: {
            slotIds,
            interviewerIds,
            candidateEmailDeliveryId: candidateEmailDelivery?.id ?? null
          }
        }
      });

      await notifyOwnerAboutAppointment(
        {
          group: candidate.group,
          candidate: {
            id: candidate.id,
            name: candidate.name,
            email: candidate.email
          },
          appointmentId: appointment.id,
          startAt: appointment.startAt,
          endAt: appointment.endAt,
          meetingLocation: appointment.meetingLocation,
          candidateVisibleMessage: appointment.candidateVisibleMessage,
          scheduledByEmail: adminEmail
        },
        tx
      );

      return {
        appointment,
        group: candidate.group,
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email
        },
        candidateEmail: candidateEmailDelivery
          ? {
              deliveryId: candidateEmailDelivery.id,
              batchId: appointmentEmail!.batchId
            }
          : null
      };
    }, serializableTransactionOptions)
  );
}

async function rescheduleScheduledAppointment({
  adminId,
  adminEmail,
  groupId,
  candidateId,
  appointmentId,
  slotIds,
  interviewerIds,
  input,
  appointmentEmail
}: {
  adminId: string;
  adminEmail: string;
  groupId: string;
  candidateId: string;
  appointmentId: string;
  slotIds: string[];
  interviewerIds: string[];
  input: ScheduleTransactionInput;
  appointmentEmail?: AppointmentCandidateEmailDraft | null;
}) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockStateResources(
        tx,
        transactionResources({ candidateId, appointmentId, slotIds, interviewerIds })
      );

      const candidate = await tx.candidate.findFirst({
        where: { id: candidateId, groupId },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              groupCode: true,
              timezone: true,
              projectId: true,
              roundId: true,
              interviewDurationMinutes: true
            }
          },
          activeSubmission: {
            include: {
              slots: {
                select: { slotId: true }
              }
            }
          }
        }
      });
      if (!candidate?.activeSubmission) {
        throw new SchedulingValidationError("候选人没有当前有效的可用时间提交。");
      }
      if (
        !(await areInterviewersSelectable(tx, {
          projectId: candidate.group.projectId,
          interviewerIds
        }))
      ) {
        throw new SchedulingValidationError("所选面试官不存在、已停用或不属于当前项目。");
      }

      const activeSubmissionSlotIds = new Set(
        candidate.activeSubmission.slots.map((slot) => slot.slotId)
      );
      if (slotIds.some((slotId) => !activeSubmissionSlotIds.has(slotId))) {
        throw new SchedulingValidationError("改约只能使用候选人当前有效提交中的可用时间。");
      }

      const existingAppointment = await tx.appointment.findFirst({
        where: {
          id: appointmentId,
          groupId,
          candidateId,
          status: AppointmentStatus.SCHEDULED
        },
        include: {
          slots: {
            select: { slotId: true }
          },
          interviewers: {
            select: { interviewerId: true }
          }
        }
      });
      if (!existingAppointment) {
        throw new SchedulingConflictError("面试安排已被取消或调整，请刷新后重试。");
      }

      const slots = await tx.groupTimeSlot.findMany({
        where: {
          groupId,
          id: { in: slotIds }
        },
        include: {
          activeLock: {
            select: { id: true, appointmentId: true }
          }
        }
      });
      assertScheduleSlots(slots, slotIds, existingAppointment.id);
      const interval = deriveAppointmentInterval(slots, candidate.group.interviewDurationMinutes);

      if (
        await hasInterviewerScheduleConflict(tx, {
          interviewerIds,
          startAt: interval.startAt,
          endAt: interval.endAt,
          excludeAppointmentId: existingAppointment.id
        })
      ) {
        throw new SchedulingConflictError(
          "所选面试官在该时间已有面试安排，请调整时间或更换面试官。"
        );
      }

      const previousSlotIds = existingAppointment.slots.map((slot) => slot.slotId);
      const previousInterviewerIds = existingAppointment.interviewers.map(
        (interviewer) => interviewer.interviewerId
      );
      const releasedAt = new Date();

      // Remove old interviewer links before moving the appointment interval. The
      // database trigger then validates exactly the new interviewer set below.
      await tx.appointmentInterviewer.deleteMany({
        where: { appointmentId: existingAppointment.id }
      });

      const appointmentUpdate = await tx.appointment.updateMany({
        where: {
          id: existingAppointment.id,
          groupId,
          candidateId,
          status: AppointmentStatus.SCHEDULED
        },
        data: {
          startAt: interval.startAt,
          endAt: interval.endAt,
          roundId: candidate.group.roundId,
          candidateVisibleMessage: input.candidateVisibleMessage || null,
          meetingLocation: input.meetingLocation || null,
          internalNote: input.internalNote || null,
          scheduledByAdminId: adminId,
          cancelledByAdminId: null,
          cancelledAt: null
        }
      });
      if (appointmentUpdate.count !== 1) {
        throw new SchedulingConflictError("面试安排已被其他操作变更，请刷新后重试。");
      }

      await tx.appointmentSlot.deleteMany({
        where: { appointmentId: existingAppointment.id }
      });
      await tx.appointmentSlot.createMany({
        data: slotIds.map((slotId) => ({
          appointmentId: existingAppointment.id,
          slotId
        }))
      });

      if (interviewerIds.length > 0) {
        await tx.appointmentInterviewer.createMany({
          data: interviewerIds.map((interviewerId) => ({
            appointmentId: existingAppointment.id,
            interviewerId
          }))
        });
      }

      await tx.timeSlotLock.updateMany({
        where: {
          appointmentId: existingAppointment.id,
          releasedAt: null
        },
        data: {
          activeSlotId: null,
          releasedAt
        }
      });
      await tx.timeSlotLock.createMany({
        data: buildAppointmentLockRows({
          groupId,
          appointmentId: existingAppointment.id,
          slotIds,
          candidateName: candidate.name,
          lockedByAdminId: adminId
        })
      });

      const candidateUpdate = await tx.candidate.updateMany({
        where: { id: candidate.id, groupId },
        data: { status: CandidateStatus.SCHEDULED }
      });
      if (candidateUpdate.count !== 1) {
        throw new SchedulingConflictError("候选人状态已被其他操作变更，请刷新后重试。");
      }

      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id: existingAppointment.id }
      });

      const candidateEmailDelivery = appointmentEmail
        ? await createCandidateEmailDelivery(
            {
              adminId,
              group: candidate.group,
              candidate: {
                id: candidate.id,
                name: candidate.name,
                email: candidate.email
              },
              batchId: appointmentEmail.batchId,
              templateKey: appointmentEmail.templateKey,
              subject: appointmentEmail.subject,
              bodyTemplate: appointmentEmail.bodyTemplate,
              ccEmails: appointmentEmail.ccEmails,
              templateValues: buildAppointmentEmailContext(
                {
                  startAt: appointment.startAt,
                  endAt: appointment.endAt,
                  meetingLocation: appointment.meetingLocation,
                  candidateVisibleMessage: appointment.candidateVisibleMessage
                },
                candidate.group.timezone
              )
            },
            tx
          )
        : null;

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: adminId,
          groupId,
          action: "admin.reschedule_appointment",
          entityType: "Appointment",
          entityId: appointment.id,
          beforeData: {
            slotIds: previousSlotIds,
            interviewerIds: previousInterviewerIds,
            startAt: existingAppointment.startAt,
            endAt: existingAppointment.endAt
          },
          afterData: {
            slotIds,
            interviewerIds,
            startAt: appointment.startAt,
            endAt: appointment.endAt,
            candidateEmailDeliveryId: candidateEmailDelivery?.id ?? null
          }
        }
      });

      await notifyOwnerAboutAppointment(
        {
          kind: "rescheduled",
          group: candidate.group,
          candidate: {
            id: candidate.id,
            name: candidate.name,
            email: candidate.email
          },
          appointmentId: appointment.id,
          startAt: appointment.startAt,
          endAt: appointment.endAt,
          meetingLocation: appointment.meetingLocation,
          candidateVisibleMessage: appointment.candidateVisibleMessage,
          scheduledByEmail: adminEmail
        },
        tx
      );

      return {
        appointment,
        group: candidate.group,
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email
        },
        candidateEmail: candidateEmailDelivery
          ? {
              deliveryId: candidateEmailDelivery.id,
              batchId: appointmentEmail!.batchId
            }
          : null
      };
    }, serializableTransactionOptions)
  );
}

export async function scheduleAppointmentAction(
  groupId: string,
  candidateId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);

  const parsed = scheduleAppointmentSchema.safeParse({
    slotIds: formValues(formData, "slotIds"),
    interviewerIds: formValues(formData, "interviewerIds"),
    meetingLocation: formValue(formData, "meetingLocation"),
    candidateVisibleMessage: formValue(formData, "candidateVisibleMessage"),
    internalNote: formValue(formData, "internalNote"),
    sendEmail: formValue(formData, "sendEmail") === "yes",
    emailSubject: formValue(formData, "emailSubject"),
    emailBody: formValue(formData, "emailBody"),
    ccEmails: formValue(formData, "ccEmails")
  });
  if (!parsed.success) {
    redirectWithAppointmentStatus(groupId, candidateId, "invalid");
  }
  const input = parsed.data;
  const slotIds = uniqueSlotIds(input.slotIds);
  const interviewerIds = uniqueInterviewerIds(input.interviewerIds);
  const appointmentEmail = input.sendEmail
    ? await createAppointmentCandidateEmailDraft(input)
    : null;

  let scheduled: Awaited<ReturnType<typeof createScheduledAppointment>>;
  try {
    scheduled = await createScheduledAppointment({
      adminId: admin.id,
      adminEmail: admin.email,
      groupId,
      candidateId,
      slotIds,
      interviewerIds,
      input,
      appointmentEmail
    });
  } catch (error) {
    if (error instanceof SchedulingValidationError) {
      redirectWithAppointmentStatus(groupId, candidateId, "invalid");
    }
    if (isSchedulingIntegrityConflict(error)) {
      redirectWithAppointmentStatus(groupId, candidateId, "conflict");
    }
    throw error;
  }

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/groups/${groupId}/overview`);

  if (scheduled.candidateEmail) {
    await sendPersistedAppointmentCandidateEmailAndRedirect({
      adminId: admin.id,
      groupId,
      candidate: scheduled.candidate,
      appointment: scheduled.appointment,
      delivery: scheduled.candidateEmail
    });
  }
  redirectWithAppointmentStatus(groupId, candidateId, "scheduled");
}

export async function rescheduleAppointmentAction(
  groupId: string,
  candidateId: string,
  appointmentId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);

  const parsed = scheduleAppointmentSchema.safeParse({
    slotIds: formValues(formData, "slotIds"),
    interviewerIds: formValues(formData, "interviewerIds"),
    meetingLocation: formValue(formData, "meetingLocation"),
    candidateVisibleMessage: formValue(formData, "candidateVisibleMessage"),
    internalNote: formValue(formData, "internalNote"),
    sendEmail: formValue(formData, "sendEmail") === "yes",
    emailSubject: formValue(formData, "emailSubject"),
    emailBody: formValue(formData, "emailBody"),
    ccEmails: formValue(formData, "ccEmails")
  });
  if (!parsed.success) {
    redirectWithAppointmentStatus(groupId, candidateId, "invalid");
  }
  const input = parsed.data;
  const slotIds = uniqueSlotIds(input.slotIds);
  const interviewerIds = uniqueInterviewerIds(input.interviewerIds);
  const appointmentEmail = input.sendEmail
    ? await createAppointmentCandidateEmailDraft(input)
    : null;

  let rescheduled: Awaited<ReturnType<typeof rescheduleScheduledAppointment>>;
  try {
    rescheduled = await rescheduleScheduledAppointment({
      adminId: admin.id,
      adminEmail: admin.email,
      groupId,
      candidateId,
      appointmentId,
      slotIds,
      interviewerIds,
      input,
      appointmentEmail
    });
  } catch (error) {
    if (error instanceof SchedulingValidationError) {
      redirectWithAppointmentStatus(groupId, candidateId, "invalid");
    }
    if (isSchedulingIntegrityConflict(error)) {
      redirectWithAppointmentStatus(groupId, candidateId, "conflict");
    }
    throw error;
  }

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/groups/${groupId}/overview`);

  if (rescheduled.candidateEmail) {
    await sendPersistedAppointmentCandidateEmailAndRedirect({
      adminId: admin.id,
      groupId,
      candidate: rescheduled.candidate,
      appointment: rescheduled.appointment,
      delivery: rescheduled.candidateEmail
    });
  }
  redirectWithAppointmentStatus(groupId, candidateId, "rescheduled");
}

export async function cancelAppointmentAction(groupId: string, appointmentId: string) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);

  let cancelled: CancelledAppointmentResult;

  try {
    cancelled = await withSerializableRetry(() =>
      prisma.$transaction(async (tx) => {
        const appointment = await tx.appointment.findFirst({
          where: {
            id: appointmentId,
            groupId,
            status: AppointmentStatus.SCHEDULED
          },
          include: {
            group: {
              select: { id: true, name: true, groupCode: true, timezone: true }
            },
            candidate: {
              select: { id: true, name: true, email: true }
            }
          }
        });
        if (!appointment) {
          throw new SchedulingConflictError("面试安排已被取消或调整，请刷新后重试。");
        }

        await lockStateResources(tx, [
          `appointment:${appointment.id}`,
          `candidate:${appointment.candidateId}`
        ]);

        // Re-read after acquiring the candidate/appointment locks so a review or
        // another cancellation cannot race this conditional transition.
        const currentAppointment = await tx.appointment.findFirst({
          where: {
            id: appointment.id,
            groupId,
            candidateId: appointment.candidateId,
            status: AppointmentStatus.SCHEDULED
          },
          select: { id: true }
        });
        if (!currentAppointment) {
          throw new SchedulingConflictError("面试安排已被其他操作变更，请刷新后重试。");
        }

        const cancelledAt = new Date();
        const appointmentUpdate = await tx.appointment.updateMany({
          where: {
            id: appointment.id,
            groupId,
            candidateId: appointment.candidateId,
            status: AppointmentStatus.SCHEDULED
          },
          data: {
            status: AppointmentStatus.CANCELLED,
            cancelledByAdminId: admin.id,
            cancelledAt
          }
        });
        if (appointmentUpdate.count !== 1) {
          throw new SchedulingConflictError("面试安排已被其他操作变更，请刷新后重试。");
        }

        await tx.timeSlotLock.updateMany({
          where: {
            appointmentId: appointment.id,
            releasedAt: null
          },
          data: {
            activeSlotId: null,
            releasedAt: cancelledAt
          }
        });

        const [scheduledAppointmentCount, pendingReviewCount] = await Promise.all([
          tx.appointment.count({
            where: {
              candidateId: appointment.candidateId,
              status: AppointmentStatus.SCHEDULED
            }
          }),
          tx.candidateSubmission.count({
            where: {
              candidateId: appointment.candidateId,
              status: CandidateSubmissionStatus.PENDING_REVIEW
            }
          })
        ]);
        const nextCandidateStatus = deriveCandidateStatus({
          hasScheduledAppointment: scheduledAppointmentCount > 0,
          hasPendingReview: pendingReviewCount > 0
        });
        const candidateUpdate = await tx.candidate.updateMany({
          where: {
            id: appointment.candidateId,
            groupId
          },
          data: { status: nextCandidateStatus }
        });
        if (candidateUpdate.count !== 1) {
          throw new SchedulingConflictError("候选人状态已被其他操作变更，请刷新后重试。");
        }

        await tx.auditLog.create({
          data: {
            actorType: AuditActorType.ADMIN,
            actorAdminId: admin.id,
            groupId,
            action: "admin.cancel_appointment",
            entityType: "Appointment",
            entityId: appointment.id,
            beforeData: { status: AppointmentStatus.SCHEDULED },
            afterData: { status: AppointmentStatus.CANCELLED }
          }
        });

        await notifyOwnerAboutAppointment(
          {
            kind: "cancelled",
            group: appointment.group,
            candidate: appointment.candidate,
            appointmentId: appointment.id,
            startAt: appointment.startAt,
            endAt: appointment.endAt,
            meetingLocation: appointment.meetingLocation,
            candidateVisibleMessage: appointment.candidateVisibleMessage,
            scheduledByEmail: admin.email
          },
          tx
        );

        return {
          appointment,
          group: appointment.group,
          candidate: appointment.candidate
        };
      }, serializableTransactionOptions)
    );
  } catch (error) {
    if (isSchedulingIntegrityConflict(error)) {
      throw new Error("面试安排已被其他操作变更，请刷新后重试。");
    }
    throw error;
  }

  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/groups/${groupId}/candidates/${cancelled.appointment.candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/overview`);
}
