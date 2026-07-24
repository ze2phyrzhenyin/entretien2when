import { AdminGroupRole, AdminRole, type Admin, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export class PermissionDeniedError extends Error {
  constructor(message = "没有权限执行该操作") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export function isSuperAdmin(admin: Pick<Admin, "role">) {
  return admin.role === AdminRole.SUPER_ADMIN;
}

export const groupReadRoles = [
  AdminGroupRole.OWNER,
  AdminGroupRole.SCHEDULER,
  AdminGroupRole.REVIEWER,
  AdminGroupRole.VIEWER
] as const;

export const groupOwnerRoles = [AdminGroupRole.OWNER] as const;
export const groupSchedulingRoles = [AdminGroupRole.OWNER, AdminGroupRole.SCHEDULER] as const;
export const groupReviewRoles = [AdminGroupRole.OWNER, AdminGroupRole.REVIEWER] as const;
export const groupCandidateCareRoles = [
  AdminGroupRole.OWNER,
  AdminGroupRole.SCHEDULER,
  AdminGroupRole.REVIEWER
] as const;

type AdminForPermission = Pick<Admin, "id" | "role">;

export type GroupCapabilities = {
  canRead: boolean;
  canManageSettings: boolean;
  canSchedule: boolean;
  canReview: boolean;
  canManageCandidates: boolean;
};

/** Capabilities for global navigation, aggregated across all memberships. */
export type AdminNavigationCapabilities = {
  canViewAudit: boolean;
  canSchedule: boolean;
  canReview: boolean;
};

const noGroupCapabilities: GroupCapabilities = {
  canRead: false,
  canManageSettings: false,
  canSchedule: false,
  canReview: false,
  canManageCandidates: false
};

const fullGroupCapabilities: GroupCapabilities = {
  canRead: true,
  canManageSettings: true,
  canSchedule: true,
  canReview: true,
  canManageCandidates: true
};

const noAdminNavigationCapabilities: AdminNavigationCapabilities = {
  canViewAudit: false,
  canSchedule: false,
  canReview: false
};

const fullAdminNavigationCapabilities: AdminNavigationCapabilities = {
  canViewAudit: true,
  canSchedule: true,
  canReview: true
};

function roleIsIncluded(role: AdminGroupRole | undefined, roles: readonly AdminGroupRole[]) {
  return Boolean(role && roles.includes(role));
}

/**
 * Resolve the page-level capability matrix from the single group membership.
 * This powers navigation and query shaping only; mutations must continue to
 * call requireGroupPermission with their explicit required role.
 */
export async function getGroupCapabilities(
  admin: AdminForPermission,
  groupId: string
): Promise<GroupCapabilities> {
  if (isSuperAdmin(admin)) {
    return fullGroupCapabilities;
  }

  const membership = await prisma.adminGroupMembership.findFirst({
    where: {
      adminId: admin.id,
      groupId
    },
    select: { role: true }
  });
  const role = membership?.role;

  if (!roleIsIncluded(role, groupReadRoles)) {
    return noGroupCapabilities;
  }

  return {
    canRead: true,
    canManageSettings: roleIsIncluded(role, groupOwnerRoles),
    canSchedule: roleIsIncluded(role, groupSchedulingRoles),
    canReview: roleIsIncluded(role, groupReviewRoles),
    canManageCandidates: roleIsIncluded(role, groupCandidateCareRoles)
  };
}

/**
 * Resolve only the global surfaces a regular administrator can use. Keeping
 * this server-side means a VIEWER never sees a link whose page would merely
 * reject or return an empty sensitive data set after navigation.
 */
export async function getAdminNavigationCapabilities(
  admin: AdminForPermission
): Promise<AdminNavigationCapabilities> {
  if (isSuperAdmin(admin)) {
    return fullAdminNavigationCapabilities;
  }

  const memberships = await prisma.adminGroupMembership.findMany({
    where: { adminId: admin.id },
    select: { role: true }
  });
  if (memberships.length === 0) {
    return noAdminNavigationCapabilities;
  }

  const roles = memberships.map((membership) => membership.role);
  return {
    canViewAudit: roles.some((role) => roleIsIncluded(role, groupOwnerRoles)),
    canSchedule: roles.some((role) => roleIsIncluded(role, groupSchedulingRoles)),
    canReview: roles.some((role) => roleIsIncluded(role, groupReviewRoles))
  };
}

/**
 * Builds the only group scope that a non-super-admin may use for data reads.
 * Keep this at the query boundary rather than filtering records after they
 * have already been loaded into memory.
 */
export function accessibleGroupWhere(
  admin: AdminForPermission,
  roles: readonly AdminGroupRole[] = groupReadRoles
): Prisma.InterviewGroupWhereInput {
  if (isSuperAdmin(admin)) {
    return {};
  }

  return {
    adminMemberships: {
      some: {
        adminId: admin.id,
        role: { in: [...roles] }
      }
    }
  };
}

/**
 * A project is discoverable only through a group the current administrator
 * may access. Child groups, rounds and aggregates still need the matching
 * group scope applied independently when they are loaded.
 */
export function accessibleProjectWhere(
  admin: AdminForPermission,
  roles: readonly AdminGroupRole[] = groupReadRoles
): Prisma.InterviewProjectWhereInput {
  if (isSuperAdmin(admin)) {
    return {};
  }

  return {
    groups: {
      some: accessibleGroupWhere(admin, roles)
    }
  };
}

export function requireSuperAdmin(admin: Pick<Admin, "role">) {
  if (!isSuperAdmin(admin)) {
    throw new PermissionDeniedError("仅超级管理员可以执行该操作");
  }
}

export async function canAccessGroup(
  admin: AdminForPermission,
  groupId: string,
  roles: readonly AdminGroupRole[] = groupReadRoles
) {
  if (isSuperAdmin(admin)) {
    return true;
  }

  const membership = await prisma.adminGroupMembership.findFirst({
    where: {
      adminId: admin.id,
      groupId,
      role: { in: [...roles] }
    },
    select: { id: true }
  });
  return Boolean(membership);
}

export async function requireGroupPermission(
  admin: AdminForPermission,
  groupId: string,
  roles: readonly AdminGroupRole[] = groupReadRoles
) {
  if (await canAccessGroup(admin, groupId, roles)) {
    return;
  }
  throw new PermissionDeniedError();
}

export async function canAccessProject(
  admin: AdminForPermission,
  projectId: string,
  roles: readonly AdminGroupRole[] = groupReadRoles
) {
  if (isSuperAdmin(admin)) {
    return true;
  }

  const project = await prisma.interviewProject.findFirst({
    where: {
      AND: [{ id: projectId }, accessibleProjectWhere(admin, roles)]
    },
    select: { id: true }
  });
  return Boolean(project);
}

export async function requireProjectPermission(
  admin: AdminForPermission,
  projectId: string,
  roles: readonly AdminGroupRole[] = groupReadRoles
) {
  if (await canAccessProject(admin, projectId, roles)) {
    return;
  }
  throw new PermissionDeniedError();
}
