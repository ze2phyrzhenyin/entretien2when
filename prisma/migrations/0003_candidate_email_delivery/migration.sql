-- CreateEnum
CREATE TYPE "CandidateEmailDeliveryStatus" AS ENUM ('SENT', 'PREVIEW', 'FAILED');

-- CreateTable
CREATE TABLE "CandidateEmailDelivery" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sentByAdminId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "templateKey" TEXT,
    "subject" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "candidateNameSnapshot" TEXT NOT NULL,
    "recipientEmailSnapshot" TEXT NOT NULL,
    "status" "CandidateEmailDeliveryStatus" NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "retriedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateEmailDelivery_groupId_createdAt_idx" ON "CandidateEmailDelivery"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateEmailDelivery_candidateId_createdAt_idx" ON "CandidateEmailDelivery"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateEmailDelivery_sentByAdminId_idx" ON "CandidateEmailDelivery"("sentByAdminId");

-- CreateIndex
CREATE INDEX "CandidateEmailDelivery_batchId_idx" ON "CandidateEmailDelivery"("batchId");

-- CreateIndex
CREATE INDEX "CandidateEmailDelivery_status_createdAt_idx" ON "CandidateEmailDelivery"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CandidateEmailDelivery" ADD CONSTRAINT "CandidateEmailDelivery_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEmailDelivery" ADD CONSTRAINT "CandidateEmailDelivery_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEmailDelivery" ADD CONSTRAINT "CandidateEmailDelivery_sentByAdminId_fkey" FOREIGN KEY ("sentByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEmailDelivery" ADD CONSTRAINT "CandidateEmailDelivery_retriedFromId_fkey" FOREIGN KEY ("retriedFromId") REFERENCES "CandidateEmailDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
