import type {
  AdminGroupRole,
  AdminStatus,
  AppointmentStatus,
  CandidateStatus,
  CandidateSubmissionStatus,
  CandidateSubmissionType,
  InterviewGroupStatus,
  InterviewRoundStatus,
  InterviewerStatus
} from "@prisma/client";
import type { MessageKey } from "@/i18n/catalogs";

export const interviewGroupStatusLabel: Record<InterviewGroupStatus, MessageKey> = {
  DRAFT: "legacy.draft.2a2fd29b",
  OPEN: "legacy.open.c14c915d",
  CLOSED: "legacy.close.3fd47edc",
  ARCHIVED: "legacy.archived.5292ab1a"
};

export const candidateStatusLabel: Record<CandidateStatus, MessageKey> = {
  SUBMITTED: "legacy.submitted.bc37a611",
  PENDING_REVIEW: "legacy.modification_pending_review.cc12a4bf",
  SCHEDULED: "legacy.interview_arranged.c7cf9fba",
  COMPLETED: "legacy.completed.f28461bb",
  CANCELLED: "legacy.cancelled.a37778f1"
};

export const candidateSubmissionStatusLabel: Record<CandidateSubmissionStatus, MessageKey> = {
  ACTIVE: "legacy.currently_valid.e6b1dcba",
  PENDING_REVIEW: "legacy.pending_review.7bf25421",
  APPROVED: "legacy.approved.3fa9b684",
  REJECTED: "legacy.rejected.f098218a",
  SUPERSEDED: "legacy.replaced.b7345661"
};

export const candidateSubmissionTypeLabel: Record<CandidateSubmissionType, MessageKey> = {
  INITIAL: "legacy.initial_submission.b1d4c1e3",
  MODIFICATION: "legacy.change_request.7888bd2a"
};

export const appointmentStatusLabel: Record<AppointmentStatus, MessageKey> = {
  SCHEDULED: "legacy.scheduled.2fcab8f6",
  CANCELLED: "legacy.cancelled.a37778f1",
  COMPLETED: "legacy.completed.f28461bb",
  NO_SHOW: "legacy.no_show.3d402a9f"
};

export const adminStatusLabel: Record<AdminStatus, MessageKey> = {
  ACTIVE: "enum.adminStatus.ACTIVE",
  DISABLED: "enum.adminStatus.DISABLED"
};

export const adminGroupRoleLabel: Record<AdminGroupRole, MessageKey> = {
  OWNER: "enum.groupRole.OWNER",
  SCHEDULER: "enum.groupRole.SCHEDULER",
  REVIEWER: "enum.groupRole.REVIEWER",
  VIEWER: "enum.groupRole.VIEWER"
};

export const interviewRoundStatusLabel: Record<InterviewRoundStatus, MessageKey> = {
  ACTIVE: "enum.roundStatus.ACTIVE",
  CLOSED: "enum.roundStatus.CLOSED",
  ARCHIVED: "enum.roundStatus.ARCHIVED"
};

export const interviewerStatusLabel: Record<InterviewerStatus, MessageKey> = {
  ACTIVE: "enum.interviewerStatus.ACTIVE",
  INACTIVE: "enum.interviewerStatus.INACTIVE"
};
