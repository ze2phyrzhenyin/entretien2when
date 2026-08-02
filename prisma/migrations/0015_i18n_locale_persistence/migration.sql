-- Persist the language selected when candidate-facing content is created.
-- Existing rows keep the product's historical Chinese default.
ALTER TABLE "Candidate"
  ADD COLUMN "preferredLocale" TEXT NOT NULL DEFAULT 'zh-CN';

ALTER TABLE "CandidateAccessToken"
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'zh-CN';

ALTER TABLE "CandidateSession"
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'zh-CN';

ALTER TABLE "CandidateEmailDelivery"
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'zh-CN';

-- Email-template overrides are authored content. Existing overrides belong to
-- the product's historical Chinese locale; new overrides are isolated by locale.
ALTER TABLE "EmailTemplate"
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'zh-CN';

DROP INDEX "EmailTemplate_key_key";

CREATE UNIQUE INDEX "EmailTemplate_key_locale_key"
  ON "EmailTemplate"("key", "locale");

CREATE INDEX "EmailTemplate_locale_idx"
  ON "EmailTemplate"("locale");

ALTER TABLE "Candidate"
  ADD CONSTRAINT "Candidate_preferredLocale_check"
  CHECK ("preferredLocale" IN ('zh-CN', 'en'));

ALTER TABLE "CandidateAccessToken"
  ADD CONSTRAINT "CandidateAccessToken_locale_check"
  CHECK ("locale" IN ('zh-CN', 'en'));

ALTER TABLE "CandidateSession"
  ADD CONSTRAINT "CandidateSession_locale_check"
  CHECK ("locale" IN ('zh-CN', 'en'));

ALTER TABLE "CandidateEmailDelivery"
  ADD CONSTRAINT "CandidateEmailDelivery_locale_check"
  CHECK ("locale" IN ('zh-CN', 'en'));

ALTER TABLE "EmailTemplate"
  ADD CONSTRAINT "EmailTemplate_locale_check"
  CHECK ("locale" IN ('zh-CN', 'en'));
