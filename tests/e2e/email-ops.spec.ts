import { expect, test, type Page } from "@playwright/test";
import { AdminRole, AdminStatus, CandidateStatus, InterviewGroupStatus } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { generateGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";

const adminEmail = "email-ops-admin@example.com";
const adminPassword = "Email_Ops_StrongPassword_123!";
const groupNamePrefix = "E2E 邮件运营 ";

async function loginEmailOpsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("邮箱").fill(adminEmail);
  await page.getByLabel("密码").fill(adminPassword);
  await page.getByRole("button", { name: /登录/ }).click();
  await expect(page.getByRole("heading", { name: "面试组", exact: true })).toBeVisible();
}

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
  await prisma.interviewProject.deleteMany({
    where: {
      name: { startsWith: groupNamePrefix }
    }
  });
  await prisma.emailTemplate.deleteMany();

  const groupName = `${groupNamePrefix}${Date.now()}`;
  const project = await prisma.interviewProject.create({
    data: {
      name: groupName,
      publicDescription: "邮件运营自动化验收。",
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
  await prisma.interviewProject.deleteMany({
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
  await prisma.emailTemplate.deleteMany();
});

test("admin sends candidate email with preview, delivery history, and batch summary", async ({
  page
}) => {
  await loginEmailOpsAdmin(page);

  const group = await prisma.interviewGroup.findFirstOrThrow({
    where: { name: { startsWith: groupNamePrefix } },
    include: { candidates: true }
  });
  const candidate = group.candidates[0]!;

  await page.goto(`/admin/groups/${group.id}/candidates`);
  await expect(page.getByRole("heading", { name: `${group.name} · 候选人` })).toBeVisible();
  await expect(page.getByText("发送候选人通知")).toHaveCount(0);
  await expect(page.getByText("邮件测试候选人")).toBeVisible();

  await page.goto(`/admin/groups/${group.id}/candidates/${candidate.id}`);
  await expect(page.getByRole("heading", { name: "发送候选人通知" })).toBeVisible();
  await expect(page.getByText(`${group.name} 面试安排通知`).first()).toBeVisible();
  await page.getByLabel(/我已确认收件人/).check();
  await page.getByRole("button", { name: "发送通知" }).click();

  await expect(page.getByText("已发送 1 封候选人通知（测试发送预览）")).toBeVisible();
  await expect(page.getByText("本次通知发送结果")).toBeVisible();
  await expect(page.getByText("邮件测试候选人").first()).toBeVisible();
  await expect(page.getByText("测试发送预览").first()).toBeVisible();

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

  await expect(page.getByText("通知发送历史")).toBeVisible();
  await expect(page.getByText("{groupName} 面试安排通知").first()).toBeVisible();
  await expect(page.getByText("测试发送预览").first()).toBeVisible();
});

test("admin updates global candidate email template and send form uses it", async ({ page }) => {
  await loginEmailOpsAdmin(page);

  const group = await prisma.interviewGroup.findFirstOrThrow({
    where: { name: { startsWith: groupNamePrefix } },
    include: { candidates: true }
  });
  const candidate = group.candidates[0]!;

  await page.goto("/admin/email-templates");
  await expect(page.getByRole("heading", { name: "邮件模板", level: 2 })).toBeVisible();
  const templateForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "保存模板" }) })
    .filter({ has: page.locator('input[name="key"][value="interview_notice"]') });

  await templateForm.getByLabel("邮件主题").fill("{groupName} 全局自定义通知");
  await templateForm
    .getByLabel("邮件正文")
    .fill("你好 {name}，这是全局模板。候选人邮箱：{email}。");
  await templateForm.getByRole("button", { name: "保存模板" }).click();
  await expect(page.getByText("邮件模板已保存。")).toBeVisible();

  await page.goto(`/admin/groups/${group.id}/candidates/${candidate.id}`);
  await expect(page.getByText(`${group.name} 全局自定义通知`).first()).toBeVisible();
  await expect(page.getByText("你好 邮件测试候选人，这是全局模板。").first()).toBeVisible();
  await page.getByLabel(/我已确认收件人/).check();
  await page.getByRole("button", { name: "发送通知" }).click();

  await expect(page.getByText("已发送 1 封候选人通知（测试发送预览）")).toBeVisible();
  const delivery = await prisma.candidateEmailDelivery.findFirstOrThrow({
    where: {
      groupId: group.id,
      candidateId: candidate.id
    },
    orderBy: { createdAt: "desc" }
  });
  expect(delivery.subject).toBe("{groupName} 全局自定义通知");
  expect(delivery.bodyTemplate).toContain("这是全局模板");
});
