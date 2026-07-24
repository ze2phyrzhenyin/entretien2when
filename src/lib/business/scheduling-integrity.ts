import { CandidateStatus, Prisma } from "@prisma/client";

export class SchedulingValidationError extends Error {
  constructor(message = "排期前提已变化，请刷新后重试。") {
    super(message);
    this.name = "SchedulingValidationError";
  }
}

export class SchedulingConflictError extends Error {
  constructor(message = "所选时间或面试官已被其他安排占用，请刷新后重试。") {
    super(message);
    this.name = "SchedulingConflictError";
  }
}

export function deriveCandidateStatus({
  hasScheduledAppointment,
  hasPendingReview
}: {
  hasScheduledAppointment: boolean;
  hasPendingReview: boolean;
}) {
  if (hasScheduledAppointment) {
    return CandidateStatus.SCHEDULED;
  }
  if (hasPendingReview) {
    return CandidateStatus.PENDING_REVIEW;
  }
  return CandidateStatus.SUBMITTED;
}

/**
 * Maps known database integrity failures to the user-recoverable scheduling
 * conflict path. Constraint names are intentionally stable and live in the
 * scheduling-integrity migration.
 */
export function isSchedulingIntegrityConflict(error: unknown) {
  if (error instanceof SchedulingConflictError) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /(?:GroupTimeSlot_no_overlap|Appointment_single_scheduled_candidate|AppointmentInterviewer_no_overlap|TimeSlotLock_activeSlotId_key|23P01|An interviewer cannot be assigned to overlapping scheduled appointments|conflicting key value violates exclusion constraint)/i.test(
    message
  );
}
