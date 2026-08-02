"use client";

import { useLocale } from "@/i18n/locale-provider";
export function SelectedSlotsSummary({
  selectedCount,
  minSelectSlots,
  maxSelectSlots
}: {
  selectedCount: number;
  minSelectSlots: number;
  maxSelectSlots: number;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-sm sm:flex-row sm:items-center">
      <span className="text-muted-foreground">
        {t("selection.slotSummary", {
          selected: selectedCount,
          minimum: minSelectSlots,
          maximum: maxSelectSlots
        })}
      </span>
      {selectedCount >= maxSelectSlots ? (
        <span className="font-medium text-warning">
          {t("legacy.the_maximum_number_of_options_has_been_reached.b5826a56")}
        </span>
      ) : null}
    </div>
  );
}
