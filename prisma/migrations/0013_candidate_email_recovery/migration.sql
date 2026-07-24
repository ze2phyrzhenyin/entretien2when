-- Candidate email rows are written before contacting the provider. Persist the
-- rendered payload and a finite lease so a process crash can safely retry the
-- exact same message with its already-stable provider idempotency key.
ALTER TABLE "CandidateEmailDelivery"
  ADD COLUMN "renderedSubject" TEXT,
  ADD COLUMN "renderedBody" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "CandidateEmailDelivery_status_leaseExpiresAt_idx"
  ON "CandidateEmailDelivery"("status", "leaseExpiresAt");
