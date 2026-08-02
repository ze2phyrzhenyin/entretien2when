"use client";
import { useLocale } from "@/i18n/locale-provider";
import { Card } from "@/components/ui/card";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import type { TimeRangeItem } from "@/components/scheduling/types";
export function TimeRangePreview({
  items,
  defaultTimezone
}: {
  items: TimeRangeItem[];
  defaultTimezone: string;
}) {
  const { t } = useLocale();
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("legacy.no_time_yet.e4aabe4b")}</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id} className="px-3 py-2 text-sm" variant="subtle">
          <ZonedDateTimeRange
            startAt={item.startAt}
            endAt={item.endAt}
            defaultTimezone={defaultTimezone}
          />
        </Card>
      ))}
    </div>
  );
}
