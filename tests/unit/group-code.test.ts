import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUP_CODE_GROUP_LENGTH,
  DEFAULT_GROUP_CODE_GROUPS,
  GROUP_CODE_ALPHABET,
  generateGroupCode,
  isValidGroupCode,
  normalizeGroupCode
} from "@/lib/group-code/generate";
import { candidateAccessRequestSchema } from "@/lib/validation/candidate";

describe("group code generator", () => {
  it("generates a 20-character grouped code", () => {
    const code = generateGroupCode();

    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
    expect(code.replaceAll("-", "")).toHaveLength(
      DEFAULT_GROUP_CODE_GROUPS * DEFAULT_GROUP_CODE_GROUP_LENGTH
    );
  });

  it("excludes ambiguous characters", () => {
    const ambiguous = new Set(["O", "0", "I", "1", "L"]);

    for (let index = 0; index < 200; index += 1) {
      const compact = generateGroupCode().replaceAll("-", "");
      expect([...compact].every((char) => GROUP_CODE_ALPHABET.includes(char))).toBe(true);
      expect([...compact].some((char) => ambiguous.has(char))).toBe(false);
    }
  });

  it("normalizes pasted codes with or without dashes", () => {
    expect(normalizeGroupCode(" k7q9m2td8f6pw4zxn3cy ")).toBe("K7Q9-M2TD-8F6P-W4ZX-N3CY");
  });

  it("validates only full strong group codes", () => {
    expect(isValidGroupCode("K7Q9-M2TD-8F6P-W4ZX-N3CY")).toBe(true);
    expect(isValidGroupCode("K7Q9-M2TD-8F6P-W4ZX")).toBe(false);
    expect(isValidGroupCode("K7Q9-M2TD-8F6P-W4ZX-N0CY")).toBe(false);
    expect(isValidGroupCode("$K7Q9-M2TD-8F6P-W4ZX-N3CY")).toBe(false);
    expect(isValidGroupCode("K7Q9-".repeat(20))).toBe(false);
  });

  it("applies the strong group-code validation on the server-side access request schema", () => {
    const candidate = {
      name: "测试候选人",
      email: "candidate@example.com"
    };

    expect(
      candidateAccessRequestSchema.safeParse({
        ...candidate,
        groupCode: "K7Q9-M2TD-8F6P-W4ZX-N3CY"
      }).success
    ).toBe(true);
    expect(
      candidateAccessRequestSchema.safeParse({
        ...candidate,
        groupCode: "$K7Q9-M2TD-8F6P-W4ZX-N3CY"
      }).success
    ).toBe(false);
    expect(
      candidateAccessRequestSchema.safeParse({
        ...candidate,
        groupCode: "K7Q9-".repeat(20)
      }).success
    ).toBe(false);
  });
});
