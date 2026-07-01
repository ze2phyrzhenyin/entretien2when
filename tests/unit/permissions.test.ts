import { AdminRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isSuperAdmin } from "@/lib/permissions/admin";

describe("permission helpers", () => {
  it("recognizes super admins", () => {
    expect(isSuperAdmin({ role: AdminRole.SUPER_ADMIN })).toBe(true);
    expect(isSuperAdmin({ role: AdminRole.ADMIN })).toBe(false);
  });
});
