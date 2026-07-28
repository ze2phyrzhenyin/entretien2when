import { randomUUID } from "node:crypto";
import { AuditActorType, CandidateEmailDeliveryStatus, type Prisma } from "@prisma/client";
import {
  renderCandidateEmailTemplate,
  type CandidateEmailTemplateValues
} from "@/lib/mail/render-template";
import { sendMailatoEmail } from "@/lib/mail/mailato";
import { prisma } from "@/lib/db/prisma";

type EmailGroup = {
  id: string;
  name: string;
};

type EmailCandidate = {
  id: string;
  name: string;
  email: string;
};

export type CandidateEmailDeliveryPayload = {
  id: string;
  candidateId: string;
  groupId: string;
  candidateNameSnapshot: string;
  recipientEmailSnapshot: string;
  ccEmailSnapshots: string[];
  idempotencyKey: string | null;
  renderedSubject: string | null;
  renderedBody: string | null;
  attempts: number;
  maxAttempts: number;
};

type CandidateEmailDeliveryWriter = Pick<Prisma.TransactionClient, "candidateEmailDelivery">;

export type CreateCandidateEmailDeliveryInput = {
  adminId: string;
  group: EmailGroup;
  candidate: EmailCandidate;
  batchId: string;
  templateKey?: string | null;
  subject: string;
  bodyTemplate: string;
  ccEmails?: string[];
  templateValues?: Partial<
    Pick<CandidateEmailTemplateValues, "appointmentTime" | "meetingLocation" | "candidateMessage">
  >;
  retriedFromId?: string | null;
};

const CANDIDATE_EMAIL_LEASE_MS = 2 * 60 * 1000;

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0]?.slice(0, 240) || "发送失败";
  }
  return "发送失败";
}

function leaseExpiresAt(now = new Date()) {
  return new Date(now.getTime() + CANDIDATE_EMAIL_LEASE_MS);
}

function retryAt(attempts: number, now = new Date()) {
  return new Date(now.getTime() + Math.min(60, Math.max(1, attempts) * 5) * 60 * 1000);
}

function deliverySelect() {
  return {
    id: true,
    candidateId: true,
    groupId: true,
    candidateNameSnapshot: true,
    recipientEmailSnapshot: true,
    ccEmailSnapshots: true,
    idempotencyKey: true,
    renderedSubject: true,
    renderedBody: true,
    attempts: true,
    maxAttempts: true
  } as const;
}

/**
 * Persist immutable rendered content before any provider call. Business
 * actions only enqueue; the minute-level worker claims and sends later.
 */
export async function createCandidateEmailDelivery(
  input: CreateCandidateEmailDeliveryInput,
  client: CandidateEmailDeliveryWriter = prisma
) {
  const templateValues: CandidateEmailTemplateValues = {
    candidateName: input.candidate.name,
    candidateEmail: input.candidate.email,
    groupName: input.group.name,
    appointmentTime: input.templateValues?.appointmentTime ?? "尚未安排",
    meetingLocation: input.templateValues?.meetingLocation ?? "未填写",
    candidateMessage: input.templateValues?.candidateMessage ?? ""
  };

  return client.candidateEmailDelivery.create({
    data: {
      groupId: input.group.id,
      candidateId: input.candidate.id,
      sentByAdminId: input.adminId,
      batchId: input.batchId,
      templateKey: input.templateKey || null,
      subject: input.subject,
      bodyTemplate: input.bodyTemplate,
      renderedSubject: renderCandidateEmailTemplate(input.subject, templateValues),
      renderedBody: renderCandidateEmailTemplate(input.bodyTemplate, templateValues),
      candidateNameSnapshot: input.candidate.name,
      recipientEmailSnapshot: input.candidate.email,
      ccEmailSnapshots: input.ccEmails ?? [],
      status: CandidateEmailDeliveryStatus.PENDING,
      idempotencyKey: `candidate-email:${randomUUID()}`,
      nextAttemptAt: new Date(),
      leaseExpiresAt: null,
      retriedFromId: input.retriedFromId || null
    },
    select: deliverySelect()
  });
}

async function deliverClaimedCandidateEmail(delivery: CandidateEmailDeliveryPayload) {
  if (
    !delivery.idempotencyKey ||
    !delivery.renderedSubject ||
    !delivery.renderedBody ||
    !delivery.recipientEmailSnapshot
  ) {
    throw new Error(
      "This legacy delivery has no durable rendered payload and cannot be retried safely."
    );
  }

  try {
    const result = await sendMailatoEmail({
      recipient: {
        email: delivery.recipientEmailSnapshot,
        name: delivery.candidateNameSnapshot
      },
      cc: delivery.ccEmailSnapshots.map((email) => ({ email })),
      subject: delivery.renderedSubject,
      body: delivery.renderedBody,
      idempotencyKey: delivery.idempotencyKey,
      auditId: delivery.idempotencyKey
    });
    await prisma.candidateEmailDelivery.update({
      where: { id: delivery.id },
      data: {
        status:
          result.status === "sent"
            ? CandidateEmailDeliveryStatus.SENT
            : CandidateEmailDeliveryStatus.PREVIEW,
        providerMessageId: result.emailId ?? null,
        errorMessage: null,
        leaseExpiresAt: null
      }
    });

    return {
      deliveryId: delivery.id,
      candidateId: delivery.candidateId,
      status: result.status,
      emailId: result.emailId ?? null,
      error: null
    };
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const exhausted = delivery.attempts >= delivery.maxAttempts;
    await prisma.candidateEmailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: exhausted
          ? CandidateEmailDeliveryStatus.FAILED
          : CandidateEmailDeliveryStatus.PENDING,
        errorMessage,
        nextAttemptAt: retryAt(delivery.attempts),
        leaseExpiresAt: null
      }
    });

    return {
      deliveryId: delivery.id,
      candidateId: delivery.candidateId,
      status: exhausted ? ("failure" as const) : ("retry" as const),
      emailId: null,
      error: errorMessage
    };
  }
}

export async function requeueCandidateEmailDelivery(deliveryId: string, batchId: string) {
  const resumed = await prisma.candidateEmailDelivery.updateMany({
    where: {
      id: deliveryId,
      status: CandidateEmailDeliveryStatus.FAILED,
      idempotencyKey: { not: null },
      renderedSubject: { not: null },
      renderedBody: { not: null }
    },
    data: {
      status: CandidateEmailDeliveryStatus.PENDING,
      errorMessage: null,
      providerMessageId: null,
      batchId,
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseExpiresAt: null
    }
  });
  if (resumed.count !== 1) {
    throw new Error("The email delivery is no longer retryable or is already queued.");
  }
}

/**
 * Claim due new work and expired leases. All claims are conditional, so
 * multiple workers can run without submitting the same row concurrently.
 */
export async function processCandidateEmailDeliveryBatch({ take = 20 } = {}) {
  const now = new Date();
  const legacyProcessingStaleAt = new Date(now.getTime() - CANDIDATE_EMAIL_LEASE_MS);
  const safeTake = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;
  const candidates = await prisma.candidateEmailDelivery.findMany({
    where: {
      idempotencyKey: { not: null },
      renderedSubject: { not: null },
      renderedBody: { not: null },
      attempts: { lt: prisma.candidateEmailDelivery.fields.maxAttempts },
      OR: [
        {
          status: CandidateEmailDeliveryStatus.PENDING,
          nextAttemptAt: { lte: now }
        },
        {
          status: CandidateEmailDeliveryStatus.PROCESSING,
          OR: [
            { leaseExpiresAt: { lte: now } },
            { leaseExpiresAt: null, updatedAt: { lte: legacyProcessingStaleAt } }
          ]
        }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: safeTake,
    select: {
      ...deliverySelect(),
      status: true,
      leaseExpiresAt: true,
      updatedAt: true
    }
  });

  let sent = 0;
  let failed = 0;
  let retrying = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const claimWhere =
      candidate.status === CandidateEmailDeliveryStatus.PENDING
        ? {
            id: candidate.id,
            status: CandidateEmailDeliveryStatus.PENDING,
            nextAttemptAt: { lte: now }
          }
        : {
            id: candidate.id,
            status: CandidateEmailDeliveryStatus.PROCESSING,
            OR: [
              { leaseExpiresAt: { lte: now } },
              { leaseExpiresAt: null, updatedAt: { lte: legacyProcessingStaleAt } }
            ]
          };
    const claimed = await prisma.candidateEmailDelivery.updateMany({
      where: claimWhere,
      data: {
        status: CandidateEmailDeliveryStatus.PROCESSING,
        attempts: { increment: 1 },
        leaseExpiresAt: leaseExpiresAt(now),
        errorMessage: null
      }
    });
    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }

    const result = await deliverClaimedCandidateEmail({
      ...candidate,
      attempts: candidate.attempts + 1
    });
    if (result.status === "failure") {
      failed += 1;
    } else if (result.status === "retry") {
      retrying += 1;
    } else {
      sent += 1;
    }

    const auditGroup = await prisma.interviewGroup.findUnique({
      where: { id: candidate.groupId },
      select: { id: true }
    });
    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        groupId: auditGroup?.id ?? null,
        action: "system.process_candidate_email_delivery",
        entityType: "CandidateEmailDelivery",
        entityId: candidate.id,
        afterData: {
          status: result.status,
          emailId: result.emailId,
          error: result.error,
          attempts: candidate.attempts + 1
        }
      }
    });
  }

  return { processed: candidates.length, sent, failed, retrying, skipped };
}

// Compatibility export for operations code deployed before the queue rename.
export const processCandidateEmailRecoveryBatch = processCandidateEmailDeliveryBatch;
