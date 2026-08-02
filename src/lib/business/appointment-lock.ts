import { TimeSlotLockType } from "@prisma/client";

export function buildAppointmentLockRows({
  groupId,
  slotIds,
  appointmentId,
  lockedByAdminId
}: {
  groupId: string;
  slotIds: string[];
  appointmentId: string;
  lockedByAdminId: string;
}) {
  return slotIds.map((slotId) => ({
    groupId,
    slotId,
    activeSlotId: slotId,
    lockType: TimeSlotLockType.APPOINTMENT,
    appointmentId,
    // appointmentId is the stable business relationship. The candidate name
    // is intentionally not frozen into a localized database string; readers
    // render the relationship in their current locale.
    reasonInternal: null,
    lockedByAdminId
  }));
}
