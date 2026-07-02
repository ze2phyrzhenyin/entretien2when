import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import {
  AdminRole,
  AdminStatus,
  AppointmentStatus,
  CandidateStatus,
  CandidateSubmissionStatus,
  PrismaClient
} from "@prisma/client";
import { hashPassword } from "../../src/lib/auth/password";

const prisma = new PrismaClient();

const adminEmail = "e2e-admin@example.com";
const adminPassword = "E2E_StrongPassword_123!";
const groupNamePrefix = "E2E 全流程 ";

function assertFound<T>(value: T | null | undefined, message: string): asserts value is T {
  if (!value) {
    throw new Error(message);
  }
}

function sorted(values: string[]) {
  return [...values].sort();
}

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("邮箱").fill(adminEmail);
  await page.getByLabel("密码").fill(adminPassword);
  await page.getByRole("button", { name: /登录/ }).click();
  await expect(page.getByRole("heading", { name: "面试组", exact: true })).toBeVisible();
}

async function createGroupThroughUi(page: Page, groupName: string) {
  await page.getByRole("link", { name: "创建面试组" }).click();
  await expect(page.getByRole("heading", { name: "创建面试组" })).toBeVisible();
  await page.getByLabel("组名称").fill(groupName);
  await page.getByLabel("公开说明").fill("E2E 自动化业务验收面试组。");
  await page.getByLabel("时间粒度（分钟）").fill("30");
  await page.getByLabel("面试时长（分钟）").fill("25");
  await page.getByLabel("候选人最多选择").fill("4");
  await page.getByRole("button", { name: "创建面试组" }).click();
  await expect(page.getByText("面试组已创建。")).toBeVisible();

  const group = await prisma.interviewGroup.findFirst({
    where: { name: groupName },
    select: { id: true, groupCode: true }
  });
  assertFound(group, "Expected E2E group to be created.");
  return group;
}

async function generateSlotsThroughUi(page: Page, groupId: string) {
  await page.goto(`/admin/groups/${groupId}/slots`);
  await page.getByLabel("开始日期").fill("2026-08-03");
  await page.getByLabel("结束日期").fill("2026-08-03");
  await page.getByLabel("开始时间").fill("09:00");
  await page.getByLabel("结束时间").fill("12:00");
  await page.getByRole("button", { name: "生成时间段" }).click();
  await expect(page.getByText("2026/08/03 09:00-09:30")).toBeVisible();
  await expect(page.getByText("2026/08/03 11:30-12:00")).toBeVisible();

  const slots = await prisma.groupTimeSlot.findMany({
    where: { groupId },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true }
  });
  expect(slots).toHaveLength(6);
  return slots;
}

async function enterCandidateFromJoin(
  page: Page,
  groupCode: string,
  name: string,
  email: string,
  groupName: string
) {
  await page.goto("/join");
  await page.getByLabel("姓名").fill(name);
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("面试组编号").fill(groupCode);
  await page.getByRole("button", { name: "进入时间选择" }).click();
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
}

async function expectCandidateActiveSlots(
  email: string,
  groupId: string,
  expectedSlotIds: string[]
) {
  const candidate = await prisma.candidate.findUnique({
    where: {
      groupId_normalizedEmail: {
        groupId,
        normalizedEmail: email
      }
    },
    include: {
      activeSubmission: {
        include: {
          slots: {
            select: { slotId: true }
          }
        }
      }
    }
  });
  assertFound(candidate, "Expected candidate to exist.");
  assertFound(candidate.activeSubmission, "Expected candidate to have active submission.");
  expect(candidate.activeSubmission.status).toBe(CandidateSubmissionStatus.ACTIVE);
  expect(sorted(candidate.activeSubmission.slots.map((slot) => slot.slotId))).toEqual(
    sorted(expectedSlotIds)
  );
}

test.describe("P0 business flow", () => {
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    await prisma.interviewGroup.deleteMany({
      where: { name: { startsWith: groupNamePrefix } }
    });

    await prisma.admin.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: await hashPassword(adminPassword),
        displayName: "E2E 管理员",
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE
      },
      create: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        displayName: "E2E 管理员",
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE
      }
    });
  });

  test.afterAll(async () => {
    await prisma.interviewGroup.deleteMany({
      where: { name: { startsWith: groupNamePrefix } }
    });
    await prisma.adminSession.deleteMany({
      where: {
        admin: {
          email: adminEmail
        }
      }
    });
    await prisma.$disconnect();
  });

  test("admin creates group, candidate submits/modifies, admin reviews/schedules/cancels, privacy stays isolated", async ({
    page
  }) => {
    const runId = Date.now().toString(36);
    const groupName = `${groupNamePrefix}${runId}`;
    const candidateAName = `候选人甲${runId}`;
    const candidateAEmail = `candidate-a-${runId}@example.com`;
    const candidateBName = `候选人乙${runId}`;
    const candidateBEmail = `candidate-b-${runId}@example.com`;
    const candidateNote = "E2E 首次提交备注";
    const modifiedNote = "E2E 修改后的备注";
    const meetingLocation = "E2E 会议室 / 腾讯会议 100-200-300";
    const candidateVisibleMessage = "E2E 候选人可见说明";
    const internalNote = "E2E 内部备注不能给候选人看";
    const adminPrivateNote = "E2E 管理员私有备注不能给候选人看";

    await loginAdmin(page);
    const group = await createGroupThroughUi(page, groupName);
    const slots = await generateSlotsThroughUi(page, group.id);
    const initialSlotIds = slots.slice(0, 2).map((slot) => slot.id);
    const modifiedSlotIds = slots.slice(2, 4).map((slot) => slot.id);

    await enterCandidateFromJoin(page, group.groupCode, candidateAName, candidateAEmail, groupName);
    await page.getByRole("button", { name: "09:00-09:30" }).click();
    await page.getByRole("button", { name: "09:30-10:00" }).click();
    await page.getByLabel("备注").fill(candidateNote);
    await page.getByRole("button", { name: "提交可用时间" }).click();
    await expect(page.getByText("可用时间已提交。")).toBeVisible();
    await expect(page.getByRole("heading", { name: "当前有效可用时间" })).toBeVisible();
    await expectCandidateActiveSlots(candidateAEmail, group.id, initialSlotIds);

    await page.getByRole("link", { name: "申请修改" }).click();
    await expect(page.getByRole("heading", { name: "申请修改可用时间" })).toBeVisible();
    await page.getByRole("button", { name: "09:00-09:30" }).click();
    await page.getByRole("button", { name: "09:30-10:00" }).click();
    await page.getByRole("button", { name: "10:00-10:30" }).click();
    await page.getByRole("button", { name: "10:30-11:00" }).click();
    await page.getByLabel("备注").fill(modifiedNote);
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("需要管理员审核");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "提交修改申请" }).click();
    await expect(page.getByText("你的修改申请正在等待管理员审核。").first()).toBeVisible();
    await expect(page.getByText("审核通过前，当前有效提交不会改变。").first()).toBeVisible();
    await expectCandidateActiveSlots(candidateAEmail, group.id, initialSlotIds);

    const pendingSubmission = await prisma.candidateSubmission.findFirst({
      where: {
        groupId: group.id,
        candidateEmailSnapshot: candidateAEmail,
        status: CandidateSubmissionStatus.PENDING_REVIEW
      },
      select: { id: true }
    });
    assertFound(pendingSubmission, "Expected pending modification submission.");

    await page.goto(`/admin/groups/${group.id}/reviews`);
    await expect(page.getByText("1 个待审核")).toBeVisible();
    await page.getByRole("link", { name: "审核", exact: true }).click();
    await expect(page.getByRole("heading", { name: "审核修改申请" })).toBeVisible();
    await page.getByPlaceholder("审核意见（可选）").fill("E2E 审核通过");
    await page.getByRole("button", { name: "通过修改" }).click();
    await expect(page.getByText("审核操作已完成。")).toBeVisible();
    await expectCandidateActiveSlots(candidateAEmail, group.id, modifiedSlotIds);

    await page
      .locator("label")
      .filter({ hasText: "2026/08/03 10:00-10:30" })
      .getByRole("checkbox")
      .check();
    await page
      .locator("label")
      .filter({ hasText: "2026/08/03 10:30-11:00" })
      .getByRole("checkbox")
      .check();
    await page.getByLabel("会议地点或链接").fill(meetingLocation);
    await page.getByLabel("候选人可见说明").fill(candidateVisibleMessage);
    await page.getByLabel("内部备注").fill(internalNote);
    await page.getByRole("button", { name: "安排并锁定时间" }).click();
    await expect(page.getByText(/已预约：/)).toBeVisible();
    await expect(page.getByText("2026/08/03 10:00-11:00")).toBeVisible();

    const candidate = await prisma.candidate.findUnique({
      where: {
        groupId_normalizedEmail: {
          groupId: group.id,
          normalizedEmail: candidateAEmail
        }
      },
      select: { id: true, status: true }
    });
    assertFound(candidate, "Expected scheduled candidate.");
    expect(candidate.status).toBe(CandidateStatus.SCHEDULED);

    const scheduledAppointment = await prisma.appointment.findFirst({
      where: {
        groupId: group.id,
        candidateId: candidate.id,
        status: AppointmentStatus.SCHEDULED
      },
      include: { locks: true }
    });
    assertFound(scheduledAppointment, "Expected scheduled appointment.");
    expect(scheduledAppointment.locks).toHaveLength(2);
    expect(sorted(scheduledAppointment.locks.map((lock) => lock.slotId))).toEqual(
      sorted(modifiedSlotIds)
    );

    await page.getByPlaceholder("填写内部跟进信息").fill(adminPrivateNote);
    await page.getByRole("button", { name: "保存私有备注" }).click();
    await expect(page.getByText(adminPrivateNote).first()).toBeVisible();

    await page.goto(
      `/candidate/${group.groupCode}?name=${encodeURIComponent(candidateAName)}&email=${encodeURIComponent(candidateAEmail)}`
    );
    await expect(page.getByRole("heading", { name: "面试已安排" })).toBeVisible();
    await expect(page.getByText(meetingLocation)).toBeVisible();
    await expect(page.getByText(candidateVisibleMessage)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(internalNote);
    await expect(page.locator("body")).not.toContainText(adminPrivateNote);
    await expect(page.locator("body")).not.toContainText("管理员私有备注");
    await expect(page.locator("body")).not.toContainText("已预约给");

    await enterCandidateFromJoin(page, group.groupCode, candidateBName, candidateBEmail, groupName);
    await expect(page.getByRole("button", { name: "不可选" })).toHaveCount(2);
    await expect(page.locator("body")).not.toContainText(candidateAName);
    await expect(page.locator("body")).not.toContainText("已预约给");
    await expect(page.locator("body")).not.toContainText(internalNote);
    await expect(page.locator("body")).not.toContainText(adminPrivateNote);
    await expect(page.locator("body")).not.toContainText("管理员私有备注");

    await page.goto(`/admin/groups/${group.id}/appointments`);
    await expect(page.getByRole("table").getByText("已预约")).toBeVisible();
    await page.getByRole("table").getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("table").getByText("已取消")).toBeVisible();
    await expect
      .poll(async () => {
        const appointment = await prisma.appointment.findUnique({
          where: { id: scheduledAppointment.id },
          select: { status: true }
        });
        return appointment?.status;
      })
      .toBe(AppointmentStatus.CANCELLED);

    const cancelledAppointment = await prisma.appointment.findUnique({
      where: { id: scheduledAppointment.id },
      include: { locks: true }
    });
    assertFound(cancelledAppointment, "Expected cancelled appointment.");
    expect(cancelledAppointment.status).toBe(AppointmentStatus.CANCELLED);
    expect(cancelledAppointment.locks.every((lock) => lock.activeSlotId === null)).toBe(true);
    expect(cancelledAppointment.locks.every((lock) => lock.releasedAt !== null)).toBe(true);

    await page.goto(
      `/candidate/${group.groupCode}?name=${encodeURIComponent(candidateBName)}&email=${encodeURIComponent(candidateBEmail)}`
    );
    await expect(page.getByRole("button", { name: "不可选" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "10:00-10:30" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "10:30-11:00" })).toBeEnabled();

    await page.goto(`/admin/audit?q=${encodeURIComponent(groupName)}`);
    await expect(page.getByRole("heading", { level: 2, name: "操作日志" })).toBeVisible();
    await expect(page.getByText("创建面试组").first()).toBeVisible();
    await expect(page.getByText("批量生成时间段").first()).toBeVisible();
    await expect(page.getByText("候选人首次提交").first()).toBeVisible();
    await expect(page.getByText("候选人申请修改").first()).toBeVisible();
    await expect(page.getByText("管理员通过修改申请").first()).toBeVisible();
    await expect(page.getByText("管理员安排面试").first()).toBeVisible();
    await expect(page.getByText("保存管理员私有备注").first()).toBeVisible();
    await expect(page.getByText("管理员取消预约").first()).toBeVisible();
  });
});
