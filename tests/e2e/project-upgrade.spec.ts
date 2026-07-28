import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { AdminRole, AdminStatus, AppointmentStatus, CandidateStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

const prefix = "E2E 产品升级 ";
const adminEmail = "project-upgrade-e2e@example.test";

async function createAdminSession(adminId: string) {
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

test.afterAll(async () => {
  await prisma.interviewGroup.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.interviewProject.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.admin.deleteMany({ where: { email: adminEmail } });
  await prisma.$disconnect();
});

test("project reuse, round editing, and interviewer schedule filtering work together", async ({
  page
}) => {
  test.setTimeout(60_000);
  const runId = Date.now().toString(36);
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { role: AdminRole.SUPER_ADMIN, status: AdminStatus.ACTIVE },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword("Project_Upgrade_E2E_123!"),
      displayName: "项目升级验收管理员",
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE
    }
  });
  const project = await prisma.interviewProject.create({
    data: {
      name: `${prefix}项目 ${runId}`,
      publicDescription: "验证项目复用、轮次维护与面试官筛选。",
      createdByAdminId: admin.id,
      rounds: {
        create: {
          name: "初始轮次",
          orderIndex: 1,
          interviewDurationMinutes: 30
        }
      }
    },
    include: { rounds: true }
  });
  const originalRound = project.rounds[0];
  if (!originalRound) {
    throw new Error("Expected the product-upgrade fixture to include its initial round.");
  }
  const groupName = `${prefix}面试组 ${runId}`;

  await page.context().addCookies([
    {
      name: "interview_admin_session",
      value: await createAdminSession(admin.id),
      url: "http://localhost:3101",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);

  await page.goto("/admin/groups/new");
  await page.getByLabel("招聘项目").selectOption(project.id);
  await page.getByLabel("轮次").selectOption(originalRound.id);
  await page.getByLabel("面试组名称").fill(groupName);
  await page.getByLabel("候选人可见说明").fill("复用已有招聘项目和轮次。");
  await page.getByRole("button", { name: "创建面试组" }).click();
  await expect(page.getByText("面试组已创建。")).toBeVisible();

  const group = await prisma.interviewGroup.findFirstOrThrow({
    where: { name: groupName },
    select: { id: true, projectId: true, roundId: true }
  });
  expect(group.projectId).toBe(project.id);
  expect(group.roundId).toBe(originalRound.id);

  await page.goto(`/admin/projects/${project.id}`);
  const originalRoundCard = page
    .getByText("1. 初始轮次", { exact: true })
    .locator("xpath=ancestor::div[.//summary[normalize-space()='编辑轮次']][1]");
  await originalRoundCard.getByText("编辑轮次", { exact: true }).click();
  await originalRoundCard.locator('input[name="name"]').fill("技术面");
  await originalRoundCard.locator('input[name="interviewDurationMinutes"]').fill("45");
  await originalRoundCard.locator('select[name="status"]').selectOption("CLOSED");
  await originalRoundCard.getByRole("button", { name: "保存轮次" }).click();
  await expect(page.getByText("轮次已保存并写入审计日志。")).toBeVisible();
  await expect(page.getByText("1. 技术面", { exact: true })).toBeVisible();

  const newRoundForm = page.locator("details").filter({ hasText: "新增轮次" });
  await newRoundForm.locator("summary").click();
  await newRoundForm.locator('input[name="name"]').fill("终面");
  await newRoundForm.locator('input[name="orderIndex"]').fill("2");
  await newRoundForm.locator('input[name="interviewDurationMinutes"]').fill("60");
  await newRoundForm.getByRole("button", { name: "新增轮次" }).click();
  await expect(page.getByText("轮次已保存并写入审计日志。")).toBeVisible();
  await expect(page.getByText("2. 终面", { exact: true })).toBeVisible();

  const [interviewerA, interviewerB] = await Promise.all([
    prisma.interviewer.create({
      data: {
        projectId: project.id,
        name: `面试官甲 ${runId}`,
        email: `interviewer-a-${runId}@example.test`,
        normalizedEmail: `interviewer-a-${runId}@example.test`
      }
    }),
    prisma.interviewer.create({
      data: {
        projectId: project.id,
        name: `面试官乙 ${runId}`,
        email: `interviewer-b-${runId}@example.test`,
        normalizedEmail: `interviewer-b-${runId}@example.test`
      }
    })
  ]);
  const [candidateA, candidateB] = await Promise.all([
    prisma.candidate.create({
      data: {
        groupId: group.id,
        name: `候选人甲 ${runId}`,
        email: `candidate-a-${runId}@example.test`,
        normalizedEmail: `candidate-a-${runId}@example.test`,
        status: CandidateStatus.SCHEDULED
      }
    }),
    prisma.candidate.create({
      data: {
        groupId: group.id,
        name: `候选人乙 ${runId}`,
        email: `candidate-b-${runId}@example.test`,
        normalizedEmail: `candidate-b-${runId}@example.test`,
        status: CandidateStatus.SCHEDULED
      }
    })
  ]);
  await Promise.all([
    prisma.appointment.create({
      data: {
        groupId: group.id,
        roundId: originalRound.id,
        candidateId: candidateA.id,
        startAt: new Date("2026-08-05T09:00:00.000Z"),
        endAt: new Date("2026-08-05T09:45:00.000Z"),
        status: AppointmentStatus.SCHEDULED,
        scheduledByAdminId: admin.id,
        interviewers: { create: { interviewerId: interviewerA.id } }
      }
    }),
    prisma.appointment.create({
      data: {
        groupId: group.id,
        roundId: originalRound.id,
        candidateId: candidateB.id,
        startAt: new Date("2026-08-05T10:00:00.000Z"),
        endAt: new Date("2026-08-05T10:45:00.000Z"),
        status: AppointmentStatus.SCHEDULED,
        scheduledByAdminId: admin.id,
        interviewers: { create: { interviewerId: interviewerB.id } }
      }
    })
  ]);

  await page.goto(`/admin/projects/${project.id}/schedule?from=2026-08-01&to=2026-08-10`);
  const scheduleTable = page.getByRole("table");
  await expect(scheduleTable.getByText(candidateA.name)).toBeVisible();
  await expect(scheduleTable.getByText(candidateB.name)).toBeVisible();
  await page.getByLabel("面试官").selectOption(interviewerA.id);
  await page.getByRole("button", { name: "筛选" }).click();
  await expect(page).toHaveURL(new RegExp(`interviewerId=${interviewerA.id}`));
  await expect(scheduleTable.getByText(candidateA.name)).toBeVisible();
  await expect(scheduleTable.getByText(candidateB.name)).toHaveCount(0);
  await expect(scheduleTable.getByText(interviewerA.name)).toBeVisible();

  await expect(
    prisma.auditLog.count({
      where: {
        actorAdminId: admin.id,
        action: {
          in: ["admin.create_group", "admin.update_interview_round", "admin.create_interview_round"]
        }
      }
    })
  ).resolves.toBe(3);
});
