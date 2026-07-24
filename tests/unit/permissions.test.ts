import { AdminGroupRole, AdminRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accessibleGroupWhere,
  accessibleProjectWhere,
  canAccessGroup,
  canAccessProject,
  getAdminNavigationCapabilities,
  getGroupCapabilities,
  isSuperAdmin,
  requireSuperAdmin
} from "@/lib/permissions/admin";

const mocks = vi.hoisted(() => ({
  groupMembershipFindFirst: vi.fn(),
  groupMembershipFindMany: vi.fn(),
  projectFindFirst: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminGroupMembership: {
      findFirst: mocks.groupMembershipFindFirst,
      findMany: mocks.groupMembershipFindMany
    },
    interviewProject: {
      findFirst: mocks.projectFindFirst
    }
  }
}));

describe("permission helpers", () => {
  beforeEach(() => {
    mocks.groupMembershipFindFirst.mockReset();
    mocks.groupMembershipFindMany.mockReset();
    mocks.projectFindFirst.mockReset();
  });

  it("recognizes super admins", () => {
    expect(isSuperAdmin({ role: AdminRole.SUPER_ADMIN })).toBe(true);
    expect(isSuperAdmin({ role: AdminRole.ADMIN })).toBe(false);
  });

  it("builds a role-bound group scope for regular admins", () => {
    expect(
      accessibleGroupWhere({ id: "admin_2", role: AdminRole.ADMIN }, [AdminGroupRole.REVIEWER])
    ).toEqual({
      adminMemberships: {
        some: {
          adminId: "admin_2",
          role: { in: [AdminGroupRole.REVIEWER] }
        }
      }
    });
  });

  it("builds a project scope only through authorized groups", () => {
    expect(
      accessibleProjectWhere({ id: "admin_2", role: AdminRole.ADMIN }, [AdminGroupRole.SCHEDULER])
    ).toEqual({
      groups: {
        some: {
          adminMemberships: {
            some: {
              adminId: "admin_2",
              role: { in: [AdminGroupRole.SCHEDULER] }
            }
          }
        }
      }
    });
  });

  it("gives super admins an unscoped query and keeps group creation super-admin-only", () => {
    expect(accessibleGroupWhere({ id: "admin_1", role: AdminRole.SUPER_ADMIN })).toEqual({});
    expect(accessibleProjectWhere({ id: "admin_1", role: AdminRole.SUPER_ADMIN })).toEqual({});
    expect(() => requireSuperAdmin({ role: AdminRole.SUPER_ADMIN })).not.toThrow();
    expect(() => requireSuperAdmin({ role: AdminRole.ADMIN })).toThrow("仅超级管理员");
  });

  it("maps a reviewer membership to review and candidate-care capabilities only", async () => {
    mocks.groupMembershipFindFirst.mockResolvedValueOnce({ role: AdminGroupRole.REVIEWER });

    await expect(
      getGroupCapabilities({ id: "admin_2", role: AdminRole.ADMIN }, "group_1")
    ).resolves.toEqual({
      canRead: true,
      canManageSettings: false,
      canSchedule: false,
      canReview: true,
      canManageCandidates: true
    });
    expect(mocks.groupMembershipFindFirst).toHaveBeenCalledWith({
      where: {
        adminId: "admin_2",
        groupId: "group_1"
      },
      select: { role: true }
    });
  });

  it("gives super admins every group capability without membership lookup", async () => {
    await expect(
      getGroupCapabilities({ id: "admin_1", role: AdminRole.SUPER_ADMIN }, "group_1")
    ).resolves.toEqual({
      canRead: true,
      canManageSettings: true,
      canSchedule: true,
      canReview: true,
      canManageCandidates: true
    });
    expect(mocks.groupMembershipFindFirst).not.toHaveBeenCalled();
  });

  it("aggregates global navigation only from the roles that own each surface", async () => {
    mocks.groupMembershipFindMany.mockResolvedValueOnce([
      { role: AdminGroupRole.REVIEWER },
      { role: AdminGroupRole.VIEWER }
    ]);

    await expect(
      getAdminNavigationCapabilities({ id: "admin_2", role: AdminRole.ADMIN })
    ).resolves.toEqual({
      canViewAudit: false,
      canSchedule: false,
      canReview: true
    });
    expect(mocks.groupMembershipFindMany).toHaveBeenCalledWith({
      where: { adminId: "admin_2" },
      select: { role: true }
    });
  });

  it("gives super admins every global navigation capability without membership lookup", async () => {
    await expect(
      getAdminNavigationCapabilities({ id: "admin_1", role: AdminRole.SUPER_ADMIN })
    ).resolves.toEqual({
      canViewAudit: true,
      canSchedule: true,
      canReview: true
    });
    expect(mocks.groupMembershipFindMany).not.toHaveBeenCalled();
  });

  it("allows super admins to access groups without membership lookup", async () => {
    await expect(
      canAccessGroup({ id: "admin_1", role: AdminRole.SUPER_ADMIN }, "group_1")
    ).resolves.toBe(true);
    expect(mocks.groupMembershipFindFirst).not.toHaveBeenCalled();
  });

  it("allows regular admins with a matching group membership", async () => {
    mocks.groupMembershipFindFirst.mockResolvedValueOnce({ id: "membership_1" });

    await expect(
      canAccessGroup({ id: "admin_2", role: AdminRole.ADMIN }, "group_1", [AdminGroupRole.OWNER])
    ).resolves.toBe(true);
    expect(mocks.groupMembershipFindFirst).toHaveBeenCalledWith({
      where: {
        adminId: "admin_2",
        groupId: "group_1",
        role: { in: [AdminGroupRole.OWNER] }
      },
      select: { id: true }
    });
  });

  it("rejects regular admins without a matching group membership", async () => {
    mocks.groupMembershipFindFirst.mockResolvedValueOnce(null);

    await expect(canAccessGroup({ id: "admin_2", role: AdminRole.ADMIN }, "group_1")).resolves.toBe(
      false
    );
  });

  it("allows regular admins to access projects through group membership", async () => {
    mocks.projectFindFirst.mockResolvedValueOnce({ id: "project_1" });

    await expect(
      canAccessProject({ id: "admin_2", role: AdminRole.ADMIN }, "project_1", [
        AdminGroupRole.SCHEDULER
      ])
    ).resolves.toBe(true);
    expect(mocks.projectFindFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: "project_1" },
          {
            groups: {
              some: {
                adminMemberships: {
                  some: {
                    adminId: "admin_2",
                    role: { in: [AdminGroupRole.SCHEDULER] }
                  }
                }
              }
            }
          }
        ]
      },
      select: { id: true }
    });
  });

  it("allows super admins to access projects without lookup", async () => {
    await expect(
      canAccessProject({ id: "admin_1", role: AdminRole.SUPER_ADMIN }, "project_1")
    ).resolves.toBe(true);
    expect(mocks.projectFindFirst).not.toHaveBeenCalled();
  });
});
