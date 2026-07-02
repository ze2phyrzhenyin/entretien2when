"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditActorType, CandidateEmailDeliveryStatus } from "@prisma/client";
import { renderCandidateEmailTemplate } from "@/lib/mail/render-template";
import { sendMailatoEmail } from "@/lib/mail/mailato";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue, formValues } from "@/lib/validation/common";
import { candidateEmailActionSchema, retryCandidateEmailSchema } from "@/lib/validation/email";

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
    mail: "sent" | "partial" | "error" | "invalid";
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

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0]?.slice(0, 240) || "发送失败";
  }
  return "发送失败";
}

type EmailGroup = {
  id: string;
  name: string;
};

type EmailCandidate = {
  id: string;
  name: string;
  email: string;
};

async function attemptCandidateEmailDelivery(input: {
  adminId: string;
  group: EmailGroup;
  candidate: EmailCandidate;
  batchId: string;
  templateKey?: string | null;
  subject: string;
  bodyTemplate: string;
  retriedFromId?: string | null;
}) {
  try {
    const result = await sendMailatoEmail({
      recipient: {
        email: input.candidate.email,
        name: input.candidate.name
      },
      subject: renderCandidateEmailTemplate(input.subject, {
        candidateName: input.candidate.name,
        candidateEmail: input.candidate.email,
        groupName: input.group.name
      }),
      body: renderCandidateEmailTemplate(input.bodyTemplate, {
        candidateName: input.candidate.name,
        candidateEmail: input.candidate.email,
        groupName: input.group.name
      }),
      auditId: `${input.batchId}:${input.candidate.id}`
    });
    const delivery = await prisma.candidateEmailDelivery.create({
      data: {
        groupId: input.group.id,
        candidateId: input.candidate.id,
        sentByAdminId: input.adminId,
        batchId: input.batchId,
        templateKey: input.templateKey || null,
        subject: input.subject,
        bodyTemplate: input.bodyTemplate,
        candidateNameSnapshot: input.candidate.name,
        recipientEmailSnapshot: input.candidate.email,
        status:
          result.status === "sent"
            ? CandidateEmailDeliveryStatus.SENT
            : CandidateEmailDeliveryStatus.PREVIEW,
        providerMessageId: result.emailId ?? null,
        retriedFromId: input.retriedFromId || null
      }
    });

    return {
      deliveryId: delivery.id,
      candidateId: input.candidate.id,
      status: result.status,
      emailId: result.emailId ?? null,
      error: null
    };
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const delivery = await prisma.candidateEmailDelivery.create({
      data: {
        groupId: input.group.id,
        candidateId: input.candidate.id,
        sentByAdminId: input.adminId,
        batchId: input.batchId,
        templateKey: input.templateKey || null,
        subject: input.subject,
        bodyTemplate: input.bodyTemplate,
        candidateNameSnapshot: input.candidate.name,
        recipientEmailSnapshot: input.candidate.email,
        status: CandidateEmailDeliveryStatus.FAILED,
        errorMessage,
        retriedFromId: input.retriedFromId || null
      }
    });

    return {
      deliveryId: delivery.id,
      candidateId: input.candidate.id,
      status: "failure" as const,
      emailId: null,
      error: errorMessage
    };
  }
}

export async function sendCandidateEmailAction(groupId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canViewCandidates");

  const returnTo = sanitizeReturnTo(formValue(formData, "returnTo"), groupId);
  const parsed = candidateEmailActionSchema.safeParse({
    candidateIds: formValues(formData, "candidateIds"),
    templateKey: formValue(formData, "templateKey"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body"),
    confirmSend: formValue(formData, "confirmSend"),
    returnTo
  });

  if (!parsed.success) {
    redirectWithMailStatus(returnTo, { mail: "invalid" });
  }

  const input = parsed.data;
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { id: true, name: true }
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
      email: true
    },
    orderBy: { updatedAt: "desc" }
  });

  if (candidates.length !== uniqueCandidateIds.length) {
    redirectWithMailStatus(returnTo, { mail: "invalid" });
  }

  const batchId = randomUUID();
  const results: Array<{
    candidateId: string;
    status: "sent" | "preview" | "failure";
    deliveryId: string;
    emailId?: string | null;
    error?: string | null;
  }> = [];

  for (const candidate of candidates) {
    const result = await attemptCandidateEmailDelivery({
      adminId: admin.id,
      group,
      candidate,
      batchId,
      templateKey: input.templateKey,
      subject: input.subject,
      bodyTemplate: input.body
    });
    results.push(result);
  }

  const failed = results.filter((result) => result.status === "failure").length;
  const succeeded = results.length - failed;
  const dryRun = results.some((result) => result.status === "preview");

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      groupId,
      action: "admin.send_candidate_email",
      entityType: "CandidateEmailBatch",
      entityId: batchId,
      afterData: {
        subject: input.subject,
        candidateIds: candidates.map((candidate) => candidate.id),
        deliveryIds: results.map((result) => result.deliveryId),
        recipientCount: candidates.length,
        succeeded,
        failed,
        dryRun,
        results
      }
    }
  });

  revalidatePath(`/admin/groups/${groupId}/candidates`);
  for (const candidate of candidates) {
    revalidatePath(`/admin/groups/${groupId}/candidates/${candidate.id}`);
  }

  if (failed === 0) {
    redirectWithMailStatus(returnTo, { mail: "sent", count: succeeded, dryRun, batchId });
  }
  if (succeeded > 0) {
    redirectWithMailStatus(returnTo, {
      mail: "partial",
      count: succeeded,
      failed,
      dryRun,
      batchId
    });
  }
  redirectWithMailStatus(returnTo, { mail: "error", failed, batchId });
}

export async function retryCandidateEmailDeliveryAction(
  groupId: string,
  deliveryId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canViewCandidates");

  const input = retryCandidateEmailSchema.parse({
    returnTo: formValue(formData, "returnTo")
  });
  const returnTo = sanitizeReturnTo(input.returnTo, groupId);
  const original = await prisma.candidateEmailDelivery.findFirst({
    where: { id: deliveryId, groupId },
    include: {
      group: {
        select: { id: true, name: true }
      },
      candidate: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  if (!original) {
    redirectWithMailStatus(returnTo, { mail: "invalid" });
  }

  const batchId = randomUUID();
  const result = await attemptCandidateEmailDelivery({
    adminId: admin.id,
    group: original.group,
    candidate: original.candidate,
    batchId,
    templateKey: original.templateKey,
    subject: original.subject,
    bodyTemplate: original.bodyTemplate,
    retriedFromId: original.id
  });
  const failed = result.status === "failure" ? 1 : 0;
  const dryRun = result.status === "preview";

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      groupId,
      action: "admin.retry_candidate_email",
      entityType: "CandidateEmailDelivery",
      entityId: result.deliveryId,
      afterData: {
        originalDeliveryId: original.id,
        candidateId: original.candidateId,
        subject: original.subject,
        deliveryId: result.deliveryId,
        failed,
        dryRun
      }
    }
  });

  revalidatePath(`/admin/groups/${groupId}/candidates`);
  revalidatePath(`/admin/groups/${groupId}/candidates/${original.candidateId}`);

  if (failed === 0) {
    redirectWithMailStatus(returnTo, { mail: "sent", count: 1, dryRun, batchId });
  }
  redirectWithMailStatus(returnTo, { mail: "error", failed: 1, batchId });
}
