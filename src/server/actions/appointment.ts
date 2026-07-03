"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppointmentStatus, AuditActorType, CandidateStatus } from "@prisma/client";
import { buildAppointmentLockRows } from "@/lib/business/appointment-lock";
import {
  assertContinuousSlots,
  assertSlotsSelectableForAppointment,
  assertSlotsSelectable,
  uniqueSlotIds
} from "@/lib/business/slot-selection";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { appointmentConfirmedEmailTemplate } from "@/lib/mail/email-templates";
import { buildAppointmentEmailContext } from "@/lib/mail/appointment-email-context";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue, formValues } from "@/lib/validation/common";
import { scheduleAppointmentSchema } from "@/lib/validation/appointment";
import { attemptCandidateEmailDelivery } from "@/server/services/candidate-email";
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

async function sendAppointmentCandidateEmailAndRedirect({
  adminId,
  groupId,
  group,
  candidate,
  appointment,
  input
}: {
  adminId: string;
  groupId: string;
  group: { id: string; name: string };
  candidate: { id: string; name: string; email: string };
  appointment: {
    id: string;
    startAt: Date;
    endAt: Date;
    meetingLocation: string | null;
    candidateVisibleMessage: string | null;
  };
  input: {
    emailSubject?: string;
    emailBody?: string;
    ccEmails?: string[];
  };
}) {
  const batchId = randomUUID();
  const result = await attemptCandidateEmailDelivery({
    adminId,
    group,
    candidate,
    batchId,
    templateKey: appointmentConfirmedEmailTemplate.key,
    subject: input.emailSubject ?? appointmentConfirmedEmailTemplate.subject,
    bodyTemplate: input.emailBody ?? appointmentConfirmedEmailTemplate.body,
    ccEmails: input.ccEmails,
    templateValues: buildAppointmentEmailContext({
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      meetingLocation: appointment.meetingLocation,
      candidateVisibleMessage: appointment.candidateVisibleMessage
    })
  });

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
        ccEmails: input.ccEmails,
        status: result.status,
        emailId: result.emailId,
        error: result.error
      }
    }
  });

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidate.id}`);
  if (result.status === "failure") {
    redirectWithScheduleMailStatus(groupId, candidate.id, {
      mail: "error",
      batchId
    });
  }
  redirectWithScheduleMailStatus(groupId, candidate.id, {
    mail: "sent",
    dryRun: result.status === "preview",
    batchId
  });
}

export async function scheduleAppointmentAction(
  groupId: string,
  candidateId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);

  const input = scheduleAppointmentSchema.parse({
    slotIds: formValues(formData, "slotIds"),
    meetingLocation: formValue(formData, "meetingLocation"),
    candidateVisibleMessage: formValue(formData, "candidateVisibleMessage"),
    internalNote: formValue(formData, "internalNote"),
    sendEmail: formValue(formData, "sendEmail") === "yes",
    emailSubject: formValue(formData, "emailSubject"),
    emailBody: formValue(formData, "emailBody"),
    ccEmails: formValue(formData, "ccEmails")
  });
  const slotIds = uniqueSlotIds(input.slotIds);

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, groupId },
    include: {
      group: {
        select: { id: true, name: true, groupCode: true, timezone: true }
      },
      activeSubmission: {
        include: {
          slots: true
        }
      }
    }
  });

  if (!candidate?.activeSubmission) {
    throw new Error("候选人没有有效提交，不能安排面试。");
  }

  const activeSubmissionSlotIds = new Set(
    candidate.activeSubmission.slots.map((slot) => slot.slotId)
  );
  if (slotIds.some((slotId) => !activeSubmissionSlotIds.has(slotId))) {
    throw new Error("预约时间必须来自候选人当前有效可用时间。");
  }

  const slots = await prisma.groupTimeSlot.findMany({
    where: {
      groupId,
      id: { in: slotIds }
    },
    include: {
      activeLock: {
        select: { id: true }
      }
    }
  });

  assertSlotsSelectable(slots, slotIds);
  assertContinuousSlots(slots);

  const sortedSlots = slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const firstSlot = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];

  if (!firstSlot || !lastSlot) {
    throw new Error("请选择预约时间。");
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        groupId,
        candidateId,
        startAt: firstSlot.startAt,
        endAt: lastSlot.endAt,
        status: AppointmentStatus.SCHEDULED,
        candidateVisibleMessage: input.candidateVisibleMessage || null,
        meetingLocation: input.meetingLocation || null,
        internalNote: input.internalNote || null,
        scheduledByAdminId: admin.id,
        slots: {
          create: slotIds.map((slotId) => ({ slotId }))
        }
      }
    });

    await tx.timeSlotLock.createMany({
      data: buildAppointmentLockRows({
        groupId,
        appointmentId: appointment.id,
        slotIds,
        candidateName: candidate.name,
        lockedByAdminId: admin.id
      })
    });

    await tx.candidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.SCHEDULED }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.schedule_appointment",
        entityType: "Appointment",
        entityId: appointment.id,
        afterData: { slotIds }
      }
    });

    return appointment;
  });

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/groups/${groupId}/overview`);

  await notifyOwnerAboutAppointment({
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
    scheduledByEmail: admin.email
  });

  if (input.sendEmail) {
    await sendAppointmentCandidateEmailAndRedirect({
      adminId: admin.id,
      groupId,
      group: candidate.group,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email
      },
      appointment,
      input
    });
  }
}

export async function rescheduleAppointmentAction(
  groupId: string,
  candidateId: string,
  appointmentId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);

  const input = scheduleAppointmentSchema.parse({
    slotIds: formValues(formData, "slotIds"),
    meetingLocation: formValue(formData, "meetingLocation"),
    candidateVisibleMessage: formValue(formData, "candidateVisibleMessage"),
    internalNote: formValue(formData, "internalNote"),
    sendEmail: formValue(formData, "sendEmail") === "yes",
    emailSubject: formValue(formData, "emailSubject"),
    emailBody: formValue(formData, "emailBody"),
    ccEmails: formValue(formData, "ccEmails")
  });
  const slotIds = uniqueSlotIds(input.slotIds);

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, groupId },
    include: {
      group: {
        select: { id: true, name: true, groupCode: true, timezone: true }
      }
    }
  });

  if (!candidate) {
    throw new Error("未找到候选人。");
  }

  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      groupId,
      candidateId,
      status: AppointmentStatus.SCHEDULED
    },
    include: {
      slots: {
        select: { slotId: true }
      }
    }
  });

  if (!existingAppointment) {
    throw new Error("未找到可更改的预约。");
  }

  const slots = await prisma.groupTimeSlot.findMany({
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

  assertSlotsSelectableForAppointment(slots, slotIds, existingAppointment.id);
  assertContinuousSlots(slots);

  const sortedSlots = slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const firstSlot = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];

  if (!firstSlot || !lastSlot) {
    throw new Error("请选择预约时间。");
  }

  const previousSlotIds = existingAppointment.slots.map((slot) => slot.slotId);
  const appointment = await prisma.$transaction(async (tx) => {
    const releasedAt = new Date();

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

    await tx.appointmentSlot.deleteMany({
      where: { appointmentId: existingAppointment.id }
    });

    const updatedAppointment = await tx.appointment.update({
      where: { id: existingAppointment.id },
      data: {
        startAt: firstSlot.startAt,
        endAt: lastSlot.endAt,
        status: AppointmentStatus.SCHEDULED,
        candidateVisibleMessage: input.candidateVisibleMessage || null,
        meetingLocation: input.meetingLocation || null,
        internalNote: input.internalNote || null,
        scheduledByAdminId: admin.id,
        cancelledByAdminId: null,
        cancelledAt: null,
        slots: {
          create: slotIds.map((slotId) => ({ slotId }))
        }
      }
    });

    await tx.timeSlotLock.createMany({
      data: buildAppointmentLockRows({
        groupId,
        appointmentId: updatedAppointment.id,
        slotIds,
        candidateName: candidate.name,
        lockedByAdminId: admin.id
      })
    });

    await tx.candidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.SCHEDULED }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.reschedule_appointment",
        entityType: "Appointment",
        entityId: updatedAppointment.id,
        beforeData: {
          slotIds: previousSlotIds,
          startAt: existingAppointment.startAt,
          endAt: existingAppointment.endAt
        },
        afterData: {
          slotIds,
          startAt: updatedAppointment.startAt,
          endAt: updatedAppointment.endAt
        }
      }
    });

    return updatedAppointment;
  });

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/groups/${groupId}/overview`);

  await notifyOwnerAboutAppointment({
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
    scheduledByEmail: admin.email
  });

  if (input.sendEmail) {
    await sendAppointmentCandidateEmailAndRedirect({
      adminId: admin.id,
      groupId,
      group: candidate.group,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email
      },
      appointment,
      input
    });
  }
}

export async function cancelAppointmentAction(groupId: string, appointmentId: string) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, groupId },
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
    throw new Error("未找到预约。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledByAdminId: admin.id,
        cancelledAt: new Date()
      }
    });

    await tx.timeSlotLock.updateMany({
      where: {
        appointmentId: appointment.id,
        releasedAt: null
      },
      data: {
        activeSlotId: null,
        releasedAt: new Date()
      }
    });

    await tx.candidate.update({
      where: { id: appointment.candidateId },
      data: { status: CandidateStatus.SUBMITTED }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.cancel_appointment",
        entityType: "Appointment",
        entityId: appointment.id
      }
    });
  });

  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/groups/${groupId}/candidates/${appointment.candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/overview`);

  await notifyOwnerAboutAppointment({
    kind: "cancelled",
    group: appointment.group,
    candidate: appointment.candidate,
    appointmentId: appointment.id,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    meetingLocation: appointment.meetingLocation,
    candidateVisibleMessage: appointment.candidateVisibleMessage,
    scheduledByEmail: admin.email
  });
}
