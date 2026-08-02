import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  AdminRole,
  AdminStatus,
  AppointmentStatus,
  AuditActorType,
  CandidateEmailDeliveryStatus,
  CandidateStatus,
  InterviewGroupStatus
} from "@prisma/client";
import { generateGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";

const prefix = "E2E 候选人数据生命周期 ";
const adminEmail = "candidate-lifecycle-e2e@example.test";

test.afterAll(async () => {
  await prisma.interviewGroup.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.admin.deleteMany({ where: { email: adminEmail } });
  await prisma.$disconnect();
});

test("authorized export works and anonymization removes denormalized PII while preserving schedule facts", async ({
  browser
}) => {
  test.setTimeout(60_000);
  const runId = Date.now().toString(36);
  const admin = await prisma.admin.create({
    data: {
      email: adminEmail,
      passwordHash: "not-used-by-cookie-test",
      displayName: "候选人隐私管理员",
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    }
  });
  const group = await prisma.interviewGroup.create({
    data: {
      name: `${prefix}${runId}`,
      groupCode: generateGroupCode(),
      status: InterviewGroupStatus.OPEN,
      createdByAdminId: admin.id
    }
  });
  const candidateEmail = `privacy-${runId}@example.test`;
  const candidate = await prisma.candidate.create({
    data: {
      groupId: group.id,
      name: "待匿名候选人",
      email: candidateEmail,
      normalizedEmail: candidateEmail,
      status: CandidateStatus.SCHEDULED
    }
  });
  const submission = await prisma.candidateSubmission.create({
    data: {
      candidateId: candidate.id,
      groupId: group.id,
      versionNo: 1,
      submissionType: "INITIAL",
      candidateNameSnapshot: candidate.name,
      candidateEmailSnapshot: candidate.email,
      candidateNote: "含个人偏好的备注",
      status: "ACTIVE"
    }
  });
  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { activeSubmissionId: submission.id }
  });
  const appointment = await prisma.appointment.create({
    data: {
      groupId: group.id,
      candidateId: candidate.id,
      startAt: new Date("2026-09-01T08:00:00.000Z"),
      endAt: new Date("2026-09-01T08:30:00.000Z"),
      status: AppointmentStatus.SCHEDULED,
      meetingLocation: "私人会议链接",
      candidateVisibleMessage: "候选人专属说明",
      internalNote: "敏感内部备注",
      scheduledByAdminId: admin.id
    }
  });
  await Promise.all([
    prisma.candidateAccessToken.create({
      data: {
        groupId: group.id,
        tokenHash: createHash("sha256").update(`access-${runId}`).digest("base64url"),
        name: candidate.name,
        email: candidate.email,
        normalizedEmail: candidate.normalizedEmail,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    }),
    prisma.candidateSession.create({
      data: {
        groupId: group.id,
        candidateId: candidate.id,
        tokenHash: createHash("sha256").update(`session-${runId}`).digest("base64url"),
        name: candidate.name,
        email: candidate.email,
        normalizedEmail: candidate.normalizedEmail,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    }),
    prisma.candidateAdminNote.create({
      data: {
        groupId: group.id,
        candidateId: candidate.id,
        authorAdminId: admin.id,
        body: "包含个人信息的管理员备注"
      }
    }),
    prisma.candidateEmailDelivery.create({
      data: {
        groupId: group.id,
        candidateId: candidate.id,
        sentByAdminId: admin.id,
        batchId: `batch-${runId}`,
        subject: "包含姓名的主题",
        bodyTemplate: "包含邮箱的正文",
        renderedSubject: "待匿名候选人通知",
        renderedBody: candidateEmail,
        candidateNameSnapshot: candidate.name,
        recipientEmailSnapshot: candidate.email,
        status: CandidateEmailDeliveryStatus.PENDING
      }
    }),
    prisma.emailOutbox.create({
      data: {
        type: "candidate-test",
        payload: {
          candidateId: candidate.id,
          recipientEmail: candidate.email,
          body: "候选人个人数据"
        }
      }
    })
  ]);

  const token = randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      tokenHash: createHash("sha256").update(token).digest("base64url"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  const context = await browser.newContext();
  try {
    await context.addCookies([
      {
        name: "interview_admin_session",
        value: token,
        url: "http://localhost:3101",
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);
    const exported = await context.request.get(
      `/admin/groups/${group.id}/candidates/${candidate.id}/export`
    );
    expect(exported.status()).toBe(200);
    await expect(exported.json()).resolves.toMatchObject({
      groupId: group.id,
      candidate: { id: candidate.id, email: candidateEmail }
    });

    const page = await context.newPage();
    await page.goto(`/admin/groups/${group.id}/candidates/${candidate.id}?section=overview`);
    await page.getByLabel("输入 ANONYMIZE 确认").fill("ANONYMIZE");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "永久匿名化候选人" }).click();
    await expect(page.getByText(/候选人身份、自由文本、会话和邮件内容已匿名化/)).toBeVisible();
  } finally {
    await context.close();
  }

  const [anonymized, sanitizedAppointment, counts, auditCount] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } }),
    prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } }),
    Promise.all([
      prisma.candidateAccessToken.count({ where: { groupId: group.id } }),
      prisma.candidateSession.count({ where: { candidateId: candidate.id } }),
      prisma.candidateAdminNote.count({ where: { candidateId: candidate.id } }),
      prisma.candidateEmailDelivery.count({ where: { candidateId: candidate.id } }),
      prisma.emailOutbox.count({
        where: { payload: { path: ["candidateId"], equals: candidate.id } }
      })
    ]),
    prisma.auditLog.count({
      where: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId: group.id,
        action: "admin.anonymize_candidate",
        entityId: candidate.id
      }
    })
  ]);
  expect(anonymized).toMatchObject({
    name: "—",
    email: expect.stringMatching(/^erased\+[a-f0-9]{20}@invalid\.local$/)
  });
  expect(sanitizedAppointment).toMatchObject({
    startAt: new Date("2026-09-01T08:00:00.000Z"),
    meetingLocation: null,
    candidateVisibleMessage: null,
    internalNote: null
  });
  expect(counts).toEqual([0, 0, 0, 0, 0]);
  await expect(
    prisma.candidateSubmission.findUniqueOrThrow({ where: { id: submission.id } })
  ).resolves.toMatchObject({
    candidateNameSnapshot: "—",
    candidateNote: null,
    reviewComment: null
  });
  expect(auditCount).toBe(1);
});
