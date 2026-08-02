import { getServerTranslator } from "@/i18n/server";
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
export async function ReviewComparison({
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
  const { t } = await getServerTranslator();
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="p-5" variant="flat">
        <h3 className="font-semibold">{t("legacy.old_version.fe6e0f55")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("legacy.currently_still_valid.00883ef8")}
        </p>
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
            <p className="text-sm text-muted-foreground">{t("legacy.no_old_version.7343863e")}</p>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">{t("legacy.old_remarks.1aba9523")}</p>
          <p className="mt-2 rounded-lg bg-surface-subtle p-3 text-sm">
            {oldNote || t("legacy.not_filled_in.7f051905")}
          </p>
        </div>
      </Card>

      <Card className="p-5" variant="flat">
        <h3 className="font-semibold">{t("legacy.new_version.47ceaf50")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("legacy.it_will_take_effect_only_after_it_is_approved.5d2f9909")}
        </p>
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
                  <StatusBadge kind="custom" label={t("legacy.new.0006d696")} tone="primary" />
                ) : slot.change === "removed" ? (
                  <StatusBadge kind="custom" label={t("legacy.remove.6135d415")} tone="neutral" />
                ) : (
                  <StatusBadge kind="custom" label={t("legacy.reserve.670ec25a")} tone="success" />
                )}
              </div>
              {slot.blockedReason ? (
                <p className="mt-1 text-xs text-danger">{slot.blockedReason}</p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">{t("legacy.new_note.e81aa8c5")}</p>
          <p className="mt-2 rounded-lg bg-surface-subtle p-3 text-sm">
            {newNote || t("legacy.not_filled_in.7f051905")}
          </p>
        </div>
      </Card>
    </div>
  );
}
