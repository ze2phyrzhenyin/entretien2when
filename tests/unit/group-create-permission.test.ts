import { AdminRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  transaction: vi.fn(),
  generateUniqueGroupCode: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/server/services/group-code", () => ({
  generateUniqueGroupCode: mocks.generateUniqueGroupCode
}));

import { createGroupAction } from "@/server/actions/group";

describe("group creation authorization", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
  });

  it("denies a regular admin before group-code generation or database writes", async () => {
    mocks.requireAdmin.mockResolvedValue({
      id: "admin_regular",
      role: AdminRole.ADMIN
    });

    await expect(createGroupAction({}, new FormData())).rejects.toThrow("仅超级管理员");

    expect(mocks.generateUniqueGroupCode).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
