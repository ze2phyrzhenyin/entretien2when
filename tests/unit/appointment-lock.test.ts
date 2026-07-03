import { TimeSlotLockType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildAppointmentLockRows } from "@/lib/business/appointment-lock";

describe("appointment locks", () => {
  it("creates active appointment lock rows for each scheduled slot", () => {
    const rows = buildAppointmentLockRows({
      groupId: "group_1",
      slotIds: ["slot_1", "slot_2"],
      appointmentId: "appointment_1",
      candidateName: "张三",
      lockedByAdminId: "admin_1"
    });

    expect(rows).toEqual([
      {
        groupId: "group_1",
        slotId: "slot_1",
        activeSlotId: "slot_1",
        lockType: TimeSlotLockType.APPOINTMENT,
        appointmentId: "appointment_1",
        reasonInternal: "已安排给 张三",
        lockedByAdminId: "admin_1"
      },
      {
        groupId: "group_1",
        slotId: "slot_2",
        activeSlotId: "slot_2",
        lockType: TimeSlotLockType.APPOINTMENT,
        appointmentId: "appointment_1",
        reasonInternal: "已安排给 张三",
        lockedByAdminId: "admin_1"
      }
    ]);
  });
});
