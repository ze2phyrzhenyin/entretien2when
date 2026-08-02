import type { MessageKey } from "@/i18n/catalogs";

export const DEFAULT_TIMEZONE = "Asia/Shanghai";

export type TimezoneOption = { value: string; label?: string; labelKey?: MessageKey };

export const commonTimezones: ReadonlyArray<TimezoneOption> = [
  { value: "Asia/Shanghai", labelKey: "legacy.china_time_shanghai.b67dd764" },
  { value: "Europe/Paris", labelKey: "legacy.france_time_paris.04282080" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Tokyo", labelKey: "legacy.japan_time_tokyo.8315cacf" },
  { value: "Asia/Singapore", labelKey: "legacy.singapore_time.eb287b8f" },
  { value: "America/New_York", labelKey: "legacy.us_eastern_new_york.4eba6509" },
  { value: "America/Los_Angeles", labelKey: "legacy.us_pacific_los_angeles.019b8a89" },
  { value: "Europe/London", labelKey: "legacy.uk_time_london.0332904e" }
];

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function timezoneOptionsWith(timezone: string) {
  const options: TimezoneOption[] = [...commonTimezones];
  if (timezone && isValidTimezone(timezone) && !options.some((item) => item.value === timezone)) {
    return [{ value: timezone, label: timezone }, ...options];
  }
  return options;
}

export function formatDateTime(date: Date, timezone = "Asia/Shanghai", locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

export function formatDate(date: Date, timezone = "Asia/Shanghai", locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatTime(date: Date, timezone = "Asia/Shanghai", locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

export function formatDateTimeRange(
  startAt: Date,
  endAt: Date,
  timezone = "Asia/Shanghai",
  locale = "zh-CN"
) {
  const sameDate = formatDate(startAt, timezone, locale) === formatDate(endAt, timezone, locale);
  if (sameDate) {
    return `${formatDate(startAt, timezone, locale)} ${formatTime(
      startAt,
      timezone,
      locale
    )}-${formatTime(endAt, timezone, locale)}`;
  }

  return `${formatDateTime(startAt, timezone, locale)} - ${formatDateTime(
    endAt,
    timezone,
    locale
  )}`;
}

export function timezoneDisplayName(timezone: string, locale = "zh-CN") {
  if (timezone === "Asia/Shanghai") {
    return locale.startsWith("en") ? "China Standard Time" : "北京时间";
  }
  return timezone;
}

export function formatDateTimeWithTimezone(
  date: Date,
  timezone = "Asia/Shanghai",
  locale = "zh-CN"
) {
  const formatted = formatDateTime(date, timezone, locale);
  const zone = timezoneDisplayName(timezone, locale);
  return locale.startsWith("en") ? `${formatted} (${zone})` : `${formatted}（${zone}）`;
}

export function formatDateTimeRangeWithTimezone(
  startAt: Date,
  endAt: Date,
  timezone = "Asia/Shanghai",
  locale = "zh-CN"
) {
  const formatted = formatDateTimeRange(startAt, endAt, timezone, locale);
  const zone = timezoneDisplayName(timezone, locale);
  return locale.startsWith("en") ? `${formatted} (${zone})` : `${formatted}（${zone}）`;
}

function getTimezoneParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second"))
  };
}

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type ZonedDateTimeDisambiguation = "earlier" | "later" | "reject";

export class ZonedDateTimeError extends Error {
  constructor(
    public readonly code: "INVALID" | "NONEXISTENT" | "AMBIGUOUS",
    message: string
  ) {
    super(message);
    this.name = "ZonedDateTimeError";
  }
}

function matchesLocalDateTime(candidate: Date, expected: LocalDateTimeParts, timezone: string) {
  const actual = getTimezoneParts(candidate, timezone);
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === 0
  );
}

function timezoneOffsetMinutes(instant: Date, timezone: string) {
  const local = getTimezoneParts(instant, timezone);
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );
  return Math.round((localAsUtc - instant.getTime()) / 60_000);
}

function possibleTimezoneOffsets(utcGuess: number, timezone: string) {
  // An IANA offset can change close to the requested wall time. Sampling both
  // sides of a 48-hour window captures the before/after offsets without making
  // assumptions about a locale's DST rules or a one-hour transition.
  const sampleHours = [-48, -36, -24, -12, -6, 0, 6, 12, 24, 36, 48];
  return [
    ...new Set(
      sampleHours.map((hours) =>
        timezoneOffsetMinutes(new Date(utcGuess + hours * 60 * 60 * 1000), timezone)
      )
    )
  ];
}

function parseLocalDateTime(date: string, time: string): LocalDateTimeParts {
  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const [hourRaw, minuteRaw] = time.split(":");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(time) ||
    ![year, month, day, hour, minute].every(Number.isInteger) ||
    month < 1 ||
    month > 12 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new ZonedDateTimeError("INVALID", "Invalid local date/time input.");
  }

  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new ZonedDateTimeError("INVALID", "Invalid local calendar date.");
  }

  return { year, month, day, hour, minute };
}

/**
 * Convert a local IANA wall time to an instant without guessing across DST.
 * Gaps are rejected. Repeated wall times require an explicit earlier/later
 * policy; callers default to reject so one displayed time cannot silently map
 * to an unintended interview slot.
 */
export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timezone = "Asia/Shanghai",
  { disambiguation = "reject" }: { disambiguation?: ZonedDateTimeDisambiguation } = {}
): Date {
  if (!isValidTimezone(timezone)) {
    throw new ZonedDateTimeError("INVALID", `Invalid IANA timezone: ${timezone}`);
  }

  const local = parseLocalDateTime(date, time);
  const utcGuess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
  const candidates = possibleTimezoneOffsets(utcGuess, timezone)
    .map((offsetMinutes) => new Date(utcGuess - offsetMinutes * 60_000))
    .filter((candidate) => matchesLocalDateTime(candidate, local, timezone))
    .sort((left, right) => left.getTime() - right.getTime());

  if (candidates.length === 0) {
    throw new ZonedDateTimeError(
      "NONEXISTENT",
      `${date} ${time} does not exist in ${timezone} because of a daylight-saving transition.`
    );
  }

  if (candidates.length > 1) {
    if (disambiguation === "earlier") {
      return candidates[0]!;
    }
    if (disambiguation === "later") {
      return candidates[candidates.length - 1]!;
    }
    throw new ZonedDateTimeError(
      "AMBIGUOUS",
      `${date} ${time} occurs more than once in ${timezone} because of a daylight-saving transition.`
    );
  }

  return candidates[0]!;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesSinceMidnight(time: string) {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return Number.NaN;
  }
  return hour * 60 + minute;
}

export function dateRangeDates(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addMinutes(cursor, 24 * 60)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}
