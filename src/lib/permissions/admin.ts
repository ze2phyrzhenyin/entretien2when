import { AdminRole, type Admin } from "@prisma/client";

export type GroupPermission =
  "canViewCandidates" | "canEditGroup" | "canReviewModifications" | "canScheduleInterview";

class PermissionDeniedError extends Error {
  constructor(message = "没有权限执行该操作") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export function isSuperAdmin(admin: Pick<Admin, "role">) {
  return admin.role === AdminRole.SUPER_ADMIN;
}

export async function canAccessGroup(admin: Pick<Admin, "role">, _groupId: string) {
  return isSuperAdmin(admin);
}

export async function requireGroupPermission(
  admin: Pick<Admin, "role">,
  _groupId: string,
  _permission: GroupPermission
) {
  if (isSuperAdmin(admin)) {
    return;
  }
  throw new PermissionDeniedError();
}
