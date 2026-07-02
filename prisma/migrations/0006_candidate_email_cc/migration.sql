ALTER TABLE "CandidateEmailDelivery"
  ADD COLUMN "ccEmailSnapshots" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
