"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditActorType, CandidateEmailDeliveryStatus } from "@prisma/client";
import { buildAppointmentEmailContext } from "@/lib/mail/appointment-email-context";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { groupSchedulingRoles, requireGroupPermission } from "@/lib/permissions/admin";
import { formValue, formValues } from "@/lib/validation/common";
import { candidateEmailActionSchema, retryCandidateEmailSchema } from "@/lib/validation/email";
import {
  createCandidateEmailDelivery,
  requeueCandidateEmailDelivery
} from "@/server/services/candidate-email";

function sanitizeReturnTo(value: string | undefined, groupId: string) {
  const fallback = `/admin/groups/${groupId}/candidates`;
  if (!value?.startsWith(`/admin/groups/${groupId}`)) {
    return fallback;
  }
  if (value.includes("://") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

function redirectWithMailStatus(
  returnTo: string,
  params: {
    mail: "queued" | "sent" | "partial" | "error" | "invalid";
    count?: number;
    failed?: number;
    dryRun?: boolean;
    batchId?: string;
  }
): never {
  const url = new URL(`http://local${returnTo}`);
  url.searchParams.set("mail", params.mail);
  if (typeof params.count === "number") {
    url.searchParams.set("mailCount", String(params.count));
  }
  if (typeof params.failed === "number") {
    url.searchParams.set("mailFailed", String(params.failed));
  }
  if (params.dryRun) {
    url.searchParams.set("mailDryRun", "1");
  }
  if (params.batchId) {
    url.searchParams.set("mailBatch", params.batchId);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function sendCandidateEmailAction(groupId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);

  const returnTo = sanitizeReturnTo(formValue(formData, "returnTo"), groupId);
  const parsed = candidateEmailActionSchema.safeParse({
    candidateIds: formValues(formData, "candidateIds"),
    templateKey: formValue(formData, "templateKey"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body"),
    ccEmails: formValue(formData, "ccEmails"),
    confirmSend: formValue(formData, "confirmSend"),
    returnTo
  });

  if (!parsed.success) {
    redirectWithMailStatus(returnTo, { mail: "invalid" });
  }

  const input = parsed.data;
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { id: true, name: true, timezone: true }
  });
  const uniqueCandidateIds = [...new Set(input.candidateIds)];
  const candidates = await prisma.candidate.findMany({
    where: {
      groupId,
      id: { in: uniqueCandidateIds }
    },
    select: {
      id: true,
      name: true,
      email: true,
      appointments: {
        where: { status: "SCHEDULED" },
        orderBy: { startAt: "desc" },
        take: 1,
        select: {
          startAt: true,
          endAt: true,
          meetingLocation: true,
          candidateVisibleMessage: true
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  if (candidates.length !== uniqueCandidateIds.length) {
    redirectWithMailStatus(returnTo, { mail: "invalid" });
  }

  const batchId = randomUUID();
  const deliveryIds = await prisma.$transaction(async (tx) => {
    const deliveries = [];
    for (const candidate of candidates) {
      deliveries.push(
        await createCandidateEmailDelivery(
          {
            adminId: admin.id,
            group,
            candidate,
            batchId,
            templateKey: input.templateKey,
            subject: input.subject,
            bodyTemplate: input.body,
            ccEmails: input.ccEmails,
            templateValues: buildAppointmentEmailContext(candidate.appointments[0], group.timezone)
          },
          tx
        )
      );
    }

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.queue_candidate_email",
        entityType: "CandidateEmailBatch",
        entityId: batchId,
        afterData: {
          subject: input.subject,
          ccEmails: input.ccEmails,
          candidateIds: candidates.map((candidate) => candidate.id),
          deliveryIds: deliveries.map((delivery) => delivery.id),
          recipientCount: candidates.length,
          status: "queued"
        }
      }
    });
    return deliveries.map((delivery) => delivery.id);
  });

  revalidatePath(`/admin/groups/${groupId}/candidates`);
  for (const candidate of candidates) {
    revalidatePath(`/admin/groups/${groupId}/candidates/${candidate.id}`);
  }

  redirectWithMailStatus(returnTo, {
    mail: "queued",
    count: deliveryIds.length,
    batchId
  });
}

export async function retryCandidateEmailDeliveryAction(
  groupId: string,
  deliveryId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);

  const input = retryCandidateEmailSchema.parse({
    returnTo: formValue(formData, "returnTo")
  });
  const returnTo = sanitizeReturnTo(input.returnTo, groupId);
  const original = await prisma.candidateEmailDelivery.findFirst({
    where: { id: deliveryId, groupId },
    select: {
      id: true,
      candidateId: true,
      subject: true,
      status: true,
      idempotencyKey: true
    }
  });

  if (
    !original ||
    original.status !== CandidateEmailDeliveryStatus.FAILED ||
    !original.idempotencyKey
  ) {
    redirectWithMailStatus(returnTo, { mail: "invalid" });
  }

  const batchId = randomUUID();
  await requeueCandidateEmailDelivery(original.id, batchId);

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      groupId,
      action: "admin.retry_candidate_email",
      entityType: "CandidateEmailDelivery",
      entityId: original.id,
      afterData: {
        originalDeliveryId: original.id,
        candidateId: original.candidateId,
        subject: original.subject,
        deliveryId: original.id,
        status: "queued"
      }
    }
  });

  revalidatePath(`/admin/groups/${groupId}/candidates`);
  revalidatePath(`/admin/groups/${groupId}/candidates/${original.candidateId}`);

  redirectWithMailStatus(returnTo, { mail: "queued", count: 1, batchId });
}
