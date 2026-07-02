import { describe, expect, it } from "vitest";
import { batchGenerateSlotsSchema } from "@/lib/validation/slot";

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
});
