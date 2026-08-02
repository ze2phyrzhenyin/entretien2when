import { describe, expect, it } from "vitest";
import { partitionDeletableSlots } from "@/lib/business/slot-deletion";

describe("slot deletion safety", () => {
  it("only deletes slots without submissions, appointments, or locks", () => {
    const result = partitionDeletableSlots([
      {
        id: "slot_empty",
        submissionSlots: [],
        appointmentSlots: [],
        locks: [],
        activeLock: null
      },
      {
        id: "slot_with_submission",
        submissionSlots: [{ id: "submission_slot_1" }],
        appointmentSlots: [],
        locks: [],
        activeLock: null
      },
      {
        id: "slot_with_lock",
        submissionSlots: [],
        appointmentSlots: [],
        locks: [{ id: "lock_1", releasedAt: null }],
        activeLock: { id: "lock_1" }
      }
    ]);

    expect(result.deletable).toEqual(["slot_empty"]);
    expect(result.blocked).toEqual([
      {
        id: "slot_with_submission",
        reasons: ["candidate-submission-reference"]
      },
      {
        id: "slot_with_lock",
        reasons: ["active-lock", "lock-history"]
      }
    ]);
  });
});
