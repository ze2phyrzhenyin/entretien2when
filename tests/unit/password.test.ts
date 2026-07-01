import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("stores passwords as scrypt hashes and verifies them", async () => {
    const hash = await hashPassword("Str0ng-password-for-admin");

    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Str0ng-password-for-admin");
    await expect(verifyPassword("Str0ng-password-for-admin", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
