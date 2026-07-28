import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";

function positiveDays(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function beforeDays(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function counts(now = new Date()) {
  const accessRetentionDays = positiveDays("AUTH_ARTIFACT_RETENTION_DAYS", 7);
  const emailRetentionDays = positiveDays("EMAIL_CONTENT_RETENTION_DAYS", 90);
  const auditRetentionDays = positiveDays("AUDIT_LOG_RETENTION_DAYS", 365);
  return {
    adminSessions: await prisma.adminSession.count({ where: { expiresAt: { lt: now } } }),
    candidateSessions: await prisma.candidateSession.count({ where: { expiresAt: { lt: now } } }),
    candidateAccessTokens: await prisma.candidateAccessToken.count({
      where: {
        OR: [
          { expiresAt: { lt: beforeDays(accessRetentionDays, now) } },
          { consumedAt: { lt: beforeDays(accessRetentionDays, now) } }
        ]
      }
    }),
    candidateEmailDeliveries: await prisma.candidateEmailDelivery.count({
      where: {
        createdAt: { lt: beforeDays(emailRetentionDays, now) },
        status: { in: ["SENT", "PREVIEW", "FAILED"] }
      }
    }),
    emailOutbox: await prisma.emailOutbox.count({
      where: {
        updatedAt: { lt: beforeDays(emailRetentionDays, now) },
        status: { in: ["SENT", "FAILED"] }
      }
    }),
    auditLogs: await prisma.auditLog.count({
      where: { createdAt: { lt: beforeDays(auditRetentionDays, now) } }
    }),
    expiredRateLimitBuckets: await prisma.rateLimitBucket.count({
      where: { resetAt: { lt: beforeDays(1, now) } }
    })
  };
}

async function prune(now = new Date()) {
  const accessRetentionDays = positiveDays("AUTH_ARTIFACT_RETENTION_DAYS", 7);
  const emailRetentionDays = positiveDays("EMAIL_CONTENT_RETENTION_DAYS", 90);
  const auditRetentionDays = positiveDays("AUDIT_LOG_RETENTION_DAYS", 365);
  return prisma.$transaction(async (tx) => ({
    adminSessions: (await tx.adminSession.deleteMany({ where: { expiresAt: { lt: now } } })).count,
    candidateSessions: (await tx.candidateSession.deleteMany({ where: { expiresAt: { lt: now } } }))
      .count,
    candidateAccessTokens: (
      await tx.candidateAccessToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: beforeDays(accessRetentionDays, now) } },
            { consumedAt: { lt: beforeDays(accessRetentionDays, now) } }
          ]
        }
      })
    ).count,
    candidateEmailDeliveries: (
      await tx.candidateEmailDelivery.deleteMany({
        where: {
          createdAt: { lt: beforeDays(emailRetentionDays, now) },
          status: { in: ["SENT", "PREVIEW", "FAILED"] }
        }
      })
    ).count,
    emailOutbox: (
      await tx.emailOutbox.deleteMany({
        where: {
          updatedAt: { lt: beforeDays(emailRetentionDays, now) },
          status: { in: ["SENT", "FAILED"] }
        }
      })
    ).count,
    auditLogs: (
      await tx.auditLog.deleteMany({
        where: { createdAt: { lt: beforeDays(auditRetentionDays, now) } }
      })
    ).count,
    expiredRateLimitBuckets: (
      await tx.rateLimitBucket.deleteMany({
        where: { resetAt: { lt: beforeDays(1, now) } }
      })
    ).count
  }));
}

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const result = confirmed ? await prune() : await counts();
  console.log(
    JSON.stringify(
      {
        mode: confirmed ? "deleted" : "dry-run",
        retentionDays: {
          authArtifacts: positiveDays("AUTH_ARTIFACT_RETENTION_DAYS", 7),
          emailContent: positiveDays("EMAIL_CONTENT_RETENTION_DAYS", 90),
          auditLogs: positiveDays("AUDIT_LOG_RETENTION_DAYS", 365)
        },
        records: result
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
