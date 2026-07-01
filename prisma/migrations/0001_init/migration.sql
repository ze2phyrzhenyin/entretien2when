-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InterviewGroupStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GroupTimeSlotStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TimeSlotLockType" AS ENUM ('APPOINTMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateSubmissionType" AS ENUM ('INITIAL', 'MODIFICATION');

-- CreateEnum
CREATE TYPE "CandidateSubmissionStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CandidateAdminNoteVisibility" AS ENUM ('ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "AdminNotificationType" AS ENUM ('MODIFICATION_REVIEW', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AdminNotificationStatus" AS ENUM ('UNREAD', 'READ', 'HANDLED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('ADMIN', 'CANDIDATE', 'SYSTEM');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "publicDescription" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "status" "InterviewGroupStatus" NOT NULL DEFAULT 'DRAFT',
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "interviewDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "minSelectSlots" INTEGER NOT NULL DEFAULT 1,
    "maxSelectSlots" INTEGER NOT NULL DEFAULT 6,
    "allowCandidateNote" BOOLEAN NOT NULL DEFAULT true,
    "modificationRequiresReview" BOOLEAN NOT NULL DEFAULT true,
    "autoLockBookedSlots" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAdmin" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "canViewCandidates" BOOLEAN NOT NULL DEFAULT true,
    "canEditGroup" BOOLEAN NOT NULL DEFAULT false,
    "canReviewModifications" BOOLEAN NOT NULL DEFAULT false,
    "canScheduleInterview" BOOLEAN NOT NULL DEFAULT false,
    "grantedByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTimeSlot" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "GroupTimeSlotStatus" NOT NULL DEFAULT 'OPEN',
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlotLock" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "activeSlotId" TEXT,
    "lockType" "TimeSlotLockType" NOT NULL,
    "appointmentId" TEXT,
    "reasonInternal" TEXT,
    "lockedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "TimeSlotLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'SUBMITTED',
    "activeSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSubmission" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "pendingReviewCandidateId" TEXT,
    "groupId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "submissionType" "CandidateSubmissionType" NOT NULL,
    "candidateNameSnapshot" TEXT NOT NULL,
    "candidateEmailSnapshot" TEXT NOT NULL,
    "candidateNote" TEXT,
    "status" "CandidateSubmissionStatus" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSubmissionSlot" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSubmissionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "candidateVisibleMessage" TEXT,
    "meetingLocation" TEXT,
    "internalNote" TEXT,
    "scheduledByAdminId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledByAdminId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentSlot" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateAdminNote" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "authorAdminId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "CandidateAdminNoteVisibility" NOT NULL DEFAULT 'ADMIN_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateAdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "recipientAdminId" TEXT,
    "groupId" TEXT NOT NULL,
    "candidateId" TEXT,
    "submissionId" TEXT,
    "type" "AdminNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "AdminNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorAdminId" TEXT,
    "actorCandidateId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_role_status_idx" ON "Admin"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewGroup_groupCode_key" ON "InterviewGroup"("groupCode");

-- CreateIndex
CREATE INDEX "InterviewGroup_createdByAdminId_idx" ON "InterviewGroup"("createdByAdminId");

-- CreateIndex
CREATE INDEX "InterviewGroup_status_idx" ON "InterviewGroup"("status");

-- CreateIndex
CREATE INDEX "GroupAdmin_adminId_idx" ON "GroupAdmin"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAdmin_groupId_adminId_key" ON "GroupAdmin"("groupId", "adminId");

-- CreateIndex
CREATE INDEX "GroupTimeSlot_groupId_status_startAt_idx" ON "GroupTimeSlot"("groupId", "status", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupTimeSlot_groupId_startAt_endAt_key" ON "GroupTimeSlot"("groupId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlotLock_activeSlotId_key" ON "TimeSlotLock"("activeSlotId");

-- CreateIndex
CREATE INDEX "TimeSlotLock_groupId_slotId_idx" ON "TimeSlotLock"("groupId", "slotId");

-- CreateIndex
CREATE INDEX "TimeSlotLock_appointmentId_idx" ON "TimeSlotLock"("appointmentId");

-- CreateIndex
CREATE INDEX "TimeSlotLock_releasedAt_idx" ON "TimeSlotLock"("releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_activeSubmissionId_key" ON "Candidate"("activeSubmissionId");

-- CreateIndex
CREATE INDEX "Candidate_groupId_status_idx" ON "Candidate"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_groupId_normalizedEmail_key" ON "Candidate"("groupId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSubmission_pendingReviewCandidateId_key" ON "CandidateSubmission"("pendingReviewCandidateId");

-- CreateIndex
CREATE INDEX "CandidateSubmission_groupId_status_idx" ON "CandidateSubmission"("groupId", "status");

-- CreateIndex
CREATE INDEX "CandidateSubmission_candidateId_status_idx" ON "CandidateSubmission"("candidateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSubmission_candidateId_versionNo_key" ON "CandidateSubmission"("candidateId", "versionNo");

-- CreateIndex
CREATE INDEX "CandidateSubmissionSlot_candidateId_idx" ON "CandidateSubmissionSlot"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateSubmissionSlot_groupId_slotId_idx" ON "CandidateSubmissionSlot"("groupId", "slotId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSubmissionSlot_submissionId_slotId_key" ON "CandidateSubmissionSlot"("submissionId", "slotId");

-- CreateIndex
CREATE INDEX "Appointment_groupId_status_startAt_idx" ON "Appointment"("groupId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_candidateId_status_idx" ON "Appointment"("candidateId", "status");

-- CreateIndex
CREATE INDEX "AppointmentSlot_slotId_idx" ON "AppointmentSlot"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSlot_appointmentId_slotId_key" ON "AppointmentSlot"("appointmentId", "slotId");

-- CreateIndex
CREATE INDEX "CandidateAdminNote_groupId_candidateId_idx" ON "CandidateAdminNote"("groupId", "candidateId");

-- CreateIndex
CREATE INDEX "CandidateAdminNote_authorAdminId_idx" ON "CandidateAdminNote"("authorAdminId");

-- CreateIndex
CREATE INDEX "AdminNotification_recipientAdminId_status_idx" ON "AdminNotification"("recipientAdminId", "status");

-- CreateIndex
CREATE INDEX "AdminNotification_groupId_type_idx" ON "AdminNotification"("groupId", "type");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_createdAt_idx" ON "AuditLog"("actorType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewGroup" ADD CONSTRAINT "InterviewGroup_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAdmin" ADD CONSTRAINT "GroupAdmin_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAdmin" ADD CONSTRAINT "GroupAdmin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAdmin" ADD CONSTRAINT "GroupAdmin_grantedByAdminId_fkey" FOREIGN KEY ("grantedByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTimeSlot" ADD CONSTRAINT "GroupTimeSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlotLock" ADD CONSTRAINT "TimeSlotLock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlotLock" ADD CONSTRAINT "TimeSlotLock_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "GroupTimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlotLock" ADD CONSTRAINT "TimeSlotLock_activeSlotId_fkey" FOREIGN KEY ("activeSlotId") REFERENCES "GroupTimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlotLock" ADD CONSTRAINT "TimeSlotLock_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlotLock" ADD CONSTRAINT "TimeSlotLock_lockedByAdminId_fkey" FOREIGN KEY ("lockedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_activeSubmissionId_fkey" FOREIGN KEY ("activeSubmissionId") REFERENCES "CandidateSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmission" ADD CONSTRAINT "CandidateSubmission_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmissionSlot" ADD CONSTRAINT "CandidateSubmissionSlot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CandidateSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmissionSlot" ADD CONSTRAINT "CandidateSubmissionSlot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSubmissionSlot" ADD CONSTRAINT "CandidateSubmissionSlot_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "GroupTimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_scheduledByAdminId_fkey" FOREIGN KEY ("scheduledByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_cancelledByAdminId_fkey" FOREIGN KEY ("cancelledByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "GroupTimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAdminNote" ADD CONSTRAINT "CandidateAdminNote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAdminNote" ADD CONSTRAINT "CandidateAdminNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAdminNote" ADD CONSTRAINT "CandidateAdminNote_authorAdminId_fkey" FOREIGN KEY ("authorAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_recipientAdminId_fkey" FOREIGN KEY ("recipientAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CandidateSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorCandidateId_fkey" FOREIGN KEY ("actorCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

