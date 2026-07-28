"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminGroupRole, AdminRole, AdminStatus, AuditActorType, Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  lockStateResources,
  serializableTransactionOptions,
  withSerializableRetry
} from "@/lib/db/transaction";
import {
  groupOwnerRoles,
  requireGroupPermission,
  requireSuperAdmin
} from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import {
  createAdminSchema,
  resetAdminPasswordSchema,
  revokeGroupMembershipSchema,
  updateAdminSchema,
  upsertGroupMembershipSchema
} from "@/lib/validation/admin-management";

class LastPrivilegedAdminError extends Error {}

function redirectWithAdminStatus(status: string): never {
  redirect(`/admin/admins?admin=${encodeURIComponent(status)}`);
}

function redirectWithMembershipStatus(groupId: string, status: string): never {
  redirect(`/admin/groups/${groupId}/members?membership=${encodeURIComponent(status)}`);
}

async function assertActiveSuperAdminRemains(
  tx: Prisma.TransactionClient,
  target: { id: string; role: AdminRole; status: AdminStatus },
  next: { role: AdminRole; status: AdminStatus }
) {
  const losesSuperAdmin =
    target.role === AdminRole.SUPER_ADMIN &&
    target.status === AdminStatus.ACTIVE &&
    (next.role !== AdminRole.SUPER_ADMIN || next.status !== AdminStatus.ACTIVE);
  if (!losesSuperAdmin) {
    return;
  }

  const activeSuperAdmins = await tx.admin.count({
    where: { role: AdminRole.SUPER_ADMIN, status: AdminStatus.ACTIVE }
  });
  if (activeSuperAdmins <= 1) {
    throw new LastPrivilegedAdminError("last-super-admin");
  }
}

async function assertAdminIsNotLastOwner(tx: Prisma.TransactionClient, adminId: string) {
  const ownedGroups = await tx.adminGroupMembership.findMany({
    where: {
      adminId,
      role: AdminGroupRole.OWNER
    },
    select: { groupId: true }
  });

  for (const { groupId } of ownedGroups) {
    const activeOwners = await tx.adminGroupMembership.count({
      where: {
        groupId,
        role: AdminGroupRole.OWNER,
        admin: { status: AdminStatus.ACTIVE }
      }
    });
    if (activeOwners <= 1) {
      throw new LastPrivilegedAdminError("last-owner");
    }
  }
}

export async function createAdminAction(formData: FormData) {
  const actor = await requireAdmin();
  requireSuperAdmin(actor);
  const parsed = createAdminSchema.safeParse({
    email: formValue(formData, "email"),
    displayName: formValue(formData, "displayName"),
    password: formValue(formData, "password"),
    role: formValue(formData, "role")
  });
  if (!parsed.success) {
    redirectWithAdminStatus("invalid");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.admin.create({
        data: {
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          passwordHash: await hashPassword(parsed.data.password),
          role: parsed.data.role,
          status: AdminStatus.ACTIVE
        },
        select: { id: true, email: true, displayName: true, role: true, status: true }
      });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: actor.id,
          action: "admin.create_administrator",
          entityType: "Admin",
          entityId: created.id,
          afterData: created
        }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectWithAdminStatus("duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/admins");
  redirectWithAdminStatus("created");
}

export async function updateAdminAction(formData: FormData) {
  const actor = await requireAdmin();
  requireSuperAdmin(actor);
  const parsed = updateAdminSchema.safeParse({
    adminId: formValue(formData, "adminId"),
    role: formValue(formData, "role"),
    status: formValue(formData, "status")
  });
  if (!parsed.success) {
    redirectWithAdminStatus("invalid");
  }

  try {
    await withSerializableRetry(() =>
      prisma.$transaction(async (tx) => {
        await lockStateResources(tx, [`admin:${parsed.data.adminId}`]);
        const before = await tx.admin.findUniqueOrThrow({
          where: { id: parsed.data.adminId },
          select: { id: true, email: true, displayName: true, role: true, status: true }
        });

        await assertActiveSuperAdminRemains(tx, before, parsed.data);
        if (before.status === AdminStatus.ACTIVE && parsed.data.status === AdminStatus.DISABLED) {
          await assertAdminIsNotLastOwner(tx, before.id);
        }

        const after = await tx.admin.update({
          where: { id: before.id },
          data: { role: parsed.data.role, status: parsed.data.status },
          select: { id: true, email: true, displayName: true, role: true, status: true }
        });
        if (after.status === AdminStatus.DISABLED) {
          await tx.adminSession.deleteMany({ where: { adminId: after.id } });
        }
        await tx.auditLog.create({
          data: {
            actorType: AuditActorType.ADMIN,
            actorAdminId: actor.id,
            action: "admin.update_administrator",
            entityType: "Admin",
            entityId: after.id,
            beforeData: before ?? undefined,
            afterData: after
          }
        });
      }, serializableTransactionOptions)
    );
  } catch (error) {
    if (error instanceof LastPrivilegedAdminError) {
      redirectWithAdminStatus(error.message);
    }
    throw error;
  }

  revalidatePath("/admin/admins");
  redirectWithAdminStatus("updated");
}

export async function resetAdminPasswordAction(formData: FormData) {
  const actor = await requireAdmin();
  requireSuperAdmin(actor);
  const parsed = resetAdminPasswordSchema.safeParse({
    adminId: formValue(formData, "adminId"),
    password: formValue(formData, "password")
  });
  if (!parsed.success) {
    redirectWithAdminStatus("invalid-password");
  }

  await prisma.$transaction(async (tx) => {
    const target = await tx.admin.findUniqueOrThrow({
      where: { id: parsed.data.adminId },
      select: { id: true, email: true }
    });
    await tx.admin.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(parsed.data.password) }
    });
    const revoked = await tx.adminSession.deleteMany({ where: { adminId: target.id } });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: actor.id,
        action: "admin.reset_administrator_password",
        entityType: "Admin",
        entityId: target.id,
        afterData: { email: target.email, revokedSessions: revoked.count }
      }
    });
  });

  revalidatePath("/admin/admins");
  redirectWithAdminStatus("password-reset");
}

export async function upsertGroupMembershipAction(groupId: string, formData: FormData) {
  const actor = await requireAdmin();
  await requireGroupPermission(actor, groupId, groupOwnerRoles);
  const parsed = upsertGroupMembershipSchema.safeParse({
    adminId: formValue(formData, "adminId"),
    role: formValue(formData, "role")
  });
  if (!parsed.success) {
    redirectWithMembershipStatus(groupId, "invalid");
  }

  try {
    await withSerializableRetry(() =>
      prisma.$transaction(async (tx) => {
        await lockStateResources(tx, [`group:${groupId}`, `admin:${parsed.data.adminId}`]);
        const [target, before] = await Promise.all([
          tx.admin.findFirstOrThrow({
            where: { id: parsed.data.adminId, status: AdminStatus.ACTIVE },
            select: { id: true, email: true, displayName: true }
          }),
          tx.adminGroupMembership.findUnique({
            where: {
              adminId_groupId: { adminId: parsed.data.adminId, groupId }
            },
            select: { id: true, role: true }
          })
        ]);

        if (before?.role === AdminGroupRole.OWNER && parsed.data.role !== AdminGroupRole.OWNER) {
          const activeOwners = await tx.adminGroupMembership.count({
            where: {
              groupId,
              role: AdminGroupRole.OWNER,
              admin: { status: AdminStatus.ACTIVE }
            }
          });
          if (activeOwners <= 1) {
            throw new LastPrivilegedAdminError("last-owner");
          }
        }

        const after = await tx.adminGroupMembership.upsert({
          where: { adminId_groupId: { adminId: target.id, groupId } },
          create: { adminId: target.id, groupId, role: parsed.data.role },
          update: { role: parsed.data.role },
          select: { id: true, adminId: true, groupId: true, role: true }
        });
        await tx.auditLog.create({
          data: {
            actorType: AuditActorType.ADMIN,
            actorAdminId: actor.id,
            groupId,
            action: before ? "admin.update_group_membership" : "admin.create_group_membership",
            entityType: "AdminGroupMembership",
            entityId: after.id,
            beforeData: before ?? undefined,
            afterData: { ...after, email: target.email }
          }
        });
      }, serializableTransactionOptions)
    );
  } catch (error) {
    if (error instanceof LastPrivilegedAdminError) {
      redirectWithMembershipStatus(groupId, error.message);
    }
    throw error;
  }

  revalidatePath(`/admin/groups/${groupId}/members`);
  redirectWithMembershipStatus(groupId, "saved");
}

export async function revokeGroupMembershipAction(groupId: string, formData: FormData) {
  const actor = await requireAdmin();
  await requireGroupPermission(actor, groupId, groupOwnerRoles);
  const parsed = revokeGroupMembershipSchema.safeParse({
    adminId: formValue(formData, "adminId")
  });
  if (!parsed.success) {
    redirectWithMembershipStatus(groupId, "invalid");
  }

  try {
    await withSerializableRetry(() =>
      prisma.$transaction(async (tx) => {
        await lockStateResources(tx, [`group:${groupId}`, `admin:${parsed.data.adminId}`]);
        const membership = await tx.adminGroupMembership.findUniqueOrThrow({
          where: { adminId_groupId: { adminId: parsed.data.adminId, groupId } },
          include: {
            admin: { select: { email: true, status: true } }
          }
        });
        if (
          membership.role === AdminGroupRole.OWNER &&
          membership.admin.status === AdminStatus.ACTIVE
        ) {
          const activeOwners = await tx.adminGroupMembership.count({
            where: {
              groupId,
              role: AdminGroupRole.OWNER,
              admin: { status: AdminStatus.ACTIVE }
            }
          });
          if (activeOwners <= 1) {
            throw new LastPrivilegedAdminError("last-owner");
          }
        }

        await tx.adminGroupMembership.delete({ where: { id: membership.id } });
        await tx.auditLog.create({
          data: {
            actorType: AuditActorType.ADMIN,
            actorAdminId: actor.id,
            groupId,
            action: "admin.revoke_group_membership",
            entityType: "AdminGroupMembership",
            entityId: membership.id,
            beforeData: {
              adminId: membership.adminId,
              role: membership.role,
              email: membership.admin.email
            }
          }
        });
      }, serializableTransactionOptions)
    );
  } catch (error) {
    if (error instanceof LastPrivilegedAdminError) {
      redirectWithMembershipStatus(groupId, error.message);
    }
    throw error;
  }

  revalidatePath(`/admin/groups/${groupId}/members`);
  redirectWithMembershipStatus(groupId, "revoked");
}
