"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/date/timezone";
import { cn } from "@/lib/utils";

type AppointmentSlotPickerSlot = {
  id: string;
  startAt: string;
  endAt: string;
  status: "OPEN" | "CLOSED";
  isCurrent?: boolean;
  lockedByOther?: boolean;
};

type PeriodKey = "all" | "morning" | "afternoon" | "evening";

const periodOptions: Array<{ key: PeriodKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "morning", label: "上午" },
  { key: "afternoon", label: "下午" },
  { key: "evening", label: "晚上" }
];

function periodOf(timeLabel: string): PeriodKey {
  const hour = Number(timeLabel.slice(0, 2));
  if (hour < 12) {
    return "morning";
  }
  if (hour < 18) {
    return "afternoon";
  }
  return "evening";
}

export function AppointmentSlotPicker({
  slots,
  defaultTimezone,
  initiallySelectedSlotIds = []
}: {
  slots: AppointmentSlotPickerSlot[];
  defaultTimezone: string;
  initiallySelectedSlotIds?: string[];
}) {
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const [selectedIds, setSelectedIds] = useState(initiallySelectedSlotIds);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [query, setQuery] = useState("");

  const slotViews = useMemo(
    () =>
      slots.map((slot) => {
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);
        const timeLabel = `${formatTime(start, timezone)}-${formatTime(end, timezone)}`;
        return {
          ...slot,
          dateLabel: formatDate(start, timezone),
          timeLabel,
          period: periodOf(timeLabel),
          selectable: !slot.lockedByOther && (slot.status === "OPEN" || Boolean(slot.isCurrent))
        };
      }),
    [slots, timezone]
  );

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, typeof slotViews>();
    for (const slot of slotViews) {
      groups.set(slot.dateLabel, [...(groups.get(slot.dateLabel) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [slotViews]);

  const firstSelectedDate =
    groupedSlots.find(([, daySlots]) =>
      daySlots.some((slot) => selectedIds.includes(slot.id))
    )?.[0] ??
    groupedSlots[0]?.[0] ??
    "";
  const [activeDate, setActiveDate] = useState(firstSelectedDate);

  useEffect(() => {
    if (!groupedSlots.some(([dateLabel]) => dateLabel === activeDate)) {
      setActiveDate(firstSelectedDate);
    }
  }, [activeDate, firstSelectedDate, groupedSlots]);

  const activeSlots = groupedSlots.find(([dateLabel]) => dateLabel === activeDate)?.[1] ?? [];
  const normalizedQuery = query.trim();
  const visibleSlots = activeSlots.filter((slot) => {
    const matchesPeriod = period === "all" || slot.period === period;
    const matchesQuery =
      !normalizedQuery ||
      slot.timeLabel.includes(normalizedQuery) ||
      slot.dateLabel.includes(normalizedQuery);
    return matchesPeriod && matchesQuery;
  });
  const visibleSlotIds = new Set(visibleSlots.map((slot) => slot.id));
  const selectedHiddenIds = selectedIds.filter((slotId) => !visibleSlotIds.has(slotId));

  function setSlotSelected(slotId: string, selected: boolean) {
    setSelectedIds((current) =>
      selected
        ? current.includes(slotId)
          ? current
          : [...current, slotId]
        : current.filter((id) => id !== slotId)
    );
  }

  function selectVisibleSlots() {
    const selectableIds = visibleSlots.filter((slot) => slot.selectable).map((slot) => slot.id);
    setSelectedIds((current) => [...new Set([...current, ...selectableIds])]);
  }

  function clearVisibleSlots() {
    const visibleIds = new Set(visibleSlots.map((slot) => slot.id));
    setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-subtle p-3">
      {selectedHiddenIds.map((slotId) => (
        <input key={slotId} type="hidden" name="slotIds" value={slotId} />
      ))}

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {groupedSlots.map(([dateLabel, daySlots]) => {
            const selectedCount = daySlots.filter((slot) => selectedIds.includes(slot.id)).length;
            const selectableCount = daySlots.filter((slot) => slot.selectable).length;
            const active = dateLabel === activeDate;

            return (
              <button
                key={dateLabel}
                type="button"
                onClick={() => setActiveDate(dateLabel)}
                className={cn(
                  "min-w-[9.75rem] rounded-md border px-3 py-2 text-left text-sm transition-colors duration-fast",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white text-foreground hover:border-primary hover:bg-primary-soft"
                )}
              >
                <span className="block font-semibold">{dateLabel}</span>
                <span
                  className={cn(
                    "block whitespace-nowrap text-xs",
                    active ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  已选 {selectedCount} / 可选 {selectableCount}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索时间，如 15:00"
            className="h-11 pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={period === item.key ? "primary" : "secondary"}
              onClick={() => setPeriod(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={selectVisibleSlots}>
            <Check className="h-4 w-4" aria-hidden="true" />
            选择当前结果
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearVisibleSlots}>
            清除当前结果
          </Button>
        </div>
      </div>

      {visibleSlots.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-white p-5 text-sm text-muted-foreground">
          当前日期和筛选条件下没有可显示的开放时间。
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {visibleSlots.map((slot) => {
            const selected = selectedIds.includes(slot.id);
            return (
              <label
                key={slot.id}
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-md border p-2 text-sm transition-colors duration-fast",
                  slot.selectable
                    ? selected
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-white"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                <Checkbox
                  key={`${slot.id}:${selected ? "selected" : "empty"}`}
                  name="slotIds"
                  value={slot.id}
                  defaultChecked={selected}
                  disabled={!slot.selectable}
                  onChange={(event) => setSlotSelected(slot.id, event.currentTarget.checked)}
                  aria-label={`选择 ${slot.dateLabel} ${slot.timeLabel}`}
                />
                <span className="min-w-0 flex-1 font-medium">{slot.timeLabel}</span>
                {slot.isCurrent ? (
                  <Badge tone="scheduled">当前</Badge>
                ) : slot.lockedByOther ? (
                  <Badge tone="locked">已锁定</Badge>
                ) : slot.status === "CLOSED" ? (
                  <Badge tone="neutral">关闭</Badge>
                ) : null}
              </label>
            );
          })}
        </div>
      )}

      <div className="rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
        已选择 {selectedIds.length} 个开放时间。请选择连续开放时间以组成面试时段。
      </div>
    </div>
  );
}
