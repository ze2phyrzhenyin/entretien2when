"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminRole, AuditActorType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { grantGroupAdminSchema, groupFormSchema } from "@/lib/validation/group";
import { generateUniqueGroupCode } from "@/server/services/group-code";

const groupAuditSelect = {
  name: true,
  publicDescription: true,
  timezone: true,
  status: true,
  slotDurationMinutes: true,
  interviewDurationMinutes: true,
  minSelectSlots: true,
  maxSelectSlots: true
} as const;

export async function createGroupAction(formData: FormData) {
  const admin = await requireAdmin();
  const input = groupFormSchema.parse({
    name: formValue(formData, "name"),
    publicDescription: formValue(formData, "publicDescription"),
    timezone: formValue(formData, "timezone") || "Asia/Shanghai",
    status: formValue(formData, "status") || "OPEN",
    slotDurationMinutes: formValue(formData, "slotDurationMinutes"),
    interviewDurationMinutes: formValue(formData, "interviewDurationMinutes"),
    minSelectSlots: formValue(formData, "minSelectSlots"),
    maxSelectSlots: formValue(formData, "maxSelectSlots")
  });

  const groupCode = await generateUniqueGroupCode();
  const group = await prisma.$transaction(async (tx) => {
    const createdGroup = await tx.interviewGroup.create({
      data: {
        ...input,
        publicDescription: input.publicDescription || null,
        groupCode,
        createdByAdminId: admin.id
      },
      select: {
        id: true,
        groupCode: true,
        ...groupAuditSelect
      }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId: createdGroup.id,
        action: "admin.create_group",
        entityType: "InterviewGroup",
        entityId: createdGroup.id,
        afterData: createdGroup
      }
    });

    return createdGroup;
  });

  revalidatePath("/admin");
  redirect(`/admin/groups/${group.id}/settings?created=1`);
}

export async function updateGroupAction(groupId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canEditGroup");

  const input = groupFormSchema.parse({
    name: formValue(formData, "name"),
    publicDescription: formValue(formData, "publicDescription"),
    timezone: formValue(formData, "timezone") || "Asia/Shanghai",
    status: formValue(formData, "status") || "OPEN",
    slotDurationMinutes: formValue(formData, "slotDurationMinutes"),
    interviewDurationMinutes: formValue(formData, "interviewDurationMinutes"),
    minSelectSlots: formValue(formData, "minSelectSlots"),
    maxSelectSlots: formValue(formData, "maxSelectSlots")
  });

  const beforeGroup = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: groupAuditSelect
  });

  await prisma.$transaction(async (tx) => {
    const updatedGroup = await tx.interviewGroup.update({
      where: { id: groupId },
      data: {
        ...input,
        publicDescription: input.publicDescription || null
      },
      select: groupAuditSelect
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.update_group",
        entityType: "InterviewGroup",
        entityId: groupId,
        beforeData: beforeGroup,
        afterData: updatedGroup
      }
    });
  });

  revalidatePath(`/admin/groups/${groupId}/settings`);
}

export async function grantGroupAdminAction(groupId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canEditGroup");

  const input = grantGroupAdminSchema.parse({
    adminEmail: formValue(formData, "adminEmail"),
    canViewCandidates: formData.get("canViewCandidates") === "on",
    canEditGroup: formData.get("canEditGroup") === "on",
    canReviewModifications: formData.get("canReviewModifications") === "on",
    canScheduleInterview: formData.get("canScheduleInterview") === "on"
  });

  const targetAdmin = await prisma.admin.findUnique({
    where: { email: input.adminEmail },
    select: { id: true, role: true }
  });

  if (!targetAdmin) {
    redirect(`/admin/groups/${groupId}/settings?error=admin-not-found`);
  }

  if (targetAdmin.role === AdminRole.SUPER_ADMIN) {
    redirect(`/admin/groups/${groupId}/settings?error=super-admin-no-grant-needed`);
  }

  await prisma.$transaction(async (tx) => {
    const grant = await tx.groupAdmin.upsert({
      where: {
        groupId_adminId: {
          groupId,
          adminId: targetAdmin.id
        }
      },
      update: {
        canViewCandidates: input.canViewCandidates,
        canEditGroup: input.canEditGroup,
        canReviewModifications: input.canReviewModifications,
        canScheduleInterview: input.canScheduleInterview,
        grantedByAdminId: admin.id
      },
      create: {
        groupId,
        adminId: targetAdmin.id,
        canViewCandidates: input.canViewCandidates,
        canEditGroup: input.canEditGroup,
        canReviewModifications: input.canReviewModifications,
        canScheduleInterview: input.canScheduleInterview,
        grantedByAdminId: admin.id
      },
      select: {
        id: true,
        adminId: true,
        canViewCandidates: true,
        canEditGroup: true,
        canReviewModifications: true,
        canScheduleInterview: true
      }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.grant_group_admin",
        entityType: "GroupAdmin",
        entityId: grant.id,
        afterData: {
          targetAdminId: grant.adminId,
          targetAdminEmail: input.adminEmail,
          canViewCandidates: grant.canViewCandidates,
          canEditGroup: grant.canEditGroup,
          canReviewModifications: grant.canReviewModifications,
          canScheduleInterview: grant.canScheduleInterview
        }
      }
    });
  });

  revalidatePath(`/admin/groups/${groupId}/settings`);
}

export async function revokeGroupAdminAction(groupId: string, grantId: string) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canEditGroup");

  const grant = await prisma.groupAdmin.findFirst({
    where: {
      id: grantId,
      groupId
    },
    select: {
      id: true,
      adminId: true,
      canViewCandidates: true,
      canEditGroup: true,
      canReviewModifications: true,
      canScheduleInterview: true,
      admin: {
        select: {
          email: true
        }
      }
    }
  });

  if (grant) {
    await prisma.$transaction(async (tx) => {
      await tx.groupAdmin.deleteMany({
        where: {
          id: grantId,
          groupId
        }
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: admin.id,
          groupId,
          action: "admin.revoke_group_admin",
          entityType: "GroupAdmin",
          entityId: grant.id,
          beforeData: {
            targetAdminId: grant.adminId,
            targetAdminEmail: grant.admin.email,
            canViewCandidates: grant.canViewCandidates,
            canEditGroup: grant.canEditGroup,
            canReviewModifications: grant.canReviewModifications,
            canScheduleInterview: grant.canScheduleInterview
          }
        }
      });
    });
  }

  revalidatePath(`/admin/groups/${groupId}/settings`);
}
