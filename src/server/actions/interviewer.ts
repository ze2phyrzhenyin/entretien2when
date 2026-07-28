"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditActorType, InterviewerStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { groupSchedulingRoles, requireProjectPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { interviewerFormSchema } from "@/lib/validation/interviewer";

function redirectWithInterviewerStatus(
  projectId: string,
  status: "created" | "invalid" | "activated" | "deactivated"
): never {
  const url = new URL(`http://local/admin/projects/${projectId}`);
  url.searchParams.set("interviewer", status);
  redirect(`${url.pathname}${url.search}`);
}

export async function createInterviewerAction(projectId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireProjectPermission(admin, projectId, groupSchedulingRoles);

  const parsed = interviewerFormSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email")
  });
  if (!parsed.success) {
    redirectWithInterviewerStatus(projectId, "invalid");
  }

  const input = parsed.data;
  const interviewer = await prisma.interviewer.upsert({
    where: {
      projectId_normalizedEmail: {
        projectId,
        normalizedEmail: input.email
      }
    },
    update: {
      name: input.name,
      email: input.email,
      status: InterviewerStatus.ACTIVE
    },
    create: {
      projectId,
      name: input.name,
      email: input.email,
      normalizedEmail: input.email,
      status: InterviewerStatus.ACTIVE
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true
    }
  });

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      action: "admin.upsert_interviewer",
      entityType: "Interviewer",
      entityId: interviewer.id,
      afterData: interviewer
    }
  });

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithInterviewerStatus(projectId, "created");
}

export async function updateInterviewerStatusAction(
  projectId: string,
  interviewerId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireProjectPermission(admin, projectId, groupSchedulingRoles);
  const statusValue = formValue(formData, "status");
  if (!(statusValue in InterviewerStatus)) {
    redirectWithInterviewerStatus(projectId, "invalid");
  }
  const status = statusValue as InterviewerStatus;

  const before = await prisma.interviewer.findFirstOrThrow({
    where: { id: interviewerId, projectId },
    select: { id: true, name: true, email: true, status: true }
  });
  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.interviewer.update({
      where: { id: before.id },
      data: { status },
      select: { id: true, name: true, email: true, status: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        action: "admin.update_interviewer_status",
        entityType: "Interviewer",
        entityId: updated.id,
        beforeData: before,
        afterData: updated
      }
    });
    return updated;
  });

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithInterviewerStatus(
    projectId,
    after.status === InterviewerStatus.ACTIVE ? "activated" : "deactivated"
  );
}
