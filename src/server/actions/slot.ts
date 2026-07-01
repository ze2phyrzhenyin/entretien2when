"use server";

import { revalidatePath } from "next/cache";
import { GroupTimeSlotStatus } from "@prisma/client";
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
import { batchGenerateSlotsSchema } from "@/lib/validation/slot";

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
    endTime: formValue(formData, "endTime"),
    weekdays: formValues(formData, "weekdays")
  });

  const startMinutes = minutesSinceMidnight(input.startTime);
  const endMinutes = minutesSinceMidnight(input.endTime);
  const dates = dateRangeDates(input.dateFrom, input.dateTo);
  const weekdays = new Set(input.weekdays);
  const data: Array<{ groupId: string; startAt: Date; endAt: Date; status: GroupTimeSlotStatus }> =
    [];

  for (const date of dates) {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    if (!weekdays.has(weekday)) {
      continue;
    }

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
    await prisma.groupTimeSlot.createMany({
      data,
      skipDuplicates: true
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

  await prisma.groupTimeSlot.updateMany({
    where: {
      id: slotId,
      groupId
    },
    data: {
      status
    }
  });

  revalidatePath(`/admin/groups/${groupId}/slots`);
}
