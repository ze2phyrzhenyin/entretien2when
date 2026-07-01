"use server";

import { revalidatePath } from "next/cache";
import { AppointmentStatus, AuditActorType, CandidateStatus } from "@prisma/client";
import { buildAppointmentLockRows } from "@/lib/business/appointment-lock";
import {
  assertContinuousSlots,
  assertSlotsSelectable,
  uniqueSlotIds
} from "@/lib/business/slot-selection";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue, formValues } from "@/lib/validation/common";
import { scheduleAppointmentSchema } from "@/lib/validation/appointment";

export async function scheduleAppointmentAction(
  groupId: string,
  candidateId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canScheduleInterview");

  const input = scheduleAppointmentSchema.parse({
    slotIds: formValues(formData, "slotIds"),
    meetingLocation: formValue(formData, "meetingLocation"),
    candidateVisibleMessage: formValue(formData, "candidateVisibleMessage"),
    internalNote: formValue(formData, "internalNote")
  });
  const slotIds = uniqueSlotIds(input.slotIds);

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, groupId },
    include: {
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

  await prisma.$transaction(async (tx) => {
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
        action: "admin.schedule_appointment",
        entityType: "Appointment",
        entityId: appointment.id,
        afterData: { slotIds }
      }
    });
  });

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath(`/admin/groups/${groupId}/overview`);
}

export async function cancelAppointmentAction(groupId: string, appointmentId: string) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canScheduleInterview");

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, groupId },
    select: { id: true, candidateId: true }
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
        action: "admin.cancel_appointment",
        entityType: "Appointment",
        entityId: appointment.id
      }
    });
  });

  revalidatePath(`/admin/groups/${groupId}/appointments`);
  revalidatePath(`/admin/groups/${groupId}/candidates/${appointment.candidateId}`);
  revalidatePath(`/admin/groups/${groupId}/overview`);
}
