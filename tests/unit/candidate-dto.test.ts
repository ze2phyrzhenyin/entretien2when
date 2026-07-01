import { describe, expect, it } from "vitest";
import { toCandidateSelfDTO } from "@/lib/candidate/dto";

describe("candidate self DTO", () => {
  it("does not include admin-only or internal fields", () => {
    const dto = toCandidateSelfDTO({
      id: "candidate_1",
      name: "张三",
      email: "candidate@example.com",
      status: "SUBMITTED",
      activeSubmission: {
        id: "submission_1",
        versionNo: 1,
        candidateNote: "周三下午更方便",
        slots: [
          {
            slot: {
              id: "slot_1",
              startAt: new Date("2026-07-01T02:00:00.000Z"),
              endAt: new Date("2026-07-01T02:30:00.000Z"),
              status: "OPEN"
            }
          }
        ]
      },
      appointments: [
        {
          id: "appointment_1",
          startAt: new Date("2026-07-02T02:00:00.000Z"),
          endAt: new Date("2026-07-02T03:00:00.000Z"),
          status: "SCHEDULED",
          candidateVisibleMessage: "请提前 5 分钟进入会议",
          meetingLocation: "https://example.com/meeting"
        }
      ]
    });

    const serialized = JSON.stringify(dto);

    expect(serialized).not.toContain("adminNotes");
    expect(serialized).not.toContain("internalNote");
    expect(serialized).not.toContain("reasonInternal");
    expect(serialized).not.toContain("availableCandidateCount");
    expect(dto.activeSubmission?.candidateNote).toBe("周三下午更方便");
  });
});
