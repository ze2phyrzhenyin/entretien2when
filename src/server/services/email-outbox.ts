import { AuditActorType, EmailOutboxStatus, type Prisma } from "@prisma/client";
import { sendMailatoEmail } from "@/lib/mail/mailato";
import { prisma } from "@/lib/db/prisma";
import { pruneExpiredRateLimitBuckets } from "@/lib/rate-limit";
import { processCandidateEmailRecoveryBatch } from "@/server/services/candidate-email";

export type OwnerNotificationOutboxPayload = {
  kind: "owner-notification";
  groupId: string;
  entityType: "CandidateSubmission" | "Appointment";
  entityId: string;
  event: string;
  recipients: string[];
  subject: string;
  body: string;
};

type EmailOutboxClient = Pick<Prisma.TransactionClient, "emailOutbox">;

const OUTBOX_LEASE_MS = 2 * 60 * 1000;

export async function enqueueOwnerNotificationEmail(
  payload: OwnerNotificationOutboxPayload,
  client: EmailOutboxClient = prisma
) {
  if (payload.recipients.length === 0) {
    throw new Error("Owner notification requires at least one active group owner.");
  }

  return client.emailOutbox.create({
    data: {
      type: payload.kind,
      payload
    },
    select: { id: true }
  });
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0]?.slice(0, 240) || "邮件发送失败";
  }
  return "邮件发送失败";
}

function parseOwnerNotificationPayload(value: unknown): OwnerNotificationOutboxPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as OwnerNotificationOutboxPayload;
  if (
    payload.kind !== "owner-notification" ||
    !payload.groupId ||
    !payload.entityType ||
    !payload.entityId ||
    !payload.event ||
    !Array.isArray(payload.recipients) ||
    payload.recipients.length === 0 ||
    !payload.recipients.every((recipient) => typeof recipient === "string" && recipient.trim()) ||
    !payload.subject ||
    !payload.body
  ) {
    return null;
  }
  return payload;
}

export async function processEmailOutboxBatch({ take = 20 } = {}) {
  // The systemd timer invokes this worker once per minute in production. Keep
  // short-lived shared rate-limit buckets pruned without another daemon.
  await pruneExpiredRateLimitBuckets();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + OUTBOX_LEASE_MS);
  const legacyProcessingStaleAt = new Date(now.getTime() - OUTBOX_LEASE_MS);
  const safeTake = Number.isFinite(take) ? Math.max(1, Math.min(100, Math.floor(take))) : 20;
  const items = await prisma.emailOutbox.findMany({
    where: {
      OR: [
        {
          status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.FAILED] },
          nextAttemptAt: { lte: now },
          attempts: { lt: prisma.emailOutbox.fields.maxAttempts }
        },
        {
          status: EmailOutboxStatus.PROCESSING,
          attempts: { lt: prisma.emailOutbox.fields.maxAttempts },
          OR: [
            { leaseExpiresAt: { lte: now } },
            { leaseExpiresAt: null, updatedAt: { lte: legacyProcessingStaleAt } }
          ]
        }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: safeTake
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items) {
    const claimWhere =
      item.status === EmailOutboxStatus.PROCESSING
        ? {
            id: item.id,
            status: EmailOutboxStatus.PROCESSING,
            OR: [
              { leaseExpiresAt: { lte: now } },
              { leaseExpiresAt: null, updatedAt: { lte: legacyProcessingStaleAt } }
            ]
          }
        : {
            id: item.id,
            status: item.status
          };
    const claimed = await prisma.emailOutbox.updateMany({
      where: {
        ...claimWhere
      },
      data: {
        status: EmailOutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
        leaseExpiresAt
      }
    });

    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }

    const payload = parseOwnerNotificationPayload(item.payload);
    if (!payload) {
      await prisma.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: EmailOutboxStatus.FAILED,
          lastError: "Invalid email outbox payload.",
          nextAttemptAt: new Date(now.getTime() + 60 * 60 * 1000),
          leaseExpiresAt: null
        }
      });
      failed += 1;
      continue;
    }

    const [primaryRecipient, ...ccRecipients] = payload.recipients;
    if (!primaryRecipient) {
      await prisma.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: EmailOutboxStatus.SENT,
          processedAt: new Date(),
          leaseExpiresAt: null
        }
      });
      skipped += 1;
      continue;
    }

    try {
      const result = await sendMailatoEmail({
        recipient: {
          email: primaryRecipient,
          name: "Interview Scheduler"
        },
        cc: ccRecipients.map((email) => ({ email })),
        subject: payload.subject,
        body: payload.body,
        // The outbox id is durable before the provider call, so retries use the
        // same provider idempotency key even if this worker crashes mid-send.
        idempotencyKey: `owner-notification:${item.id}`,
        auditId: `owner-notification:${item.id}`,
        timeoutMs: 15_000
      });

      await prisma.$transaction([
        prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            status: EmailOutboxStatus.SENT,
            processedAt: new Date(),
            lastError: null,
            leaseExpiresAt: null
          }
        }),
        prisma.auditLog.create({
          data: {
            actorType: AuditActorType.SYSTEM,
            groupId: payload.groupId,
            action: "system.owner_notification_email",
            entityType: payload.entityType,
            entityId: payload.entityId,
            afterData: {
              event: payload.event,
              recipients: payload.recipients,
              status: result.status,
              emailId: result.emailId ?? null,
              dryRun: result.dryRun,
              outboxId: item.id
            }
          }
        })
      ]);
      sent += 1;
    } catch (error) {
      const errorMessage = safeErrorMessage(error);
      const attempts = item.attempts + 1;
      const exhausted = attempts >= item.maxAttempts;
      await prisma.$transaction([
        prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            status: exhausted ? EmailOutboxStatus.FAILED : EmailOutboxStatus.PENDING,
            lastError: errorMessage,
            nextAttemptAt: new Date(now.getTime() + Math.min(60, attempts * 5) * 60 * 1000),
            leaseExpiresAt: null
          }
        }),
        prisma.auditLog.create({
          data: {
            actorType: AuditActorType.SYSTEM,
            groupId: payload.groupId,
            action: "system.owner_notification_email",
            entityType: payload.entityType,
            entityId: payload.entityId,
            afterData: {
              event: payload.event,
              recipients: payload.recipients,
              status: "failure",
              errorMessage,
              outboxId: item.id
            }
          }
        })
      ]);
      failed += 1;
    }
  }

  const candidateRecovery = await processCandidateEmailRecoveryBatch({ take: safeTake });
  return { processed: items.length, sent, failed, skipped, candidateRecovery };
}
