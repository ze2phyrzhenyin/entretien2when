import { StatusBadge } from "@/components/design-system/status-badge";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Card } from "@/components/ui/card";
import type { TimeRangeItem } from "@/components/scheduling/types";

export type ReviewSlotChange = {
  id: string;
  startAt: string;
  endAt: string;
  change: "added" | "removed" | "unchanged";
  blockedReason?: string | null;
};

export function ReviewComparison({
  oldSlots,
  changes,
  defaultTimezone,
  oldNote,
  newNote
}: {
  oldSlots: TimeRangeItem[];
  changes: ReviewSlotChange[];
  defaultTimezone: string;
  oldNote?: string | null;
  newNote?: string | null;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="p-5" variant="flat">
        <h3 className="font-semibold">旧版本</h3>
        <p className="mt-1 text-sm text-muted-foreground">当前仍然有效</p>
        <div className="mt-4 space-y-2">
          {oldSlots.length > 0 ? (
            oldSlots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm"
              >
                <ZonedDateTimeRange
                  startAt={slot.startAt}
                  endAt={slot.endAt}
                  defaultTimezone={defaultTimezone}
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">无旧版本</p>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">旧备注</p>
          <p className="mt-2 rounded-lg bg-surface-subtle p-3 text-sm">{oldNote || "未填写"}</p>
        </div>
      </Card>

      <Card className="p-5" variant="flat">
        <h3 className="font-semibold">新版本</h3>
        <p className="mt-1 text-sm text-muted-foreground">审核通过后才会生效</p>
        <div className="mt-4 space-y-2">
          {changes.map((slot) => (
            <div
              key={`${slot.id}-${slot.change}`}
              className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span>
                  <ZonedDateTimeRange
                    startAt={slot.startAt}
                    endAt={slot.endAt}
                    defaultTimezone={defaultTimezone}
                  />
                </span>
                {slot.change === "added" ? (
                  <StatusBadge kind="custom" label="新增" tone="primary" />
                ) : slot.change === "removed" ? (
                  <StatusBadge kind="custom" label="移除" tone="neutral" />
                ) : (
                  <StatusBadge kind="custom" label="保留" tone="success" />
                )}
              </div>
              {slot.blockedReason ? (
                <p className="mt-1 text-xs text-danger">{slot.blockedReason}</p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">新备注</p>
          <p className="mt-2 rounded-lg bg-surface-subtle p-3 text-sm">{newNote || "未填写"}</p>
        </div>
      </Card>
    </div>
  );
}
