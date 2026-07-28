import { AppointmentStatus, AuditActorType, EmailOutboxStatus, type Prisma } from "@prisma/client";
import { decryptCandidateAccessContent } from "@/lib/auth/access-link-encryption";
import { sendMailatoEmail, type MailatoRecipient } from "@/lib/mail/mailato";
import { prisma } from "@/lib/db/prisma";
import { pruneExpiredRateLimitBuckets } from "@/lib/rate-limit";
import { processCandidateEmailDeliveryBatch } from "@/server/services/candidate-email";

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

export type CandidateAccessOutboxPayload = {
  kind: "candidate-access";
  groupId: string;
  accessTokenId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  encryptedBody: string;
};

export type AppointmentEmailOutboxPayload = {
  kind: "appointment-email";
  category: "scheduled" | "rescheduled" | "cancelled" | "reminder";
  groupId: string;
  appointmentId: string;
  expectedStartAt: string;
  calendarSequence: number;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  icsFilename: string;
  icsContent: string;
};

type EmailOutboxClient = Pick<Prisma.TransactionClient, "emailOutbox">;
type ResolvedEmail = {
  recipient: MailatoRecipient;
  cc: MailatoRecipient[];
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; content: string }>;
  groupId: string;
  entityType: string;
  entityId: string;
  event: string;
  auditAction: string;
  idempotencyNamespace: string;
  skipReason?: string;
};

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

export async function enqueueCandidateAccessEmail(
  payload: CandidateAccessOutboxPayload,
  client: EmailOutboxClient = prisma
) {
  return client.emailOutbox.create({
    data: {
      dedupeKey: `candidate-access:${payload.accessTokenId}`,
      type: payload.kind,
      payload
    },
    select: { id: true }
  });
}

export async function enqueueAppointmentEmail(
  input: {
    dedupeKey: string;
    payload: AppointmentEmailOutboxPayload;
    nextAttemptAt?: Date;
  },
  client: EmailOutboxClient = prisma
) {
  return client.emailOutbox.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: {
      dedupeKey: input.dedupeKey,
      type: input.payload.kind,
      payload: input.payload,
      nextAttemptAt: input.nextAttemptAt ?? new Date()
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

function parseCandidateAccessPayload(value: unknown): CandidateAccessOutboxPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as CandidateAccessOutboxPayload;
  if (
    payload.kind !== "candidate-access" ||
    !payload.groupId ||
    !payload.accessTokenId ||
    !payload.recipientEmail ||
    !payload.recipientName ||
    !payload.subject ||
    !payload.encryptedBody
  ) {
    return null;
  }
  return payload;
}

function parseAppointmentEmailPayload(value: unknown): AppointmentEmailOutboxPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as AppointmentEmailOutboxPayload;
  if (
    payload.kind !== "appointment-email" ||
    !["scheduled", "rescheduled", "cancelled", "reminder"].includes(payload.category) ||
    !payload.groupId ||
    !payload.appointmentId ||
    !payload.expectedStartAt ||
    !Number.isSafeInteger(payload.calendarSequence) ||
    !payload.recipientEmail ||
    !payload.recipientName ||
    !payload.subject ||
    !payload.body ||
    !payload.icsFilename ||
    !payload.icsContent
  ) {
    return null;
  }
  return payload;
}

async function resolveEmail(payloadValue: unknown): Promise<ResolvedEmail | null> {
  const owner = parseOwnerNotificationPayload(payloadValue);
  if (owner) {
    const [primaryRecipient, ...ccRecipients] = owner.recipients;
    if (!primaryRecipient) {
      return null;
    }
    return {
      recipient: { email: primaryRecipient, name: "Interview Scheduler" },
      cc: ccRecipients.map((email) => ({ email })),
      subject: owner.subject,
      body: owner.body,
      groupId: owner.groupId,
      entityType: owner.entityType,
      entityId: owner.entityId,
      event: owner.event,
      auditAction: "system.owner_notification_email",
      idempotencyNamespace: "owner-notification"
    };
  }

  const candidateAccess = parseCandidateAccessPayload(payloadValue);
  if (candidateAccess) {
    return {
      recipient: {
        email: candidateAccess.recipientEmail,
        name: candidateAccess.recipientName
      },
      cc: [],
      subject: candidateAccess.subject,
      body: decryptCandidateAccessContent(candidateAccess.encryptedBody),
      groupId: candidateAccess.groupId,
      entityType: "CandidateAccessToken",
      entityId: candidateAccess.accessTokenId,
      event: "candidate.request_access_link",
      auditAction: "system.candidate_access_email",
      idempotencyNamespace: "candidate-access"
    };
  }

  const appointmentEmail = parseAppointmentEmailPayload(payloadValue);
  if (!appointmentEmail) {
    return null;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentEmail.appointmentId },
    select: {
      groupId: true,
      startAt: true,
      status: true,
      calendarSequence: true
    }
  });
  const expectsCancellation = appointmentEmail.category === "cancelled";
  const expectedStatus = expectsCancellation
    ? AppointmentStatus.CANCELLED
    : AppointmentStatus.SCHEDULED;
  const stale =
    !appointment ||
    appointment.groupId !== appointmentEmail.groupId ||
    appointment.status !== expectedStatus ||
    appointment.calendarSequence !== appointmentEmail.calendarSequence ||
    appointment.startAt.toISOString() !== appointmentEmail.expectedStartAt;

  return {
    recipient: {
      email: appointmentEmail.recipientEmail,
      name: appointmentEmail.recipientName
    },
    cc: [],
    subject: appointmentEmail.subject,
    body: appointmentEmail.body,
    attachments: [
      {
        filename: appointmentEmail.icsFilename,
        content: appointmentEmail.icsContent
      }
    ],
    groupId: appointmentEmail.groupId,
    entityType: "Appointment",
    entityId: appointmentEmail.appointmentId,
    event: `appointment.${appointmentEmail.category}`,
    auditAction: "system.appointment_email",
    idempotencyNamespace: "appointment-email",
    skipReason: stale ? "appointment_state_changed" : undefined
  };
}

async function markInvalidPayload(itemId: string, now: Date, error: unknown) {
  await prisma.emailOutbox.update({
    where: { id: itemId },
    data: {
      status: EmailOutboxStatus.FAILED,
      lastError: safeErrorMessage(error),
      nextAttemptAt: new Date(now.getTime() + 60 * 60 * 1000),
      leaseExpiresAt: null
    }
  });
}

export async function processEmailOutboxBatch({ take = 20 } = {}) {
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
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
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
            status: item.status,
            nextAttemptAt: { lte: now }
          };
    const claimed = await prisma.emailOutbox.updateMany({
      where: claimWhere,
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

    let email: ResolvedEmail | null;
    try {
      email = await resolveEmail(item.payload);
    } catch (error) {
      await markInvalidPayload(item.id, now, error);
      failed += 1;
      continue;
    }
    if (!email) {
      await markInvalidPayload(item.id, now, new Error("Invalid email outbox payload."));
      failed += 1;
      continue;
    }
    const auditGroup = await prisma.interviewGroup.findUnique({
      where: { id: email.groupId },
      select: { id: true }
    });
    const auditGroupId = auditGroup?.id ?? null;
    if (!auditGroup) {
      email.skipReason = "group_deleted";
    }

    if (email.skipReason) {
      await prisma.$transaction([
        prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            status: EmailOutboxStatus.SENT,
            processedAt: new Date(),
            lastError: email.skipReason,
            leaseExpiresAt: null
          }
        }),
        prisma.auditLog.create({
          data: {
            actorType: AuditActorType.SYSTEM,
            groupId: auditGroupId,
            action: "system.appointment_email_skipped",
            entityType: email.entityType,
            entityId: email.entityId,
            afterData: {
              event: email.event,
              reason: email.skipReason,
              outboxId: item.id
            }
          }
        })
      ]);
      skipped += 1;
      continue;
    }

    try {
      const result = await sendMailatoEmail({
        recipient: email.recipient,
        cc: email.cc,
        subject: email.subject,
        body: email.body,
        attachments: email.attachments,
        idempotencyKey: `${email.idempotencyNamespace}:${item.id}`,
        auditId: `${email.idempotencyNamespace}:${item.id}`,
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
            groupId: auditGroupId,
            action: email.auditAction,
            entityType: email.entityType,
            entityId: email.entityId,
            afterData: {
              event: email.event,
              recipientCount: 1 + email.cc.length,
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
            groupId: auditGroupId,
            action: email.auditAction,
            entityType: email.entityType,
            entityId: email.entityId,
            afterData: {
              event: email.event,
              recipientCount: 1 + email.cc.length,
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

  const candidateDeliveries = await processCandidateEmailDeliveryBatch({ take: safeTake });
  return { processed: items.length, sent, failed, skipped, candidateDeliveries };
}
