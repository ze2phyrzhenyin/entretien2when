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

export function zonedDateTimeToUtc(date: string, time: string, timezone = "Asia/Shanghai"): Date {
  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const [hourRaw, minuteRaw] = time.split(":");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("Invalid zoned date time input.");
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const localPartsAtGuess = getTimezoneParts(new Date(utcGuess), timezone);
  const localAsUtc = Date.UTC(
    localPartsAtGuess.year,
    localPartsAtGuess.month - 1,
    localPartsAtGuess.day,
    localPartsAtGuess.hour,
    localPartsAtGuess.minute,
    localPartsAtGuess.second
  );
  const offset = localAsUtc - utcGuess;
  return new Date(utcGuess - offset);
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
