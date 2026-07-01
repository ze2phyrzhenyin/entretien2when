import { AdminRole, type Admin } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type GroupPermission =
  "canViewCandidates" | "canEditGroup" | "canReviewModifications" | "canScheduleInterview";

export class PermissionDeniedError extends Error {
  constructor(message = "没有权限执行该操作") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export function isSuperAdmin(admin: Pick<Admin, "role">) {
  return admin.role === AdminRole.SUPER_ADMIN;
}

export async function canAccessGroup(admin: Pick<Admin, "id" | "role">, groupId: string) {
  if (isSuperAdmin(admin)) {
    return true;
  }

  const grant = await prisma.groupAdmin.findUnique({
    where: {
      groupId_adminId: {
        groupId,
        adminId: admin.id
      }
    },
    select: {
      id: true
    }
  });

  return Boolean(grant);
}

export async function requireGroupPermission(
  admin: Pick<Admin, "id" | "role">,
  groupId: string,
  permission: GroupPermission
) {
  if (isSuperAdmin(admin)) {
    return;
  }

  const grant = await prisma.groupAdmin.findUnique({
    where: {
      groupId_adminId: {
        groupId,
        adminId: admin.id
      }
    }
  });

  if (!grant || !grant[permission]) {
    throw new PermissionDeniedError();
  }
}
