-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_groupId_createdAt_idx" ON "AuditLog"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
