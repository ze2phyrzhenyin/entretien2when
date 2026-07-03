import type { GroupTimeSlot } from "@prisma/client";
import { GroupTimeSlotStatus } from "@prisma/client";

export type SlotForSelection = Pick<GroupTimeSlot, "id" | "startAt" | "endAt" | "status"> & {
  activeLock?: { id: string } | null;
};

export type SlotForAppointmentSelection = Pick<
  GroupTimeSlot,
  "id" | "startAt" | "endAt" | "status"
> & {
  activeLock?: { id: string; appointmentId: string | null } | null;
};

export function uniqueSlotIds(slotIds: string[]) {
  return [...new Set(slotIds.map((slotId) => slotId.trim()).filter(Boolean))];
}

export function assertSlotSelectionCount(slotIds: string[], min: number, max: number) {
  if (slotIds.length < min) {
    throw new Error(`至少需要选择 ${min} 个开放时间。`);
  }
  if (slotIds.length > max) {
    throw new Error(`最多只能选择 ${max} 个开放时间。`);
  }
}

export function assertSlotsSelectable(slots: SlotForSelection[], slotIds: string[]) {
  if (slots.length !== slotIds.length) {
    throw new Error("包含无效开放时间，请刷新后重试。");
  }

  const unavailable = slots.find(
    (slot) => slot.status !== GroupTimeSlotStatus.OPEN || slot.activeLock
  );
  if (unavailable) {
    throw new Error("所选时间包含不可选的开放时间，请刷新后重试。");
  }
}

export function assertSlotsSelectableForAppointment(
  slots: SlotForAppointmentSelection[],
  slotIds: string[],
  appointmentId: string
) {
  if (slots.length !== slotIds.length) {
    throw new Error("包含无效开放时间，请刷新后重试。");
  }

  const unavailable = slots.find((slot) => {
    const lockedBySameAppointment = slot.activeLock?.appointmentId === appointmentId;
    if (slot.status !== GroupTimeSlotStatus.OPEN && !lockedBySameAppointment) {
      return true;
    }
    return Boolean(slot.activeLock && !lockedBySameAppointment);
  });

  if (unavailable) {
    throw new Error("所选时间包含已关闭或被其他面试安排锁定的开放时间，请刷新后重试。");
  }
}

function sortSlotsByStart<T extends Pick<GroupTimeSlot, "startAt">>(slots: T[]) {
  return [...slots].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function assertContinuousSlots(slots: Pick<GroupTimeSlot, "startAt" | "endAt">[]) {
  const sorted = sortSlotsByStart(slots);

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    if (!previous || !current || previous.endAt.getTime() !== current.startAt.getTime()) {
      throw new Error("面试时间必须由连续开放时间组成。");
    }
  }
}
