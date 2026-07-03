import { AdminTimeCell } from "@/components/scheduling/time-cell";
import type { AdminSlotView } from "@/components/scheduling/types";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";

export function AdminTimeGrid({
  slots,
  defaultTimezone
}: {
  slots: AdminSlotView[];
  defaultTimezone: string;
}) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-subtle p-6 text-sm text-muted-foreground">
        暂无开放时间。
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {slots.map((slot) => (
        <AdminTimeCell
          key={slot.id}
          label={
            <ZonedDateTimeRange
              startAt={slot.startAt}
              endAt={slot.endAt}
              defaultTimezone={defaultTimezone}
            />
          }
          status={slot.status}
          count={slot.availableCandidateCount}
          detail={slot.lockReasonInternal ?? slot.candidates?.[0]?.name}
        />
      ))}
    </div>
  );
}
