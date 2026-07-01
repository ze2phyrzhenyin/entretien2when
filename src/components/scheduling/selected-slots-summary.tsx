export function SelectedSlotsSummary({
  selectedCount,
  minSelectSlots,
  maxSelectSlots
}: {
  selectedCount: number;
  minSelectSlots: number;
  maxSelectSlots: number;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-sm sm:flex-row sm:items-center">
      <span className="text-muted-foreground">
        已选择 {selectedCount} 个，最少 {minSelectSlots} 个，最多 {maxSelectSlots} 个
      </span>
      {selectedCount >= maxSelectSlots ? (
        <span className="font-medium text-warning">已达到最多可选数量</span>
      ) : null}
    </div>
  );
}
