import { AdminRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAccessGroup, isSuperAdmin } from "@/lib/permissions/admin";

describe("permission helpers", () => {
  it("recognizes super admins", () => {
    expect(isSuperAdmin({ role: AdminRole.SUPER_ADMIN })).toBe(true);
    expect(isSuperAdmin({ role: AdminRole.ADMIN })).toBe(false);
  });

  it("only allows super admins to access groups", async () => {
    await expect(canAccessGroup({ role: AdminRole.SUPER_ADMIN }, "group_1")).resolves.toBe(true);
    await expect(canAccessGroup({ role: AdminRole.ADMIN }, "group_1")).resolves.toBe(false);
  });
});
