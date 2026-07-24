import { ZonedDateTimeError, zonedDateTimeToUtc } from "@/lib/date/timezone";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const candidateSlotWindowDays = 14;

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !datePattern.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function addCalendarDays(value: string, days: number) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function calendarDayDistance(start: string, end: string) {
  const startAt = new Date(`${start}T00:00:00.000Z`).getTime();
  const endAt = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.round((endAt - startAt) / (24 * 60 * 60 * 1000));
}

function localDateInputValue(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

/**
 * Finds the first valid instant of a local calendar day. Most supported zones
 * start at midnight; probing a few hours also handles rare midnight DST gaps
 * without shifting the selected date backwards.
 */
function startOfLocalDate(date: string, timezone: string) {
  for (let minute = 0; minute < 4 * 60; minute += 1) {
    const hour = Math.floor(minute / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (minute % 60).toString().padStart(2, "0");
    try {
      return zonedDateTimeToUtc(date, `${hour}:${minutes}`, timezone, {
        disambiguation: "earlier"
      });
    } catch (error) {
      if (!(error instanceof ZonedDateTimeError) || error.code === "INVALID") {
        throw error;
      }
    }
  }

  throw new ZonedDateTimeError("NONEXISTENT", `No valid start of day for ${date} in ${timezone}.`);
}

export type CandidateSlotWindow = {
  from: string;
  to: string;
  startAt: Date;
  endAt: Date;
  wasAdjusted: boolean;
};

/**
 * Bounds the public availability picker to a small, explicit local-date
 * window. The database query uses an exclusive end instant, so DST days do
 * not accidentally include a slot from the next local date.
 */
export function resolveCandidateSlotWindow({
  from: requestedFrom,
  to: requestedTo,
  timezone,
  now = new Date()
}: {
  from?: string;
  to?: string;
  timezone: string;
  now?: Date;
}): CandidateSlotWindow {
  const defaultFrom = localDateInputValue(now, timezone);
  const defaultTo = addCalendarDays(defaultFrom, candidateSlotWindowDays - 1);
  const requestedFromIsValid = isCalendarDate(requestedFrom);
  const requestedToIsValid = isCalendarDate(requestedTo);
  const from = requestedFromIsValid ? requestedFrom : defaultFrom;
  const to = requestedToIsValid
    ? requestedTo
    : requestedFromIsValid
      ? addCalendarDays(requestedFrom, candidateSlotWindowDays - 1)
      : defaultTo;
  const withinBounds =
    calendarDayDistance(from, to) >= 0 && calendarDayDistance(from, to) < candidateSlotWindowDays;
  const safeFrom = withinBounds ? from : defaultFrom;
  const safeTo = withinBounds ? to : defaultTo;

  return {
    from: safeFrom,
    to: safeTo,
    startAt: startOfLocalDate(safeFrom, timezone),
    endAt: startOfLocalDate(addCalendarDays(safeTo, 1), timezone),
    wasAdjusted:
      (requestedFrom !== undefined && !requestedFromIsValid) ||
      (requestedTo !== undefined && !requestedToIsValid) ||
      !withinBounds
  };
}
