"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditActorType } from "@prisma/client";
import { renderCandidateEmailBody, sendMailatoEmail } from "@/lib/mail/mailato";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue, formValues } from "@/lib/validation/common";
import { candidateEmailActionSchema } from "@/lib/validation/email";

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
  redirect(`${url.pathname}${url.search}`);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0]?.slice(0, 240) || "发送失败";
  }
  return "发送失败";
}

export async function sendCandidateEmailAction(groupId: string, formData: FormData) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, "canViewCandidates");

  const returnTo = sanitizeReturnTo(formValue(formData, "returnTo"), groupId);
  const parsed = candidateEmailActionSchema.safeParse({
    candidateIds: formValues(formData, "candidateIds"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body"),
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
    emailId?: string | null;
    error?: string;
  }> = [];

  for (const candidate of candidates) {
    try {
      const result = await sendMailatoEmail({
        recipient: {
          email: candidate.email,
          name: candidate.name
        },
        subject: input.subject,
        body: renderCandidateEmailBody(input.body, {
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          groupName: group.name
        }),
        auditId: `${batchId}:${candidate.id}`
      });
      results.push({
        candidateId: candidate.id,
        status: result.status,
        emailId: result.emailId
      });
    } catch (error) {
      results.push({
        candidateId: candidate.id,
        status: "failure",
        error: safeErrorMessage(error)
      });
    }
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
    redirectWithMailStatus(returnTo, { mail: "sent", count: succeeded, dryRun });
  }
  if (succeeded > 0) {
    redirectWithMailStatus(returnTo, { mail: "partial", count: succeeded, failed, dryRun });
  }
  redirectWithMailStatus(returnTo, { mail: "error", failed });
}
