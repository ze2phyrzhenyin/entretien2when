export type SlotDeletionCandidate = {
  id: string;
  submissionSlots: Array<{ id: string }>;
  appointmentSlots: Array<{ id: string }>;
  locks: Array<{ id: string; releasedAt: Date | null }>;
  activeLock?: { id: string } | null;
};

export type SlotDeletionBlockReason =
  "candidate-submission-reference" | "appointment-reference" | "active-lock" | "lock-history";

function getBlockedSlotDeletionReasons(slot: SlotDeletionCandidate) {
  const reasons: SlotDeletionBlockReason[] = [];

  if (slot.submissionSlots.length > 0) {
    reasons.push("candidate-submission-reference");
  }
  if (slot.appointmentSlots.length > 0) {
    reasons.push("appointment-reference");
  }
  if (slot.activeLock) {
    reasons.push("active-lock");
  }
  if (slot.locks.length > 0) {
    reasons.push("lock-history");
  }

  return reasons;
}

export function partitionDeletableSlots(slots: SlotDeletionCandidate[]) {
  const deletable: string[] = [];
  const blocked: Array<{ id: string; reasons: SlotDeletionBlockReason[] }> = [];

  for (const slot of slots) {
    const reasons = getBlockedSlotDeletionReasons(slot);
    if (reasons.length === 0) {
      deletable.push(slot.id);
    } else {
      blocked.push({ id: slot.id, reasons });
    }
  }

  return { deletable, blocked };
}
