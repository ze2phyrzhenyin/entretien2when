CREATE TYPE "AdminGroupRole" AS ENUM ('OWNER', 'SCHEDULER', 'REVIEWER', 'VIEWER');

CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "AdminGroupMembership" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" "AdminGroupRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminGroupMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateAccessToken" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateSession" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "candidateId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminGroupMembership_adminId_groupId_key" ON "AdminGroupMembership"("adminId", "groupId");
CREATE INDEX "AdminGroupMembership_groupId_role_idx" ON "AdminGroupMembership"("groupId", "role");
CREATE INDEX "AdminGroupMembership_adminId_role_idx" ON "AdminGroupMembership"("adminId", "role");

CREATE UNIQUE INDEX "CandidateAccessToken_tokenHash_key" ON "CandidateAccessToken"("tokenHash");
CREATE INDEX "CandidateAccessToken_groupId_normalizedEmail_idx" ON "CandidateAccessToken"("groupId", "normalizedEmail");
CREATE INDEX "CandidateAccessToken_expiresAt_idx" ON "CandidateAccessToken"("expiresAt");

CREATE UNIQUE INDEX "CandidateSession_tokenHash_key" ON "CandidateSession"("tokenHash");
CREATE INDEX "CandidateSession_groupId_normalizedEmail_idx" ON "CandidateSession"("groupId", "normalizedEmail");
CREATE INDEX "CandidateSession_candidateId_idx" ON "CandidateSession"("candidateId");
CREATE INDEX "CandidateSession_expiresAt_idx" ON "CandidateSession"("expiresAt");

CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");
CREATE INDEX "EmailOutbox_type_createdAt_idx" ON "EmailOutbox"("type", "createdAt");

ALTER TABLE "AdminGroupMembership" ADD CONSTRAINT "AdminGroupMembership_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminGroupMembership" ADD CONSTRAINT "AdminGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateAccessToken" ADD CONSTRAINT "CandidateAccessToken_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateSession" ADD CONSTRAINT "CandidateSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateSession" ADD CONSTRAINT "CandidateSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AdminGroupMembership" ("id", "adminId", "groupId", "role", "updatedAt")
SELECT
  'cm' || md5("createdByAdminId" || ':' || "id"),
  "createdByAdminId",
  "id",
  'OWNER'::"AdminGroupRole",
  CURRENT_TIMESTAMP
FROM "InterviewGroup"
ON CONFLICT ("adminId", "groupId") DO NOTHING;
