import { expect, test } from "@playwright/test";
import { AdminRole, AdminStatus, GroupTimeSlotStatus, InterviewGroupStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
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

  const group = await prisma.interviewGroup.create({
    data: {
      name: `${groupNamePrefix}${Date.now()}`,
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
});

test("candidate can switch display timezone without changing stored slots", async ({ page }) => {
  const group = await prisma.interviewGroup.findFirstOrThrow({
    where: { name: { startsWith: groupNamePrefix } },
    include: { timeSlots: true }
  });

  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(
    `/candidate/${group.groupCode}?name=${encodeURIComponent("时区候选人")}&email=timezone@example.com`
  );

  await expect(page.getByRole("button", { name: /09:00-09:30/ })).toBeVisible();

  await page.getByLabel("切换时间显示时区").selectOption("manual:Europe/Paris");

  await expect(page.getByRole("button", { name: /03:00-03:30/ })).toBeVisible();
  expect(group.timeSlots[0]?.startAt.toISOString()).toBe("2026-07-08T01:00:00.000Z");
});
