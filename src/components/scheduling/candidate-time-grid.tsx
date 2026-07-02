"use client";

import { useMemo } from "react";
import { Check, MousePointerClick, X } from "lucide-react";
import { CandidateTimeCell } from "@/components/scheduling/time-cell";
import type { CandidateSlotView } from "@/components/scheduling/types";
import { formatDate, formatTime } from "@/lib/date/timezone";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";
import { Button } from "@/components/ui/button";

export function CandidateTimeGrid({
  slots,
  defaultTimezone,
  selectedSlotIds,
  maxSelectSlots,
  rangeMode,
  rangeStartSlotId,
  onToggleRangeMode,
  onToggleSlot,
  onSelectSlots,
  onClearSlots
}: {
  slots: CandidateSlotView[];
  defaultTimezone: string;
  selectedSlotIds: string[];
  maxSelectSlots: number;
  rangeMode: boolean;
  rangeStartSlotId: string | null;
  onToggleRangeMode: () => void;
  onToggleSlot: (slot: CandidateSlotView, daySlots: CandidateSlotView[]) => void;
  onSelectSlots: (slots: CandidateSlotView[]) => void;
  onClearSlots: (slots: CandidateSlotView[]) => void;
}) {
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const selectedSlotIdSet = useMemo(() => new Set(selectedSlotIds), [selectedSlotIds]);

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
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-subtle p-2">
        <Button
          type="button"
          size="sm"
          variant={rangeMode ? "primary" : "secondary"}
          onClick={onToggleRangeMode}
          className="min-w-28"
        >
          <MousePointerClick className="h-4 w-4" aria-hidden="true" />
          {rangeMode ? (rangeStartSlotId ? "选择结束时间" : "选择开始时间") : "连续选择"}
        </Button>
        {rangeMode ? (
          <Button type="button" size="sm" variant="ghost" onClick={onToggleRangeMode}>
            <X className="h-4 w-4" aria-hidden="true" />
            取消
          </Button>
        ) : null}
      </div>
      {groupedSlots.map(([dateLabel, daySlots]) => (
        <section key={dateLabel} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{dateLabel}</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={
                  selectedSlotIds.length >= maxSelectSlots ||
                  daySlots
                    .filter((slot) => !slot.disabled)
                    .every((slot) => selectedSlotIdSet.has(slot.id))
                }
                onClick={() => onSelectSlots(daySlots)}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                选本日
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!daySlots.some((slot) => selectedSlotIdSet.has(slot.id))}
                onClick={() => onClearSlots(daySlots)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                清空
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {daySlots.map((slot) => (
              <CandidateTimeCell
                key={slot.id}
                label={slot.timeLabel}
                disabled={slot.disabled}
                selected={selectedSlotIdSet.has(slot.id)}
                active={rangeStartSlotId === slot.id}
                onClick={() => onToggleSlot(slot, daySlots)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
