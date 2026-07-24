import { CandidateStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  SchedulingConflictError,
  deriveCandidateStatus,
  isSchedulingIntegrityConflict
} from "@/lib/business/scheduling-integrity";

describe("scheduling integrity state", () => {
  it("keeps a scheduled candidate scheduled when a review is resolved", () => {
    expect(
      deriveCandidateStatus({
        hasScheduledAppointment: true,
        hasPendingReview: false
      })
    ).toBe(CandidateStatus.SCHEDULED);
  });

  it("returns to submitted only when no scheduled appointment or pending review remains", () => {
    expect(
      deriveCandidateStatus({
        hasScheduledAppointment: false,
        hasPendingReview: true
      })
    ).toBe(CandidateStatus.PENDING_REVIEW);
    expect(
      deriveCandidateStatus({
        hasScheduledAppointment: false,
        hasPendingReview: false
      })
    ).toBe(CandidateStatus.SUBMITTED);
  });

  it("recognizes an explicit scheduling conflict", () => {
    expect(isSchedulingIntegrityConflict(new SchedulingConflictError())).toBe(true);
  });
});
