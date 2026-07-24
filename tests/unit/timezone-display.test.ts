import { describe, expect, it } from "vitest";
import {
  formatDateTimeRange,
  formatTime,
  isValidTimezone,
  ZonedDateTimeError,
  zonedDateTimeToUtc
} from "@/lib/date/timezone";

describe("timezone display", () => {
  it("converts a group-local date time to UTC storage", () => {
    const utc = zonedDateTimeToUtc("2026-07-08", "09:00", "Asia/Shanghai");

    expect(utc.toISOString()).toBe("2026-07-08T01:00:00.000Z");
  });

  it("converts the hour before the Paris spring-forward boundary correctly", () => {
    const utc = zonedDateTimeToUtc("2026-03-29", "01:00", "Europe/Paris");

    expect(utc.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(formatTime(utc, "Europe/Paris")).toBe("01:00");
  });

  it("rejects a nonexistent local time during the spring-forward gap", () => {
    expect(() => zonedDateTimeToUtc("2026-03-29", "02:30", "Europe/Paris")).toThrow(
      ZonedDateTimeError
    );
    expect(() => zonedDateTimeToUtc("2026-03-29", "02:30", "Europe/Paris")).toThrow(
      /does not exist/
    );
  });

  it("requires an explicit policy for a repeated fall-back local time", () => {
    expect(() => zonedDateTimeToUtc("2026-10-25", "02:30", "Europe/Paris")).toThrow(
      /occurs more than once/
    );
    expect(
      zonedDateTimeToUtc("2026-10-25", "02:30", "Europe/Paris", {
        disambiguation: "earlier"
      }).toISOString()
    ).toBe("2026-10-25T00:30:00.000Z");
    expect(
      zonedDateTimeToUtc("2026-10-25", "02:30", "Europe/Paris", {
        disambiguation: "later"
      }).toISOString()
    ).toBe("2026-10-25T01:30:00.000Z");
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
