import { expect, test } from "@playwright/test";
import { AdminRole, AdminStatus, GroupTimeSlotStatus, InterviewGroupStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { generateGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";

const adminEmail = "slot-clear-admin@example.com";
const adminPassword = "Slot_Clear_StrongPassword_123!";
const groupNamePrefix = "E2E 清空时间段 ";

test.beforeEach(async () => {
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: await hashPassword(adminPassword),
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      displayName: "清空时间段管理员"
    },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      displayName: "清空时间段管理员"
    }
  });

  await prisma.interviewGroup.deleteMany({
    where: { name: { startsWith: groupNamePrefix } }
  });

  const group = await prisma.interviewGroup.create({
    data: {
      name: `${groupNamePrefix}${Date.now()}`,
      groupCode: generateGroupCode(),
      timezone: "Asia/Shanghai",
      status: InterviewGroupStatus.OPEN,
      createdByAdminId: admin.id
    }
  });

  await prisma.groupTimeSlot.createMany({
    data: [
      {
        groupId: group.id,
        startAt: new Date("2026-07-08T01:00:00.000Z"),
        endAt: new Date("2026-07-08T01:30:00.000Z"),
        status: GroupTimeSlotStatus.OPEN
      },
      {
        groupId: group.id,
        startAt: new Date("2026-07-08T01:30:00.000Z"),
        endAt: new Date("2026-07-08T02:00:00.000Z"),
        status: GroupTimeSlotStatus.OPEN
      }
    ]
  });
});

test.afterEach(async () => {
  await prisma.interviewGroup.deleteMany({
    where: { name: { startsWith: groupNamePrefix } }
  });
  await prisma.adminSession.deleteMany({
    where: { admin: { email: adminEmail } }
  });
});

test("admin clears all deletable time slots", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("邮箱").fill(adminEmail);
  await page.getByLabel("密码").fill(adminPassword);
  await page.getByRole("button", { name: /登录/ }).click();
  await expect(page.getByRole("heading", { name: "面试组", exact: true })).toBeVisible();

  const group = await prisma.interviewGroup.findFirstOrThrow({
    where: { name: { startsWith: groupNamePrefix } }
  });

  await page.goto(`/admin/groups/${group.id}/slots`);
  await expect(
    page.getByText("将删除当前面试组里 2 个未被提交、预约或锁定引用的时间段。")
  ).toBeVisible();

  const clearForm = page.locator("form").filter({ hasText: "清空可删除时间段" });
  await clearForm.getByRole("checkbox").check();
  await clearForm.getByRole("button", { name: "清空可删除" }).click();

  await expect(page.getByText("已删除 2 个时间段。")).toBeVisible();
  await expect(page.getByText("还没有开放时间")).toBeVisible();

  await expect
    .poll(() =>
      prisma.groupTimeSlot.count({
        where: { groupId: group.id }
      })
    )
    .toBe(0);
});
