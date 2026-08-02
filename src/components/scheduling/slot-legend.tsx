"use client";

import { useLocale } from "@/i18n/locale-provider";
import { StatusBadge } from "@/components/design-system/status-badge";
export function CandidateSlotLegend() {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <StatusBadge kind="custom" label={t("legacy.optional.53735240")} tone="neutral" />
      <StatusBadge kind="custom" label={t("legacy.selected.3f4ebc4a")} tone="primary" />
      <StatusBadge kind="slot" status="UNAVAILABLE" />
    </div>
  );
}
export function AdminSlotLegend() {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <StatusBadge kind="slot" status="OPEN" />
      <StatusBadge kind="slot" status="CLOSED" />
      <StatusBadge kind="slot" status="LOCKED" />
      <StatusBadge kind="custom" label={t("legacy.scheduled.2fcab8f6")} tone="scheduled" />
    </div>
  );
}
