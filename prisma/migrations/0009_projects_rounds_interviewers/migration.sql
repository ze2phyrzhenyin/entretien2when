-- CreateEnum
CREATE TYPE "InterviewProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InterviewRoundStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InterviewerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "InterviewGroup" ADD COLUMN "projectId" TEXT;
ALTER TABLE "InterviewGroup" ADD COLUMN "roundId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "roundId" TEXT;

-- CreateTable
CREATE TABLE "InterviewProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicDescription" TEXT,
    "status" "InterviewProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "interviewDurationMinutes" INTEGER,
    "status" "InterviewRoundStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interviewer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" "InterviewerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentInterviewer" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentInterviewer_pkey" PRIMARY KEY ("id")
);

-- Backfill: keep every existing group working by wrapping it in a project and default round.
INSERT INTO "InterviewProject" (
    "id",
    "name",
    "publicDescription",
    "status",
    "createdByAdminId",
    "createdAt",
    "updatedAt"
)
SELECT
    'proj_' || md5("id"),
    "name",
    "publicDescription",
    'ACTIVE',
    "createdByAdminId",
    "createdAt",
    "updatedAt"
FROM "InterviewGroup";

INSERT INTO "InterviewRound" (
    "id",
    "projectId",
    "name",
    "orderIndex",
    "description",
    "interviewDurationMinutes",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'round_' || md5("id"),
    'proj_' || md5("id"),
    '默认轮次',
    1,
    "publicDescription",
    "interviewDurationMinutes",
    'ACTIVE',
    "createdAt",
    "updatedAt"
FROM "InterviewGroup";

UPDATE "InterviewGroup"
SET
    "projectId" = 'proj_' || md5("id"),
    "roundId" = 'round_' || md5("id");

UPDATE "Appointment"
SET "roundId" = "InterviewGroup"."roundId"
FROM "InterviewGroup"
WHERE "Appointment"."groupId" = "InterviewGroup"."id";

-- CreateIndex
CREATE INDEX "InterviewProject_createdByAdminId_idx" ON "InterviewProject"("createdByAdminId");
CREATE INDEX "InterviewProject_status_idx" ON "InterviewProject"("status");
CREATE UNIQUE INDEX "InterviewRound_projectId_orderIndex_key" ON "InterviewRound"("projectId", "orderIndex");
CREATE INDEX "InterviewRound_projectId_status_idx" ON "InterviewRound"("projectId", "status");
CREATE UNIQUE INDEX "Interviewer_projectId_normalizedEmail_key" ON "Interviewer"("projectId", "normalizedEmail");
CREATE INDEX "Interviewer_projectId_status_idx" ON "Interviewer"("projectId", "status");
CREATE UNIQUE INDEX "AppointmentInterviewer_appointmentId_interviewerId_key" ON "AppointmentInterviewer"("appointmentId", "interviewerId");
CREATE INDEX "AppointmentInterviewer_interviewerId_idx" ON "AppointmentInterviewer"("interviewerId");
CREATE INDEX "InterviewGroup_projectId_idx" ON "InterviewGroup"("projectId");
CREATE INDEX "InterviewGroup_roundId_idx" ON "InterviewGroup"("roundId");
CREATE INDEX "Appointment_roundId_status_startAt_idx" ON "Appointment"("roundId", "status", "startAt");

-- AddForeignKey
ALTER TABLE "InterviewProject" ADD CONSTRAINT "InterviewProject_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InterviewProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Interviewer" ADD CONSTRAINT "Interviewer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InterviewProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewGroup" ADD CONSTRAINT "InterviewGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "InterviewProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewGroup" ADD CONSTRAINT "InterviewGroup_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppointmentInterviewer" ADD CONSTRAINT "AppointmentInterviewer_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentInterviewer" ADD CONSTRAINT "AppointmentInterviewer_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "Interviewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
