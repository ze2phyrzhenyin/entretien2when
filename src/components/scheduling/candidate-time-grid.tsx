"use client";

import { useEffect, useMemo, useState } from "react";
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
  const firstDateWithSelection = useMemo(() => {
    const selectedGroup = groupedSlots.find(([, daySlots]) =>
      daySlots.some((slot) => selectedSlotIdSet.has(slot.id))
    );
    return selectedGroup?.[0] ?? groupedSlots[0]?.[0] ?? "";
  }, [groupedSlots, selectedSlotIdSet]);
  const [activeDateLabel, setActiveDateLabel] = useState(firstDateWithSelection);

  useEffect(() => {
    if (!groupedSlots.some(([dateLabel]) => dateLabel === activeDateLabel)) {
      setActiveDateLabel(firstDateWithSelection);
    }
  }, [activeDateLabel, firstDateWithSelection, groupedSlots]);

  const activeGroup =
    groupedSlots.find(([dateLabel]) => dateLabel === activeDateLabel) ?? groupedSlots[0];

  if (groupedSlots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-subtle p-6 text-sm text-muted-foreground">
        当前面试组暂无开放时间，请联系招聘方确认。
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-subtle p-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {groupedSlots.map(([dateLabel, daySlots]) => {
            const selectedCount = daySlots.filter((slot) => selectedSlotIdSet.has(slot.id)).length;
            const openCount = daySlots.filter((slot) => !slot.disabled).length;
            const active = dateLabel === activeGroup?.[0];

            return (
              <button
                key={dateLabel}
                type="button"
                onClick={() => setActiveDateLabel(dateLabel)}
                className={[
                  "min-w-36 rounded-md border px-3 py-2 text-left text-sm transition-colors duration-fast",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground hover:border-primary hover:bg-primary-soft"
                ].join(" ")}
              >
                <span className="block font-semibold">{dateLabel}</span>
                <span className={active ? "text-primary-foreground/80" : "text-muted-foreground"}>
                  已选 {selectedCount} / 可选 {openCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
      {activeGroup ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{activeGroup[0]}</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={
                  selectedSlotIds.length >= maxSelectSlots ||
                  activeGroup[1]
                    .filter((slot) => !slot.disabled)
                    .every((slot) => selectedSlotIdSet.has(slot.id))
                }
                onClick={() => onSelectSlots(activeGroup[1])}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                选择本日
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!activeGroup[1].some((slot) => selectedSlotIdSet.has(slot.id))}
                onClick={() => onClearSlots(activeGroup[1])}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                清空
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {activeGroup[1].map((slot) => (
              <CandidateTimeCell
                key={slot.id}
                label={slot.timeLabel}
                disabled={slot.disabled}
                selected={selectedSlotIdSet.has(slot.id)}
                active={rangeStartSlotId === slot.id}
                onClick={() => onToggleSlot(slot, activeGroup[1])}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
