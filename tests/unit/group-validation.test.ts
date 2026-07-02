import { describe, expect, it } from "vitest";
import { groupFormSchema } from "@/lib/validation/group";

const validGroupInput = {
  name: "产品经理一面",
  publicDescription: "",
  timezone: "Asia/Shanghai",
  status: "OPEN",
  slotDurationMinutes: "31",
  interviewDurationMinutes: "26",
  minSelectSlots: "1",
  maxSelectSlots: "6"
};

describe("group validation", () => {
  it("accepts custom minute durations", () => {
    const result = groupFormSchema.safeParse(validGroupInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slotDurationMinutes).toBe(31);
      expect(result.data.interviewDurationMinutes).toBe(26);
    }
  });

  it("requires interview duration to be shorter than the selectable slot", () => {
    const result = groupFormSchema.safeParse({
      ...validGroupInput,
      slotDurationMinutes: "30",
      interviewDurationMinutes: "30"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.interviewDurationMinutes?.[0]).toBe(
        "面试时长必须短于时间粒度"
      );
    }
  });
});
