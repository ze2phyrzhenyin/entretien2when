"use client";

import { useMemo } from "react";
import { CandidateTimeCell } from "@/components/scheduling/time-cell";
import type { CandidateSlotView } from "@/components/scheduling/types";
import { formatDate, formatTime } from "@/lib/date/timezone";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";

export function CandidateTimeGrid({
  slots,
  defaultTimezone,
  selectedSlotIds,
  onToggleSlot
}: {
  slots: CandidateSlotView[];
  defaultTimezone: string;
  selectedSlotIds: string[];
  onToggleSlot: (slot: CandidateSlotView) => void;
}) {
  const { timezone } = useDisplayTimezone(defaultTimezone);

  const zonedSlots = useMemo(
    () =>
      slots.map((slot) => {
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);

        return {
          ...slot,
          dateLabel: formatDate(start, timezone),
          timeLabel: `${formatTime(start, timezone)}-${formatTime(end, timezone)}`
        };
      }),
    [slots, timezone]
  );

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, typeof zonedSlots>();
    for (const slot of zonedSlots) {
      groups.set(slot.dateLabel, [...(groups.get(slot.dateLabel) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [zonedSlots]);

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
