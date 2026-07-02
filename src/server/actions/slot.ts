"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditActorType, GroupTimeSlotStatus } from "@prisma/client";
import { partitionDeletableSlots } from "@/lib/business/slot-deletion";
import { requireAdmin } from "@/lib/auth/session";
import {
  addMinutes,
  dateRangeDates,
  minutesSinceMidnight,
  zonedDateTimeToUtc
} from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue, formValues } from "@/lib/validation/common";
import {
  batchDeleteSlotsSchema,
  batchGenerateSlotsSchema,
  clearSlotsSchema
} from "@/lib/validation/slot";

function redirectWithSlotDeleteStatus(
  groupId: string,
  params: {
    result: "deleted" | "partial" | "blocked" | "invalid";
    deleted?: number;
    skipped?: number;
  }
): never {
  const url = new URL(`http://local/admin/groups/${groupId}/slots`);
  url.searchParams.set("slotDelete", params.result);
  if (typeof params.deleted === "number") {
    url.searchParams.set("slotDeleted", String(params.deleted));
  }
  if (typeof params.skipped === "number") {
    url.searchParams.set("slotSkipped", String(params.skipped));
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function batchGenerateSlotsAction(groupId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canEditGroup");

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { timezone: true, slotDurationMinutes: true }
  });

  const input = batchGenerateSlotsSchema.parse({
    dateFrom: formValue(formData, "dateFrom"),
    dateTo: formValue(formData, "dateTo"),
    startTime: formValue(formData, "startTime"),
    endTime: formValue(formData, "endTime")
  });

  const startMinutes = minutesSinceMidnight(input.startTime);
  const endMinutes = minutesSinceMidnight(input.endTime);
  const dates = dateRangeDates(input.dateFrom, input.dateTo);
  const data: Array<{ groupId: string; startAt: Date; endAt: Date; status: GroupTimeSlotStatus }> =
    [];

  for (const date of dates) {
    for (
      let cursor = startMinutes;
      cursor + group.slotDurationMinutes <= endMinutes;
      cursor += group.slotDurationMinutes
    ) {
      const hour = Math.floor(cursor / 60)
        .toString()
        .padStart(2, "0");
      const minute = (cursor % 60).toString().padStart(2, "0");
      const startAt = zonedDateTimeToUtc(date, `${hour}:${minute}`, group.timezone);
      data.push({
        groupId,
        startAt,
        endAt: addMinutes(startAt, group.slotDurationMinutes),
        status: GroupTimeSlotStatus.OPEN
      });
    }
  }

  if (data.length > 0) {
    await prisma.$transaction(async (tx) => {
      const createResult = await tx.groupTimeSlot.createMany({
        data,
        skipDuplicates: true
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: admin.id,
          groupId,
          action: "admin.batch_generate_slots",
          entityType: "GroupTimeSlot",
          entityId: groupId,
          afterData: {
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            startTime: input.startTime,
            endTime: input.endTime,
            requestedCount: data.length,
            insertedCount: createResult.count
          }
        }
      });
    });
  }

  revalidatePath(`/admin/groups/${groupId}/slots`);
  revalidatePath(`/candidate`);
}

export async function updateSlotStatusAction(
  groupId: string,
  slotId: string,
  status: GroupTimeSlotStatus
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canEditGroup");

  const slot = await prisma.groupTimeSlot.findFirst({
    where: {
      id: slotId,
      groupId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (slot) {
    await prisma.$transaction(async (tx) => {
      await tx.groupTimeSlot.updateMany({
        where: {
          id: slotId,
          groupId
        },
        data: {
          status
        }
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: admin.id,
          groupId,
          action: "admin.update_slot_status",
          entityType: "GroupTimeSlot",
          entityId: slot.id,
          beforeData: {
            status: slot.status
          },
          afterData: {
            status
          }
        }
      });
    });
  }

  revalidatePath(`/admin/groups/${groupId}/slots`);
}

export async function deleteSlotsAction(groupId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canEditGroup");

  const mode = formValue(formData, "deleteMode") === "clearAll" ? "clearAll" : "selected";
  let targetSlotIds: string[] | null = null;
  if (mode === "clearAll") {
    const parsed = clearSlotsSchema.safeParse({
      confirmDelete: formValue(formData, "confirmDelete")
    });
    if (!parsed.success) {
      redirectWithSlotDeleteStatus(groupId, { result: "invalid" });
    }
  } else {
    const parsed = batchDeleteSlotsSchema.safeParse({
      slotIds: formValues(formData, "slotIds"),
      confirmDelete: formValue(formData, "confirmDelete")
    });
    if (!parsed.success) {
      redirectWithSlotDeleteStatus(groupId, { result: "invalid" });
    }
    targetSlotIds = parsed.data.slotIds;
  }

  const slots = await prisma.groupTimeSlot.findMany({
    where:
      mode === "clearAll"
        ? { groupId }
        : {
            groupId,
            id: {
              in: targetSlotIds ?? []
            }
          },
    include: {
      submissionSlots: {
        select: { id: true }
      },
      appointmentSlots: {
        select: { id: true }
      },
      locks: {
        select: { id: true, releasedAt: true }
      },
      activeLock: {
        select: { id: true }
      }
    }
  });

  if (slots.length === 0) {
    redirectWithSlotDeleteStatus(groupId, { result: "invalid" });
  }

  const { deletable, blocked } = partitionDeletableSlots(slots);

  if (deletable.length > 0) {
    await prisma.$transaction(async (tx) => {
      const deleteResult = await tx.groupTimeSlot.deleteMany({
        where: {
          groupId,
          id: { in: deletable }
        }
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: admin.id,
          groupId,
          action: mode === "clearAll" ? "admin.clear_slots" : "admin.batch_delete_slots",
          entityType: "GroupTimeSlot",
          entityId: groupId,
          beforeData: {
            requestedSlotIds: slots.map((slot) => slot.id),
            mode
          },
          afterData: {
            deletedSlotIds: deletable,
            deletedCount: deleteResult.count,
            blocked
          }
        }
      });
    });
  } else {
    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: mode === "clearAll" ? "admin.clear_slots" : "admin.batch_delete_slots",
        entityType: "GroupTimeSlot",
        entityId: groupId,
        beforeData: {
          requestedSlotIds: slots.map((slot) => slot.id),
          mode
        },
        afterData: {
          deletedSlotIds: [],
          deletedCount: 0,
          blocked
        }
      }
    });
  }

  revalidatePath(`/admin/groups/${groupId}/slots`);
  revalidatePath(`/admin/groups/${groupId}/overview`);
  revalidatePath("/candidate");

  if (deletable.length === 0) {
    redirectWithSlotDeleteStatus(groupId, {
      result: "blocked",
      deleted: 0,
      skipped: blocked.length
    });
  }
  if (blocked.length > 0) {
    redirectWithSlotDeleteStatus(groupId, {
      result: "partial",
      deleted: deletable.length,
      skipped: blocked.length
    });
  }
  redirectWithSlotDeleteStatus(groupId, {
    result: "deleted",
    deleted: deletable.length,
    skipped: 0
  });
}
