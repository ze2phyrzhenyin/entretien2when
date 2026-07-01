import { AdminTimeCell } from "@/components/scheduling/time-cell";
import type { AdminSlotView } from "@/components/scheduling/types";

export function AdminTimeGrid({ slots }: { slots: AdminSlotView[] }) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-subtle p-6 text-sm text-muted-foreground">
        当前还没有时间段。
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {slots.map((slot) => (
        <AdminTimeCell
          key={slot.id}
          label={slot.timeLabel}
          status={slot.status}
          count={slot.availableCandidateCount}
          detail={slot.lockReasonInternal ?? slot.candidates?.[0]?.name}
        />
      ))}
    </div>
  );
}
