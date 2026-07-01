import { CandidateStatus, CandidateSubmissionStatus } from "@prisma/client";

export function approveModificationTransition({
  oldActiveSubmissionId,
  pendingSubmissionId
}: {
  oldActiveSubmissionId: string | null;
  pendingSubmissionId: string;
}) {
  return {
    oldActive: oldActiveSubmissionId
      ? {
          id: oldActiveSubmissionId,
          status: CandidateSubmissionStatus.SUPERSEDED
        }
      : null,
    newActive: {
      id: pendingSubmissionId,
      status: CandidateSubmissionStatus.ACTIVE,
      pendingReviewCandidateId: null
    },
    candidate: {
      activeSubmissionId: pendingSubmissionId,
      status: CandidateStatus.SUBMITTED
    }
  };
}

export function rejectModificationTransition(activeSubmissionId: string | null) {
  return {
    rejectedSubmission: {
      status: CandidateSubmissionStatus.REJECTED,
      pendingReviewCandidateId: null
    },
    candidate: {
      activeSubmissionId,
      status: CandidateStatus.SUBMITTED
    }
  };
}
