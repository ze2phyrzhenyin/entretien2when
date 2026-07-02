import { describe, expect, it } from "vitest";
import {
  formatDateTimeRange,
  formatTime,
  isValidTimezone,
  zonedDateTimeToUtc
} from "@/lib/date/timezone";

describe("timezone display", () => {
  it("converts a group-local date time to UTC storage", () => {
    const utc = zonedDateTimeToUtc("2026-07-08", "09:00", "Asia/Shanghai");

    expect(utc.toISOString()).toBe("2026-07-08T01:00:00.000Z");
  });

  it("displays the same UTC instant in different timezones", () => {
    const value = new Date("2026-07-08T01:00:00.000Z");

    expect(formatTime(value, "Asia/Shanghai")).toBe("09:00");
    expect(formatTime(value, "Europe/Paris")).toBe("03:00");
  });

  it("formats ranges using the selected timezone", () => {
    const start = new Date("2026-07-08T01:00:00.000Z");
    const end = new Date("2026-07-08T02:00:00.000Z");

    expect(formatDateTimeRange(start, end, "Asia/Shanghai")).toContain("09:00-10:00");
    expect(formatDateTimeRange(start, end, "Europe/Paris")).toContain("03:00-04:00");
  });

  it("validates IANA timezone names", () => {
    expect(isValidTimezone("Europe/Paris")).toBe(true);
    expect(isValidTimezone("Not/A-Timezone")).toBe(false);
  });
});
