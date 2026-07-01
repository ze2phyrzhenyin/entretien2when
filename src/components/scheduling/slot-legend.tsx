import { StatusBadge } from "@/components/design-system/status-badge";

export function CandidateSlotLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <StatusBadge kind="custom" label="可选" tone="neutral" />
      <StatusBadge kind="custom" label="已选择" tone="primary" />
      <StatusBadge kind="slot" status="UNAVAILABLE" />
    </div>
  );
}

export function AdminSlotLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <StatusBadge kind="slot" status="OPEN" />
      <StatusBadge kind="slot" status="CLOSED" />
      <StatusBadge kind="slot" status="LOCKED" />
      <StatusBadge kind="custom" label="已预约" tone="scheduled" />
    </div>
  );
}
