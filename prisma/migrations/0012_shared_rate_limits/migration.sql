-- Rate limiting must be shared by all web instances. A database-backed
-- fixed-window counter avoids process-local bypasses and keeps hashed client
-- identities out of application memory after a request completes.
CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
