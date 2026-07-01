import { CandidateStatus, CandidateSubmissionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  approveModificationTransition,
  rejectModificationTransition
} from "@/lib/business/submission-review";

describe("modification review transitions", () => {
  it("approves pending modification by superseding old active version", () => {
    const transition = approveModificationTransition({
      oldActiveSubmissionId: "active_1",
      pendingSubmissionId: "pending_2"
    });

    expect(transition.oldActive).toEqual({
      id: "active_1",
      status: CandidateSubmissionStatus.SUPERSEDED
    });
    expect(transition.newActive.status).toBe(CandidateSubmissionStatus.ACTIVE);
    expect(transition.newActive.pendingReviewCandidateId).toBeNull();
    expect(transition.candidate).toEqual({
      activeSubmissionId: "pending_2",
      status: CandidateStatus.SUBMITTED
    });
  });

  it("rejects pending modification without replacing active version", () => {
    const transition = rejectModificationTransition("active_1");

    expect(transition.rejectedSubmission.status).toBe(CandidateSubmissionStatus.REJECTED);
    expect(transition.rejectedSubmission.pendingReviewCandidateId).toBeNull();
    expect(transition.candidate.activeSubmissionId).toBe("active_1");
  });
});
