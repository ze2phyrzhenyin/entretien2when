import { describe, expect, it } from "vitest";
import { candidateResponseContainsSensitiveField } from "@/lib/business/sensitive-fields";
import { toCandidateSelfDTO } from "@/lib/candidate/dto";

describe("candidate self DTO", () => {
  it("does not include admin-only or internal fields", () => {
    const source = {
      id: "candidate_1",
      name: "张三",
      email: "candidate@example.com",
      status: "SUBMITTED",
      adminNotes: [{ body: "管理员跟进备注" }],
      otherCandidates: [{ email: "other@example.com" }],
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
              status: "OPEN",
              availableCandidateCount: 5,
              internalNote: "管理员内部开放时间备注",
              activeLock: {
                reasonInternal: "管理员锁定原因"
              }
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
          meetingLocation: "https://example.com/meeting",
          internalNote: "面试安排内部备注"
        }
      ]
    };
    const dto = toCandidateSelfDTO(source);

    const serialized = JSON.stringify(dto);

    expect(candidateResponseContainsSensitiveField(dto)).toBe(false);
    expect(serialized).not.toContain("adminNotes");
    expect(serialized).not.toContain("internalNote");
    expect(serialized).not.toContain("reasonInternal");
    expect(serialized).not.toContain("availableCandidateCount");
    expect(serialized).not.toContain("otherCandidates");
    expect(serialized).not.toContain("管理员跟进备注");
    expect(dto.activeSubmission?.candidateNote).toBe("周三下午更方便");
  });
});
