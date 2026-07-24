import { createHash, randomBytes } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import {
  AdminRole,
  AdminStatus,
  AppointmentStatus,
  CandidateStatus,
  GroupTimeSlotStatus,
  InterviewGroupStatus
} from "@prisma/client";
import { generateGroupCode } from "@/lib/group-code/generate";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

const prefix = "E2E 排期完整性 ";
const adminEmail = "scheduling-integrity-e2e@example.test";
const adminPassword = "Scheduling_Integrity_E2E_123!";
const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";

test.skip(
  process.env.WHEN2ENTRETIEN_ALLOW_E2E_MUTATION !== "1",
  "This suite creates and deletes database records; use an isolated database and opt in explicitly."
);

test.afterAll(async () => {
  await prisma.interviewGroup.deleteMany({
    where: { name: { startsWith: prefix } }
  });
  await prisma.interviewProject.deleteMany({
    where: { name: { startsWith: prefix } }
  });
  await prisma.admin.deleteMany({
    where: { email: adminEmail }
  });
  await prisma.$disconnect();
});

async function createAdminSessionForBrowser(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: createHash("sha256").update(token).digest("base64url"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  return token;
}

async function authenticateAdminContext(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: "interview_admin_session",
      value: token,
      url: appBaseUrl,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

test("database rejects overlapping slots, duplicate scheduled candidates, and interviewer double booking", async () => {
  const runId = Date.now().toString(36);
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    },
    create: {
      email: adminEmail,
      passwordHash: "not-used-by-this-database-test",
      displayName: "排期完整性测试管理员",
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    }
  });
  const runName = `${prefix}${runId}`;
  const project = await prisma.interviewProject.create({
    data: {
      name: runName,
      createdByAdminId: admin.id
    }
  });
  const round = await prisma.interviewRound.create({
    data: {
      projectId: project.id,
      name: "第一轮",
      orderIndex: 1,
      interviewDurationMinutes: 30
    }
  });
  const group = await prisma.interviewGroup.create({
    data: {
      projectId: project.id,
      roundId: round.id,
      name: runName,
      groupCode: generateGroupCode(),
      status: InterviewGroupStatus.OPEN,
      createdByAdminId: admin.id
    }
  });
  const candidateOne = await prisma.candidate.create({
    data: {
      groupId: group.id,
      name: "候选人 one",
      email: `one-${runId}@example.test`,
      normalizedEmail: `one-${runId}@example.test`,
      status: CandidateStatus.SUBMITTED
    }
  });
  const candidateTwo = await prisma.candidate.create({
    data: {
      groupId: group.id,
      name: "候选人 two",
      email: `two-${runId}@example.test`,
      normalizedEmail: `two-${runId}@example.test`,
      status: CandidateStatus.SUBMITTED
    }
  });
  const interviewer = await prisma.interviewer.create({
    data: {
      projectId: project.id,
      name: "完整性面试官",
      email: `interviewer-${runId}@example.test`,
      normalizedEmail: `interviewer-${runId}@example.test`
    }
  });

  await prisma.groupTimeSlot.create({
    data: {
      groupId: group.id,
      startAt: new Date("2026-10-01T01:00:00.000Z"),
      endAt: new Date("2026-10-01T02:00:00.000Z"),
      status: GroupTimeSlotStatus.OPEN
    }
  });
  await expect(
    prisma.groupTimeSlot.create({
      data: {
        groupId: group.id,
        startAt: new Date("2026-10-01T01:30:00.000Z"),
        endAt: new Date("2026-10-01T02:30:00.000Z"),
        status: GroupTimeSlotStatus.OPEN
      }
    })
  ).rejects.toThrow();

  const appointmentOne = await prisma.appointment.create({
    data: {
      groupId: group.id,
      roundId: round.id,
      candidateId: candidateOne.id,
      startAt: new Date("2026-10-01T03:00:00.000Z"),
      endAt: new Date("2026-10-01T03:30:00.000Z"),
      status: AppointmentStatus.SCHEDULED,
      scheduledByAdminId: admin.id
    }
  });
  await expect(
    prisma.appointment.create({
      data: {
        groupId: group.id,
        roundId: round.id,
        candidateId: candidateOne.id,
        startAt: new Date("2026-10-01T04:00:00.000Z"),
        endAt: new Date("2026-10-01T04:30:00.000Z"),
        status: AppointmentStatus.SCHEDULED,
        scheduledByAdminId: admin.id
      }
    })
  ).rejects.toThrow();

  const appointmentTwo = await prisma.appointment.create({
    data: {
      groupId: group.id,
      roundId: round.id,
      candidateId: candidateTwo.id,
      startAt: new Date("2026-10-01T03:15:00.000Z"),
      endAt: new Date("2026-10-01T03:45:00.000Z"),
      status: AppointmentStatus.SCHEDULED,
      scheduledByAdminId: admin.id
    }
  });
  await prisma.appointmentInterviewer.create({
    data: {
      appointmentId: appointmentOne.id,
      interviewerId: interviewer.id
    }
  });
  await expect(
    prisma.appointmentInterviewer.create({
      data: {
        appointmentId: appointmentTwo.id,
        interviewerId: interviewer.id
      }
    })
  ).rejects.toThrow();
});

test("approve and reject racing on one submission leave a coherent candidate state", async ({
  browser
}) => {
  const runId = Date.now().toString(36);
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: await hashPassword(adminPassword),
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      displayName: "排期完整性测试管理员",
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    }
  });
  const adminSessionToken = await createAdminSessionForBrowser(admin.id);
  const groupName = `${prefix}审核竞态 ${runId}`;
  const project = await prisma.interviewProject.create({
    data: {
      name: groupName,
      createdByAdminId: admin.id
    }
  });
  const round = await prisma.interviewRound.create({
    data: {
      projectId: project.id,
      name: "第一轮",
      orderIndex: 1,
      interviewDurationMinutes: 30
    }
  });
  const group = await prisma.interviewGroup.create({
    data: {
      projectId: project.id,
      roundId: round.id,
      name: groupName,
      groupCode: generateGroupCode(),
      status: InterviewGroupStatus.OPEN,
      createdByAdminId: admin.id
    }
  });
  const [oldSlot, proposedSlot] = await Promise.all([
    prisma.groupTimeSlot.create({
      data: {
        groupId: group.id,
        startAt: new Date("2026-10-02T01:00:00.000Z"),
        endAt: new Date("2026-10-02T01:30:00.000Z"),
        status: GroupTimeSlotStatus.OPEN
      }
    }),
    prisma.groupTimeSlot.create({
      data: {
        groupId: group.id,
        startAt: new Date("2026-10-02T01:30:00.000Z"),
        endAt: new Date("2026-10-02T02:00:00.000Z"),
        status: GroupTimeSlotStatus.OPEN
      }
    })
  ]);
  const candidate = await prisma.candidate.create({
    data: {
      groupId: group.id,
      name: "审核竞态候选人",
      email: `review-race-${runId}@example.test`,
      normalizedEmail: `review-race-${runId}@example.test`,
      status: CandidateStatus.PENDING_REVIEW
    }
  });
  const activeSubmission = await prisma.candidateSubmission.create({
    data: {
      candidateId: candidate.id,
      groupId: group.id,
      versionNo: 1,
      submissionType: "INITIAL",
      candidateNameSnapshot: candidate.name,
      candidateEmailSnapshot: candidate.email,
      status: "ACTIVE",
      slots: {
        create: {
          candidateId: candidate.id,
          groupId: group.id,
          slotId: oldSlot.id
        }
      }
    }
  });
  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { activeSubmissionId: activeSubmission.id }
  });
  const pendingSubmission = await prisma.candidateSubmission.create({
    data: {
      candidateId: candidate.id,
      pendingReviewCandidateId: candidate.id,
      groupId: group.id,
      versionNo: 2,
      submissionType: "MODIFICATION",
      candidateNameSnapshot: candidate.name,
      candidateEmailSnapshot: candidate.email,
      status: "PENDING_REVIEW",
      slots: {
        create: {
          candidateId: candidate.id,
          groupId: group.id,
          slotId: proposedSlot.id
        }
      }
    }
  });

  const approveContext = await browser.newContext();
  const rejectContext = await browser.newContext();
  try {
    const [approvePage, rejectPage] = await Promise.all([
      approveContext.newPage(),
      rejectContext.newPage()
    ]);
    await Promise.all([
      authenticateAdminContext(approveContext, adminSessionToken),
      authenticateAdminContext(rejectContext, adminSessionToken)
    ]);
    await Promise.all([
      approvePage.goto(`/admin/groups/${group.id}/reviews/${pendingSubmission.id}`),
      rejectPage.goto(`/admin/groups/${group.id}/reviews/${pendingSubmission.id}`)
    ]);

    rejectPage.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("确认拒绝");
      await dialog.accept();
    });

    await Promise.allSettled([
      approvePage.getByRole("button", { name: "通过修改" }).click(),
      rejectPage.getByRole("button", { name: "拒绝修改" }).click()
    ]);

    await expect
      .poll(async () => {
        const submission = await prisma.candidateSubmission.findUnique({
          where: { id: pendingSubmission.id },
          select: { status: true }
        });
        return submission?.status;
      })
      .not.toBe("PENDING_REVIEW");

    const [resolvedSubmission, resolvedCandidate, oldSubmission] = await Promise.all([
      prisma.candidateSubmission.findUniqueOrThrow({
        where: { id: pendingSubmission.id },
        select: { status: true }
      }),
      prisma.candidate.findUniqueOrThrow({
        where: { id: candidate.id },
        select: { activeSubmissionId: true, status: true }
      }),
      prisma.candidateSubmission.findUniqueOrThrow({
        where: { id: activeSubmission.id },
        select: { status: true }
      })
    ]);

    expect(["ACTIVE", "REJECTED"]).toContain(resolvedSubmission.status);
    expect(resolvedCandidate.status).toBe(CandidateStatus.SUBMITTED);
    if (resolvedSubmission.status === "ACTIVE") {
      expect(resolvedCandidate.activeSubmissionId).toBe(pendingSubmission.id);
      expect(oldSubmission.status).toBe("SUPERSEDED");
    } else {
      expect(resolvedCandidate.activeSubmissionId).toBe(activeSubmission.id);
      expect(oldSubmission.status).toBe("ACTIVE");
    }
  } finally {
    await Promise.all([approveContext.close(), rejectContext.close()]);
  }
});
