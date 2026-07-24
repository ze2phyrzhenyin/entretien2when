export const DEFAULT_TIMEZONE = "Asia/Shanghai";

export const commonTimezones = [
  { value: "Asia/Shanghai", label: "中国时间 / 上海" },
  { value: "Europe/Paris", label: "法国时间 / 巴黎" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Tokyo", label: "日本时间 / 东京" },
  { value: "Asia/Singapore", label: "新加坡时间" },
  { value: "America/New_York", label: "美国东部 / 纽约" },
  { value: "America/Los_Angeles", label: "美国西部 / 洛杉矶" },
  { value: "Europe/London", label: "英国时间 / 伦敦" }
] as const;

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function timezoneOptionsWith(timezone: string) {
  const options = [...commonTimezones];
  if (timezone && isValidTimezone(timezone) && !options.some((item) => item.value === timezone)) {
    return [{ value: timezone, label: timezone }, ...options];
  }
  return options;
}

export function formatDateTime(date: Date, timezone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

export function formatDate(date: Date, timezone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatTime(date: Date, timezone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

export function formatDateTimeRange(startAt: Date, endAt: Date, timezone = "Asia/Shanghai") {
  const sameDate = formatDate(startAt, timezone) === formatDate(endAt, timezone);
  if (sameDate) {
    return `${formatDate(startAt, timezone)} ${formatTime(startAt, timezone)}-${formatTime(
      endAt,
      timezone
    )}`;
  }

  return `${formatDateTime(startAt, timezone)} - ${formatDateTime(endAt, timezone)}`;
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
