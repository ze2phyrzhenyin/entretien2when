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
    renderedBody: true
  } as const;
}

/**
 * Persist an immutable, recoverable delivery before any provider call.  The
 * optional transaction client lets a business action create its event and the
 * email record atomically; the caller must dispatch only after that
 * transaction commits.
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
  const renderedSubject = renderCandidateEmailTemplate(input.subject, templateValues);
  const renderedBody = renderCandidateEmailTemplate(input.bodyTemplate, templateValues);

  return client.candidateEmailDelivery.create({
    data: {
      groupId: input.group.id,
      candidateId: input.candidate.id,
      sentByAdminId: input.adminId,
      batchId: input.batchId,
      templateKey: input.templateKey || null,
      subject: input.subject,
      bodyTemplate: input.bodyTemplate,
      renderedSubject,
      renderedBody,
      candidateNameSnapshot: input.candidate.name,
      recipientEmailSnapshot: input.candidate.email,
      ccEmailSnapshots: input.ccEmails ?? [],
      // Persist all data required for recovery before the external side
      // effect. A database failure can therefore never make an already
      // delivered message appear to be a new message.
      status: CandidateEmailDeliveryStatus.PROCESSING,
      idempotencyKey: `candidate-email:${randomUUID()}`,
      leaseExpiresAt: leaseExpiresAt(),
      retriedFromId: input.retriedFromId || null
    },
    select: deliverySelect()
  });
}

async function deliverClaimedCandidateEmail(
  delivery: CandidateEmailDeliveryPayload,
  candidateId = delivery.candidateId
) {
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
      // This key is created before any provider call. Provider-side idempotency
      // makes recovery safe if a request crashes after the provider accepted it.
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
      candidateId,
      status: result.status,
      emailId: result.emailId ?? null,
      error: null
    };
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    // Keep the stable key for both explicit and worker recovery. If this
    // update itself fails, the finite PROCESSING lease makes the row eligible
    // for a replay-safe recovery attempt later.
    await prisma.candidateEmailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: CandidateEmailDeliveryStatus.FAILED,
        errorMessage,
        leaseExpiresAt: null
      }
    });

    return {
      deliveryId: delivery.id,
      candidateId,
      status: "failure" as const,
      emailId: null,
      error: errorMessage
    };
  }
}

/** Dispatch a delivery that has already been durably persisted as PROCESSING. */
export async function deliverPersistedCandidateEmailDelivery(deliveryId: string) {
  const delivery = await prisma.candidateEmailDelivery.findFirst({
    where: {
      id: deliveryId,
      status: CandidateEmailDeliveryStatus.PROCESSING
    },
    select: deliverySelect()
  });

  if (!delivery) {
    throw new Error("The candidate email delivery is no longer pending.");
  }

  return deliverClaimedCandidateEmail(delivery);
}

async function resumeCandidateEmailDelivery(deliveryId: string, batchId: string) {
  const resumed = await prisma.candidateEmailDelivery.updateMany({
    where: {
      id: deliveryId,
      status: CandidateEmailDeliveryStatus.FAILED,
      idempotencyKey: { not: null },
      renderedSubject: { not: null },
      renderedBody: { not: null }
    },
    data: {
      status: CandidateEmailDeliveryStatus.PROCESSING,
      errorMessage: null,
      providerMessageId: null,
      batchId,
      leaseExpiresAt: leaseExpiresAt()
    }
  });

  if (resumed.count !== 1) {
    throw new Error("The email delivery is no longer retryable or is already being processed.");
  }

  return prisma.candidateEmailDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    select: deliverySelect()
  });
}

export async function attemptCandidateEmailDelivery(input: {
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
  /** Resume a known failed, idempotent delivery instead of creating a new send. */
  deliveryId?: string | null;
  retriedFromId?: string | null;
}) {
  let delivery: CandidateEmailDeliveryPayload;

  if (input.deliveryId) {
    // Retrying must use the original persisted rendered content, not any
    // mutable appointment/template value supplied by a later page render.
    delivery = await resumeCandidateEmailDelivery(input.deliveryId, input.batchId);
  } else {
    delivery = await createCandidateEmailDelivery(input);
  }

  return deliverClaimedCandidateEmail(delivery, input.candidate.id);
}

/**
 * Reclaim deliveries whose sender crashed after persisting the message but
 * before recording the provider result. Only rows with a stable idempotency
 * key plus immutable rendered content are ever retried automatically.
 */
export async function processCandidateEmailRecoveryBatch({ take = 20 } = {}) {
  const now = new Date();
  const legacyProcessingStaleAt = new Date(now.getTime() - CANDIDATE_EMAIL_LEASE_MS);
  const safeTake = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;
  const candidates = await prisma.candidateEmailDelivery.findMany({
    where: {
      status: CandidateEmailDeliveryStatus.PROCESSING,
      idempotencyKey: { not: null },
      renderedSubject: { not: null },
      renderedBody: { not: null },
      OR: [
        { leaseExpiresAt: { lte: now } },
        { leaseExpiresAt: null, updatedAt: { lte: legacyProcessingStaleAt } }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: safeTake,
    select: deliverySelect()
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const claimed = await prisma.candidateEmailDelivery.updateMany({
      where: {
        id: candidate.id,
        status: CandidateEmailDeliveryStatus.PROCESSING,
        OR: [
          { leaseExpiresAt: { lte: now } },
          { leaseExpiresAt: null, updatedAt: { lte: legacyProcessingStaleAt } }
        ]
      },
      data: {
        leaseExpiresAt: leaseExpiresAt(now),
        errorMessage: null
      }
    });
    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }

    const result = await deliverClaimedCandidateEmail(candidate);
    if (result.status === "failure") {
      failed += 1;
    } else {
      sent += 1;
    }

    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        groupId: candidate.groupId,
        action: "system.recover_candidate_email_delivery",
        entityType: "CandidateEmailDelivery",
        entityId: candidate.id,
        afterData: {
          status: result.status,
          emailId: result.emailId,
          error: result.error
        }
      }
    });
  }

  return { processed: candidates.length, sent, failed, skipped };
}
