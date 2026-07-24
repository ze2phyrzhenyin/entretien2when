-- A claimed outbox item needs a finite lease so a crashed worker cannot leave
-- it in PROCESSING forever. Candidate deliveries use PROCESSING as the durable
-- pre-send state, so the provider idempotency key can be derived from its id.
ALTER TYPE "CandidateEmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "CandidateEmailDelivery"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "CandidateEmailDelivery_idempotencyKey_key"
  ON "CandidateEmailDelivery"("idempotencyKey");

ALTER TABLE "EmailOutbox"
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "EmailOutbox_status_leaseExpiresAt_idx"
  ON "EmailOutbox"("status", "leaseExpiresAt");
