import { GroupTimeSlotStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertContinuousSlots,
  assertSlotSelectionCount,
  assertSlotsSelectableForAppointment,
  assertSlotsSelectable
} from "@/lib/business/slot-selection";

describe("slot selection rules", () => {
  it("validates min and max selected slot count", () => {
    expect(() => assertSlotSelectionCount(["slot_1"], 1, 2)).not.toThrow();
    expect(() => assertSlotSelectionCount([], 1, 2)).toThrow("至少需要选择");
    expect(() => assertSlotSelectionCount(["a", "b", "c"], 1, 2)).toThrow("最多只能选择");
  });

  it("rejects closed or locked slots", () => {
    expect(() =>
      assertSlotsSelectable(
        [
          {
            id: "slot_1",
            startAt: new Date("2026-07-01T01:00:00.000Z"),
            endAt: new Date("2026-07-01T01:30:00.000Z"),
            status: GroupTimeSlotStatus.OPEN,
            activeLock: null
          }
        ],
        ["slot_1"]
      )
    ).not.toThrow();

    expect(() =>
      assertSlotsSelectable(
        [
          {
            id: "slot_1",
            startAt: new Date("2026-07-01T01:00:00.000Z"),
            endAt: new Date("2026-07-01T01:30:00.000Z"),
            status: GroupTimeSlotStatus.OPEN,
            activeLock: { id: "lock_1" }
          }
        ],
        ["slot_1"]
      )
    ).toThrow("不可选");
  });

  it("requires appointment slots to be continuous", () => {
    expect(() =>
      assertContinuousSlots([
        {
          startAt: new Date("2026-07-01T01:00:00.000Z"),
          endAt: new Date("2026-07-01T01:30:00.000Z")
        },
        {
          startAt: new Date("2026-07-01T01:30:00.000Z"),
          endAt: new Date("2026-07-01T02:00:00.000Z")
        }
      ])
    ).not.toThrow();

    expect(() =>
      assertContinuousSlots([
        {
          startAt: new Date("2026-07-01T01:00:00.000Z"),
          endAt: new Date("2026-07-01T01:30:00.000Z")
        },
        {
          startAt: new Date("2026-07-01T02:00:00.000Z"),
          endAt: new Date("2026-07-01T02:30:00.000Z")
        }
      ])
    ).toThrow("连续时间段");
  });

  it("allows rescheduling through the same appointment lock but rejects other locks", () => {
    const slot = {
      id: "slot_1",
      startAt: new Date("2026-07-01T01:00:00.000Z"),
      endAt: new Date("2026-07-01T01:30:00.000Z"),
      status: GroupTimeSlotStatus.OPEN
    };

    expect(() =>
      assertSlotsSelectableForAppointment(
        [
          {
            ...slot,
            activeLock: { id: "lock_1", appointmentId: "appointment_1" }
          }
        ],
        ["slot_1"],
        "appointment_1"
      )
    ).not.toThrow();

    expect(() =>
      assertSlotsSelectableForAppointment(
        [
          {
            ...slot,
            activeLock: { id: "lock_2", appointmentId: "appointment_2" }
          }
        ],
        ["slot_1"],
        "appointment_1"
      )
    ).toThrow("其他预约锁定");
  });
});
