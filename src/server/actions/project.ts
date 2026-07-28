"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditActorType, Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { roundFormSchema } from "@/lib/validation/project";

function redirectWithRoundStatus(projectId: string, status: string): never {
  redirect(`/admin/projects/${projectId}?round=${encodeURIComponent(status)}`);
}

function readRoundInput(formData: FormData) {
  return {
    roundId: formValue(formData, "roundId") || undefined,
    name: formValue(formData, "name"),
    orderIndex: formValue(formData, "orderIndex"),
    description: formValue(formData, "description"),
    interviewDurationMinutes: formValue(formData, "interviewDurationMinutes"),
    status: formValue(formData, "status")
  };
}

export async function createRoundAction(projectId: string, formData: FormData) {
  const admin = await requireAdmin();
  requireSuperAdmin(admin);
  const parsed = roundFormSchema.safeParse(readRoundInput(formData));
  if (!parsed.success) {
    redirectWithRoundStatus(projectId, "invalid");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.interviewProject.findUniqueOrThrow({
        where: { id: projectId },
        select: { id: true }
      });
      const round = await tx.interviewRound.create({
        data: {
          projectId,
          name: parsed.data.name,
          orderIndex: parsed.data.orderIndex,
          description: parsed.data.description || null,
          interviewDurationMinutes: parsed.data.interviewDurationMinutes,
          status: parsed.data.status
        }
      });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: admin.id,
          action: "admin.create_interview_round",
          entityType: "InterviewRound",
          entityId: round.id,
          afterData: {
            projectId,
            name: round.name,
            orderIndex: round.orderIndex,
            status: round.status,
            interviewDurationMinutes: round.interviewDurationMinutes
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectWithRoundStatus(projectId, "order-conflict");
    }
    throw error;
  }

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithRoundStatus(projectId, "created");
}

export async function updateRoundAction(projectId: string, formData: FormData) {
  const admin = await requireAdmin();
  requireSuperAdmin(admin);
  const parsed = roundFormSchema.safeParse(readRoundInput(formData));
  if (!parsed.success || !parsed.data.roundId) {
    redirectWithRoundStatus(projectId, "invalid");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.interviewRound.findFirstOrThrow({
        where: { id: parsed.data.roundId, projectId }
      });
      const after = await tx.interviewRound.update({
        where: { id: before.id },
        data: {
          name: parsed.data.name,
          orderIndex: parsed.data.orderIndex,
          description: parsed.data.description || null,
          interviewDurationMinutes: parsed.data.interviewDurationMinutes,
          status: parsed.data.status
        }
      });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorAdminId: admin.id,
          action: "admin.update_interview_round",
          entityType: "InterviewRound",
          entityId: after.id,
          beforeData: {
            projectId,
            name: before.name,
            orderIndex: before.orderIndex,
            description: before.description,
            status: before.status,
            interviewDurationMinutes: before.interviewDurationMinutes
          },
          afterData: {
            projectId,
            name: after.name,
            orderIndex: after.orderIndex,
            description: after.description,
            status: after.status,
            interviewDurationMinutes: after.interviewDurationMinutes
          }
        }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectWithRoundStatus(projectId, "order-conflict");
    }
    throw error;
  }

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithRoundStatus(projectId, "updated");
}
