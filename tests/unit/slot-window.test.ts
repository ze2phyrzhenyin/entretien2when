import { describe, expect, it } from "vitest";
import { candidateSlotWindowDays, resolveCandidateSlotWindow } from "@/lib/date/slot-window";

describe("candidate slot date window", () => {
  it("uses an inclusive local-date window and DST-safe exclusive end", () => {
    const window = resolveCandidateSlotWindow({
      from: "2026-03-28",
      to: "2026-03-29",
      timezone: "Europe/Paris"
    });

    expect(window.wasAdjusted).toBe(false);
    expect(window.startAt.toISOString()).toBe("2026-03-27T23:00:00.000Z");
    expect(window.endAt.toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("defaults to a bounded window and rejects malformed or oversized input", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    const defaultWindow = resolveCandidateSlotWindow({ timezone: "Asia/Shanghai", now });
    const invalidWindow = resolveCandidateSlotWindow({
      from: "2026-02-31",
      to: "2026-12-31",
      timezone: "Asia/Shanghai",
      now
    });

    expect(defaultWindow.from).toBe("2026-07-24");
    expect(defaultWindow.to).toBe("2026-08-06");
    expect(invalidWindow).toMatchObject({
      from: defaultWindow.from,
      to: defaultWindow.to,
      wasAdjusted: true
    });
    expect(candidateSlotWindowDays).toBe(14);
  });

  it("derives a complete window from a valid starting date without treating it as an error", () => {
    const window = resolveCandidateSlotWindow({
      from: "2026-08-01",
      timezone: "Asia/Shanghai"
    });

    expect(window).toMatchObject({
      from: "2026-08-01",
      to: "2026-08-14",
      wasAdjusted: false
    });
  });
});
