"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminRole } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { grantGroupAdminSchema, groupFormSchema } from "@/lib/validation/group";
import { generateUniqueGroupCode } from "@/server/services/group-code";

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

  const group = await prisma.interviewGroup.create({
    data: {
      ...input,
      publicDescription: input.publicDescription || null,
      groupCode: await generateUniqueGroupCode(),
      createdByAdminId: admin.id
    },
    select: {
      id: true
    }
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

  await prisma.interviewGroup.update({
    where: { id: groupId },
    data: {
      ...input,
      publicDescription: input.publicDescription || null
    }
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

  await prisma.groupAdmin.upsert({
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
    }
  });

  revalidatePath(`/admin/groups/${groupId}/settings`);
}

export async function revokeGroupAdminAction(groupId: string, grantId: string) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canEditGroup");

  await prisma.groupAdmin.deleteMany({
    where: {
      id: grantId,
      groupId
    }
  });

  revalidatePath(`/admin/groups/${groupId}/settings`);
}
