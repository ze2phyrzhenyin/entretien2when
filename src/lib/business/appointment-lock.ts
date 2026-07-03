import { TimeSlotLockType } from "@prisma/client";

export function buildAppointmentLockRows({
  groupId,
  slotIds,
  appointmentId,
  candidateName,
  lockedByAdminId
}: {
  groupId: string;
  slotIds: string[];
  appointmentId: string;
  candidateName: string;
  lockedByAdminId: string;
}) {
  return slotIds.map((slotId) => ({
    groupId,
    slotId,
    activeSlotId: slotId,
    lockType: TimeSlotLockType.APPOINTMENT,
    appointmentId,
    reasonInternal: `已安排给 ${candidateName}`,
    lockedByAdminId
  }));
}
