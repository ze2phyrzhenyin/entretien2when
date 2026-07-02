export type SlotDeletionCandidate = {
  id: string;
  submissionSlots: Array<{ id: string }>;
  appointmentSlots: Array<{ id: string }>;
  locks: Array<{ id: string; releasedAt: Date | null }>;
  activeLock?: { id: string } | null;
};

function getBlockedSlotDeletionReasons(slot: SlotDeletionCandidate) {
  const reasons: string[] = [];

  if (slot.submissionSlots.length > 0) {
    reasons.push("已有候选人提交引用");
  }
  if (slot.appointmentSlots.length > 0) {
    reasons.push("已有预约引用");
  }
  if (slot.activeLock) {
    reasons.push("当前已锁定");
  }
  if (slot.locks.length > 0) {
    reasons.push("存在锁定记录");
  }

  return reasons;
}

export function partitionDeletableSlots(slots: SlotDeletionCandidate[]) {
  const deletable: string[] = [];
  const blocked: Array<{ id: string; reasons: string[] }> = [];

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
