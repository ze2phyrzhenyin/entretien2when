import { describe, expect, it } from "vitest";
import {
  batchGenerateSlotsSchema,
  isSlotGenerationWithinLimits,
  MAX_SLOT_GENERATION_DAYS,
  MAX_SLOT_GENERATION_ROWS
} from "@/lib/validation/slot";

describe("slot validation", () => {
  it("generates slots without weekday selection", () => {
    const result = batchGenerateSlotsSchema.safeParse({
      dateFrom: "2026-08-03",
      dateTo: "2026-08-05",
      startTime: "09:00",
      endTime: "12:00"
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid or oversized calendar ranges before slot expansion", () => {
    expect(
      batchGenerateSlotsSchema.safeParse({
        dateFrom: "2026-02-30",
        dateTo: "2026-03-01",
        startTime: "09:00",
        endTime: "12:00"
      }).success
    ).toBe(false);

    expect(
      batchGenerateSlotsSchema.safeParse({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-01",
        startTime: "99:99",
        endTime: "12:00"
      }).success
    ).toBe(false);

    expect(
      batchGenerateSlotsSchema.safeParse({
        dateFrom: "2026-01-01",
        dateTo: "2026-04-01",
        startTime: "09:00",
        endTime: "12:00"
      }).success
    ).toBe(false);
  });

  it("bounds both day count and expanded row count for action-layer defense", () => {
    expect(isSlotGenerationWithinLimits(MAX_SLOT_GENERATION_DAYS, 1)).toBe(true);
    expect(isSlotGenerationWithinLimits(MAX_SLOT_GENERATION_DAYS + 1, 1)).toBe(false);
    expect(isSlotGenerationWithinLimits(1, MAX_SLOT_GENERATION_ROWS)).toBe(true);
    expect(isSlotGenerationWithinLimits(1, MAX_SLOT_GENERATION_ROWS + 1)).toBe(false);
  });
});
