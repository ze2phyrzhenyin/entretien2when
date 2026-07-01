import {
  AdminRole,
  AdminStatus,
  AppointmentStatus,
  CandidateStatus,
  CandidateSubmissionStatus,
  CandidateSubmissionType,
  GroupTimeSlotStatus,
  InterviewGroupStatus,
  PrismaClient,
  TimeSlotLockType
} from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { generateGroupCode } from "../src/lib/group-code/generate";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "ChangeMe_StrongPassword_123!";
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      displayName: "超级管理员"
    },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      displayName: "超级管理员",
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    }
  });

  await prisma.interviewGroup.deleteMany({
    where: { name: "P0 演示面试组" }
  });

  const group = await prisma.interviewGroup.create({
    data: {
      name: "P0 演示面试组",
      groupCode: generateGroupCode(),
      publicDescription: null,
      timezone: "Asia/Shanghai",
      status: InterviewGroupStatus.OPEN,
      slotDurationMinutes: 30,
      interviewDurationMinutes: 60,
      minSelectSlots: 1,
      maxSelectSlots: 4,
      createdByAdminId: admin.id
    }
  });

  const baseSlots: Array<readonly [string, string]> = [
    ["2026-07-08T01:00:00.000Z", "2026-07-08T01:30:00.000Z"],
    ["2026-07-08T01:30:00.000Z", "2026-07-08T02:00:00.000Z"],
    ["2026-07-08T06:00:00.000Z", "2026-07-08T06:30:00.000Z"],
    ["2026-07-09T02:00:00.000Z", "2026-07-09T02:30:00.000Z"],
    ["2026-07-09T02:30:00.000Z", "2026-07-09T03:00:00.000Z"]
  ];
  const slots = await Promise.all(
    baseSlots.map(([startAt, endAt]) =>
      prisma.groupTimeSlot.create({
        data: {
          groupId: group.id,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          status: GroupTimeSlotStatus.OPEN
        }
      })
    )
  );

  const zhang = await prisma.candidate.create({
    data: {
      groupId: group.id,
      name: "张三",
      email: "zhangsan@example.com",
      normalizedEmail: "zhangsan@example.com",
      status: CandidateStatus.SCHEDULED
    }
  });
  const zhangSubmission = await prisma.candidateSubmission.create({
    data: {
      candidateId: zhang.id,
      groupId: group.id,
      versionNo: 1,
      submissionType: CandidateSubmissionType.INITIAL,
      candidateNameSnapshot: zhang.name,
      candidateEmailSnapshot: zhang.email,
      candidateNote: "周三上午更方便。",
      status: CandidateSubmissionStatus.ACTIVE,
      slots: {
        create: slots.slice(0, 2).map((slot) => ({
          candidateId: zhang.id,
          groupId: group.id,
          slotId: slot.id
        }))
      }
    }
  });
  await prisma.candidate.update({
    where: { id: zhang.id },
    data: { activeSubmissionId: zhangSubmission.id }
  });

  const appointment = await prisma.appointment.create({
    data: {
      groupId: group.id,
      candidateId: zhang.id,
      startAt: slots[0]!.startAt,
      endAt: slots[1]!.endAt,
      status: AppointmentStatus.SCHEDULED,
      candidateVisibleMessage: "请提前 5 分钟进入会议。",
      meetingLocation: "腾讯会议 123-456-789",
      internalNote: "一面，重点关注项目经历。",
      scheduledByAdminId: admin.id,
      slots: {
        create: slots.slice(0, 2).map((slot) => ({ slotId: slot.id }))
      }
    }
  });
  await prisma.timeSlotLock.createMany({
    data: slots.slice(0, 2).map((slot) => ({
      groupId: group.id,
      slotId: slot.id,
      activeSlotId: slot.id,
      lockType: TimeSlotLockType.APPOINTMENT,
      appointmentId: appointment.id,
      reasonInternal: `已预约给 ${zhang.name}`,
      lockedByAdminId: admin.id
    }))
  });
  await prisma.candidateAdminNote.create({
    data: {
      groupId: group.id,
      candidateId: zhang.id,
      authorAdminId: admin.id,
      body: "仅管理员可见：候选人希望远程面试。"
    }
  });

  const li = await prisma.candidate.create({
    data: {
      groupId: group.id,
      name: "李四",
      email: "lisi@example.com",
      normalizedEmail: "lisi@example.com",
      status: CandidateStatus.PENDING_REVIEW
    }
  });
  const liActiveSubmission = await prisma.candidateSubmission.create({
    data: {
      candidateId: li.id,
      groupId: group.id,
      versionNo: 1,
      submissionType: CandidateSubmissionType.INITIAL,
      candidateNameSnapshot: li.name,
      candidateEmailSnapshot: li.email,
      candidateNote: "下午可灵活安排。",
      status: CandidateSubmissionStatus.ACTIVE,
      slots: {
        create: slots.slice(2, 4).map((slot) => ({
          candidateId: li.id,
          groupId: group.id,
          slotId: slot.id
        }))
      }
    }
  });
  await prisma.candidate.update({
    where: { id: li.id },
    data: { activeSubmissionId: liActiveSubmission.id }
  });
  const pendingSubmission = await prisma.candidateSubmission.create({
    data: {
      candidateId: li.id,
      pendingReviewCandidateId: li.id,
      groupId: group.id,
      versionNo: 2,
      submissionType: CandidateSubmissionType.MODIFICATION,
      candidateNameSnapshot: li.name,
      candidateEmailSnapshot: li.email,
      candidateNote: "希望改到周四上午。",
      status: CandidateSubmissionStatus.PENDING_REVIEW,
      slots: {
        create: slots.slice(3, 5).map((slot) => ({
          candidateId: li.id,
          groupId: group.id,
          slotId: slot.id
        }))
      }
    }
  });
  await prisma.adminNotification.create({
    data: {
      groupId: group.id,
      candidateId: li.id,
      submissionId: pendingSubmission.id,
      type: "MODIFICATION_REVIEW",
      title: "新的候选人修改申请",
      content: "李四提交了可用时间修改申请。"
    }
  });

  console.log(
    JSON.stringify(
      {
        adminEmail,
        adminPassword,
        groupId: group.id,
        groupCode: group.groupCode,
        candidateId: zhang.id,
        pendingCandidateId: li.id,
        submissionId: pendingSubmission.id
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
