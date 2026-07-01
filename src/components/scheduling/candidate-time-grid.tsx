"use client";

import { useMemo } from "react";
import { CandidateTimeCell } from "@/components/scheduling/time-cell";
import type { CandidateSlotView } from "@/components/scheduling/types";

export function CandidateTimeGrid({
  slots,
  selectedSlotIds,
  onToggleSlot
}: {
  slots: CandidateSlotView[];
  selectedSlotIds: string[];
  onToggleSlot: (slot: CandidateSlotView) => void;
}) {
  const groupedSlots = useMemo(() => {
    const groups = new Map<string, CandidateSlotView[]>();
    for (const slot of slots) {
      groups.set(slot.dateLabel, [...(groups.get(slot.dateLabel) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [slots]);

  if (groupedSlots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-subtle p-6 text-sm text-muted-foreground">
        当前面试组还没有开放时间，请联系招聘方。
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groupedSlots.map(([dateLabel, daySlots]) => (
        <section key={dateLabel} className="space-y-3">
          <h3 className="text-sm font-semibold">{dateLabel}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {daySlots.map((slot) => (
              <CandidateTimeCell
                key={slot.id}
                label={slot.timeLabel}
                disabled={slot.disabled}
                selected={selectedSlotIds.includes(slot.id)}
                onClick={() => onToggleSlot(slot)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
