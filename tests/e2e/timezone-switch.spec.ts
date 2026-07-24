import { expect, test } from "@playwright/test";
import { AdminRole, AdminStatus, GroupTimeSlotStatus, InterviewGroupStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { generateCandidateToken, hashCandidateToken } from "@/lib/auth/candidate-token";
import { generateGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";

const groupNamePrefix = "E2E 时区切换 ";
const adminEmail = "timezone-e2e-admin@example.com";

test.beforeEach(async () => {
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      displayName: "时区 E2E 管理员"
    },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword("Timezone_E2E_StrongPassword_123!"),
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      displayName: "时区 E2E 管理员"
    }
  });

  await prisma.interviewGroup.deleteMany({
    where: { name: { startsWith: groupNamePrefix } }
  });
  await prisma.interviewProject.deleteMany({
    where: { name: { startsWith: groupNamePrefix } }
  });

  const groupName = `${groupNamePrefix}${Date.now()}`;
  const project = await prisma.interviewProject.create({
    data: {
      name: groupName,
      publicDescription: "时区切换自动化验收。",
      createdByAdminId: admin.id
    }
  });
  const round = await prisma.interviewRound.create({
    data: {
      projectId: project.id,
      name: "默认轮次",
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
      publicDescription: "时区切换自动化验收。",
      timezone: "Asia/Shanghai",
      status: InterviewGroupStatus.OPEN,
      minSelectSlots: 1,
      maxSelectSlots: 2,
      createdByAdminId: admin.id
    }
  });

  await prisma.groupTimeSlot.create({
    data: {
      groupId: group.id,
      startAt: new Date("2026-07-08T01:00:00.000Z"),
      endAt: new Date("2026-07-08T01:30:00.000Z"),
      status: GroupTimeSlotStatus.OPEN
    }
  });
});

test.afterEach(async () => {
  await prisma.interviewGroup.deleteMany({
    where: { name: { startsWith: groupNamePrefix } }
  });
  await prisma.interviewProject.deleteMany({
    where: { name: { startsWith: groupNamePrefix } }
  });
});

test("candidate can switch display timezone without changing stored slots", async ({ page }) => {
  const group = await prisma.interviewGroup.findFirstOrThrow({
    where: { name: { startsWith: groupNamePrefix } },
    include: { timeSlots: true }
  });

  await page.addInitScript(() => window.localStorage.clear());
  const token = generateCandidateToken();
  await prisma.candidateAccessToken.create({
    data: {
      groupId: group.id,
      tokenHash: hashCandidateToken(token),
      name: "时区候选人",
      email: "timezone@example.com",
      normalizedEmail: "timezone@example.com",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }
  });
  await page.goto(`/candidate/auth/${token}`);

  await expect(page.getByRole("heading", { name: "确认进入候选人页面" })).toBeVisible();
  await page.getByRole("button", { name: "继续进入" }).click();
  // The availability picker deliberately defaults to a bounded current-date
  // window. This timezone regression uses a stable historical summer instant,
  // so explicitly request its one-day window instead of depending on today.
  await page.goto(`/candidate/${group.groupCode}?from=2026-07-08&to=2026-07-08`);

  await expect(page.getByRole("button", { name: /09:00-09:30/ })).toBeVisible();

  await page.getByLabel("切换时间显示时区").selectOption("manual:Europe/Paris");

  await expect(page.getByRole("button", { name: /03:00-03:30/ })).toBeVisible();
  expect(group.timeSlots[0]?.startAt.toISOString()).toBe("2026-07-08T01:00:00.000Z");
});
