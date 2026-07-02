import { expect, test } from "@playwright/test";
import { AdminRole, AdminStatus, CandidateStatus, InterviewGroupStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { generateGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";

const adminEmail = "email-ops-admin@example.com";
const adminPassword = "Email_Ops_StrongPassword_123!";
const groupNamePrefix = "E2E 邮件运营 ";

test.beforeEach(async () => {
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: await hashPassword(adminPassword),
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      displayName: "邮件运营管理员"
    },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      displayName: "邮件运营管理员"
    }
  });

  await prisma.interviewGroup.deleteMany({
    where: {
      name: { startsWith: groupNamePrefix }
    }
  });

  const group = await prisma.interviewGroup.create({
    data: {
      name: `${groupNamePrefix}${Date.now()}`,
      groupCode: generateGroupCode(),
      publicDescription: "邮件运营自动化验收。",
      timezone: "Asia/Shanghai",
      status: InterviewGroupStatus.OPEN,
      createdByAdminId: admin.id
    }
  });

  await prisma.candidate.create({
    data: {
      groupId: group.id,
      name: "邮件测试候选人",
      email: "email-candidate@example.com",
      normalizedEmail: "email-candidate@example.com",
      status: CandidateStatus.SUBMITTED
    }
  });
});

test.afterEach(async () => {
  await prisma.interviewGroup.deleteMany({
    where: {
      name: { startsWith: groupNamePrefix }
    }
  });
  await prisma.adminSession.deleteMany({
    where: {
      admin: {
        email: adminEmail
      }
    }
  });
});

test("admin sends candidate email with preview, delivery history, and batch summary", async ({
  page
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("邮箱").fill(adminEmail);
  await page.getByLabel("密码").fill(adminPassword);
  await page.getByRole("button", { name: /登录/ }).click();
  await expect(page.getByRole("heading", { name: "面试组", exact: true })).toBeVisible();

  const group = await prisma.interviewGroup.findFirstOrThrow({
    where: { name: { startsWith: groupNamePrefix } },
    include: { candidates: true }
  });
  const candidate = group.candidates[0]!;

  await page.goto(`/admin/groups/${group.id}/candidates`);
  await expect(page.getByText("发送候选人邮件")).toBeVisible();
  await expect(page.getByText(`${group.name} 面试安排通知`).first()).toBeVisible();
  await page.getByLabel("选择 邮件测试候选人").check();
  await page.getByLabel(/我已确认收件人/).check();
  await page.getByRole("button", { name: "发送给选中候选人" }).click();

  await expect(page.getByText("已发送 1 封候选人邮件（dry-run 预览）")).toBeVisible();
  await expect(page.getByText("本次邮件发送结果")).toBeVisible();
  await expect(page.getByText("邮件测试候选人").first()).toBeVisible();
  await expect(page.getByText("预览").first()).toBeVisible();

  const delivery = await prisma.candidateEmailDelivery.findFirstOrThrow({
    where: {
      groupId: group.id,
      candidateId: candidate.id
    },
    orderBy: { createdAt: "desc" }
  });
  expect(delivery.status).toBe("PREVIEW");
  expect(delivery.subject).toBe("{groupName} 面试安排通知");
  expect(delivery.bodyTemplate).toContain("{name}");

  await page.goto(`/admin/groups/${group.id}/candidates/${candidate.id}`);
  await expect(page.getByText("邮件发送历史")).toBeVisible();
  await expect(page.getByText("{groupName} 面试安排通知")).toBeVisible();
  await expect(page.getByText("预览").first()).toBeVisible();
});
