-- Candidate messages must be queued before a provider call. Existing
-- PROCESSING rows remain recoverable through their leases.
ALTER TYPE "CandidateEmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TABLE "CandidateEmailDelivery"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "CandidateEmailDelivery_status_nextAttemptAt_idx"
  ON "CandidateEmailDelivery"("status", "nextAttemptAt");

-- Stable keys make appointment notifications and reminders idempotent even
-- when a scheduling transaction is retried.
ALTER TABLE "EmailOutbox"
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key"
  ON "EmailOutbox"("dedupeKey");

ALTER TABLE "Appointment"
  ADD COLUMN "calendarSequence" INTEGER NOT NULL DEFAULT 0;
