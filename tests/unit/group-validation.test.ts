import { describe, expect, it } from "vitest";
import { groupFormSchema } from "@/lib/validation/group";

const validGroupInput = {
  name: "产品经理一面",
  publicDescription: "",
  timezone: "Asia/Shanghai",
  status: "OPEN",
  slotDurationMinutes: "10",
  interviewDurationMinutes: "45",
  minSelectSlots: "1",
  maxSelectSlots: "6"
};

describe("group validation", () => {
  it("accepts common 5-minute based durations", () => {
    const result = groupFormSchema.safeParse(validGroupInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slotDurationMinutes).toBe(10);
      expect(result.data.interviewDurationMinutes).toBe(45);
    }
  });

  it("rejects durations that are not 5-minute multiples", () => {
    const result = groupFormSchema.safeParse({
      ...validGroupInput,
      slotDurationMinutes: "7"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.slotDurationMinutes?.[0]).toBe(
        "时间粒度必须是 5 分钟的倍数"
      );
    }
  });
});
