"use client";

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
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无时间。</p>;
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
