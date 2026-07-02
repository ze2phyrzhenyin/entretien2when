"use client";

import { formatDateTime, formatDateTimeRange } from "@/lib/date/timezone";
import { timezoneLabel } from "@/components/timezone/timezone-store";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";

type ZonedDateTimeRangeProps = {
  startAt: string;
  endAt: string;
  defaultTimezone: string;
  showTimezone?: boolean;
};

export function ZonedDateTimeRange({
  startAt,
  endAt,
  defaultTimezone,
  showTimezone = false
}: ZonedDateTimeRangeProps) {
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const label = formatDateTimeRange(new Date(startAt), new Date(endAt), timezone);

  return (
    <span>
      {label}
      {showTimezone ? (
        <span className="ml-1 text-muted-foreground">({timezoneLabel(timezone)})</span>
      ) : null}
    </span>
  );
}

export function ZonedDateTime({
  value,
  defaultTimezone,
  showTimezone = false
}: {
  value: string;
  defaultTimezone: string;
  showTimezone?: boolean;
}) {
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const label = formatDateTime(new Date(value), timezone);

  return (
    <span>
      {label}
      {showTimezone ? (
        <span className="ml-1 text-muted-foreground">({timezoneLabel(timezone)})</span>
      ) : null}
    </span>
  );
}
