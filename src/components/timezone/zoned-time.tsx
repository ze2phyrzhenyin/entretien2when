"use client";

import { formatDateTime, formatDateTimeRange } from "@/lib/date/timezone";
import { timezoneLabel } from "@/components/timezone/timezone-store";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";
import { useLocale } from "@/i18n/locale-provider";
import type { MessageKey } from "@/i18n/catalogs";

type ZonedDateTimeRangeProps = {
  startAt: string;
  endAt: string;
  defaultTimezone: string;
  showTimezone?: boolean;
  messageKey?: MessageKey;
};

export function ZonedDateTimeRange({
  startAt,
  endAt,
  defaultTimezone,
  showTimezone = false,
  messageKey
}: ZonedDateTimeRangeProps) {
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const { locale, t } = useLocale();
  const label = formatDateTimeRange(new Date(startAt), new Date(endAt), timezone, locale);
  const displayValue = showTimezone ? `${label} (${timezoneLabel(timezone)})` : label;

  return <span>{messageKey ? t(messageKey, { value: displayValue }) : displayValue}</span>;
}

export function ZonedDateTime({
  value,
  defaultTimezone,
  showTimezone = false,
  messageKey
}: {
  value: string;
  defaultTimezone: string;
  showTimezone?: boolean;
  messageKey?: MessageKey;
}) {
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const { locale, t } = useLocale();
  const label = formatDateTime(new Date(value), timezone, locale);
  const displayValue = showTimezone ? `${label} (${timezoneLabel(timezone)})` : label;

  return <span>{messageKey ? t(messageKey, { value: displayValue }) : displayValue}</span>;
}
