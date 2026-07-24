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
import { hashCandidateToken } from "../../src/lib/auth/candidate-token";

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
  await page.getByLabel("面试组名称").fill(groupName);
  await page.getByLabel("候选人可见说明").fill("E2E 自动化业务验收面试组。");
  await page.getByLabel("时间粒度（分钟）").fill("30");
  await page.getByLabel("面试时长（分钟）").fill("25");
  await page.getByLabel("最多选择数量").fill("4");
  await page.getByRole("button", { name: "创建面试组" }).click();
  await expect(page.getByText("面试组已创建。")).toBeVisible();

  const group = await prisma.interviewGroup.findFirst({
    where: { name: groupName },
    select: { id: true, groupCode: true, projectId: true, roundId: true }
  });
  assertFound(group, "Expected E2E group to be created.");
  const projectId = group.projectId;
  const roundId = group.roundId;
  assertFound(projectId, "Expected E2E group to be linked to a project.");
  assertFound(roundId, "Expected E2E group to be linked to a round.");
  return { ...group, projectId, roundId };
}

async function generateSlotsThroughUi(page: Page, groupId: string) {
  await page.goto(`/admin/groups/${groupId}/slots`);
  await page.getByLabel("开始日期").fill("2026-08-03");
  await page.getByLabel("结束日期").fill("2026-08-03");
  await page.getByLabel("开始时间").fill("09:00");
  await page.getByLabel("结束时间").fill("12:00");
  await page.getByRole("button", { name: "生成开放时间" }).click();
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
  await page.getByRole("button", { name: "发送访问链接" }).click();
  await expect(page.getByText("访问链接已发送到邮箱")).toBeVisible();
  await page.getByRole("link", { name: "打开测试访问链接" }).click();
  await expect(page.getByRole("heading", { name: "确认进入候选人页面" })).toBeVisible();
  await page.getByRole("button", { name: "继续进入" }).click();
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
  await expect(page.getByTestId("availability-ready")).toBeAttached();
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
    await prisma.emailTemplate.deleteMany();
    await prisma.interviewGroup.deleteMany({
      where: { name: { startsWith: groupNamePrefix } }
    });
    await prisma.interviewProject.deleteMany({
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
    await prisma.interviewProject.deleteMany({
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
    const rescheduledMeetingLocation = `${meetingLocation} · 改约`;
    const candidateVisibleMessage = "E2E 给候选人的说明";
    const internalNote = "E2E 内部备注不能给候选人看";
    const adminPrivateNote = "E2E 管理员跟进备注不能给候选人看";
    const interviewerName = `面试官${runId}`;
    const interviewerEmail = `interviewer-${runId}@example.com`;
    await loginAdmin(page);
    const group = await createGroupThroughUi(page, groupName);
    await page.goto("/admin/projects");
    await expect(page.getByRole("heading", { level: 2, name: "招聘项目" })).toBeVisible();
    const projectRow = page.getByRole("row").filter({ hasText: groupName });
    await expect(projectRow).toBeVisible();
    await projectRow.getByRole("link", { name: "查看" }).click();
    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
    await page.getByLabel("姓名").fill(interviewerName);
    await page.getByLabel("邮箱").fill(interviewerEmail);
    await page.getByRole("button", { name: "保存面试官" }).click();
    await expect(page.getByText("面试官已保存。")).toBeVisible();
    await expect(page.getByText(interviewerEmail)).toBeVisible();
    await expect
      .poll(() =>
        prisma.interviewer.count({
          where: {
            projectId: group.projectId,
            normalizedEmail: interviewerEmail
          }
        })
      )
      .toBe(1);
    const slots = await generateSlotsThroughUi(page, group.id);
    const initialSlotIds = slots.slice(0, 2).map((slot) => slot.id);
    const scheduledSlotIds = slots.slice(2, 4).map((slot) => slot.id);
    const modifiedSlotIds = slots.slice(2, 6).map((slot) => slot.id);
    const rescheduledSlotIds = slots.slice(4, 6).map((slot) => slot.id);

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
    await page.getByRole("button", { name: "11:00-11:30" }).click();
    await page.getByRole("button", { name: "11:30-12:00" }).click();
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
    await page.goto(`/admin/groups/${group.id}/reviews/${pendingSubmission.id}`);
    await expect(page.getByRole("heading", { name: "审核修改申请" })).toBeVisible();
    await page.getByPlaceholder("审核意见（可选）").fill("E2E 审核通过");
    await page.getByRole("button", { name: "通过修改" }).click();
    await expect(page.getByText("审核操作已完成。")).toBeVisible();
    await expectCandidateActiveSlots(candidateAEmail, group.id, modifiedSlotIds);

    await page.goto(`/admin/groups/${group.id}/appointments`);
    await expect(page.getByText("候选人已选时间")).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(candidateAName) })).toBeVisible();
    await expect(page.getByText("10:00-10:30")).toBeVisible();
    await expect(page.getByText("10:30-11:00")).toBeVisible();
    await page.getByRole("link", { name: new RegExp(candidateAName) }).click();

    await page.getByRole("button", { name: "确认安排并锁定时间" }).click();
    await expect(
      page.getByText("请选择候选人当前有效可用时间中的连续开放时间后再确认安排。")
    ).toBeVisible();

    const interviewer = await prisma.interviewer.findFirstOrThrow({
      where: {
        projectId: group.projectId,
        normalizedEmail: interviewerEmail
      },
      select: { id: true }
    });
    const admin = await prisma.admin.findUniqueOrThrow({
      where: { email: adminEmail },
      select: { id: true }
    });
    const conflictCandidate = await prisma.candidate.create({
      data: {
        groupId: group.id,
        name: `冲突候选人${runId}`,
        email: `conflict-${runId}@example.com`,
        normalizedEmail: `conflict-${runId}@example.com`,
        status: CandidateStatus.SCHEDULED
      }
    });
    const conflictAppointment = await prisma.appointment.create({
      data: {
        groupId: group.id,
        roundId: group.roundId,
        candidateId: conflictCandidate.id,
        startAt: slots[2]!.startAt,
        endAt: new Date(slots[2]!.startAt.getTime() + 25 * 60 * 1000),
        status: AppointmentStatus.SCHEDULED,
        scheduledByAdminId: admin.id,
        interviewers: {
          create: {
            interviewerId: interviewer.id
          }
        }
      }
    });

    const scheduleForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "确认安排并锁定时间" })
    });
    async function fillScheduleForm() {
      await scheduleForm.getByLabel("选择 2026/08/03 10:00-10:30").check();
      await scheduleForm.getByLabel("选择 2026/08/03 10:30-11:00").check();
      await scheduleForm.getByLabel(`选择面试官 ${interviewerName} ${interviewerEmail}`).check();
      await scheduleForm.getByLabel("会议地点或链接").fill(meetingLocation);
      await scheduleForm.getByLabel("给候选人的说明").fill(candidateVisibleMessage);
      await scheduleForm.getByLabel("内部备注（仅管理员可见）").fill(internalNote);
    }

    await fillScheduleForm();
    await expect(scheduleForm.getByLabel("确认安排后发送标准面试安排通知")).toBeChecked();
    await expect(scheduleForm.getByLabel("邮件主题")).toHaveCount(0);
    await expect(scheduleForm.getByLabel("抄送（CC，可选）")).toHaveCount(0);
    await expect(scheduleForm.getByLabel("邮件正文")).toHaveCount(0);
    await scheduleForm.getByRole("button", { name: "确认安排并锁定时间" }).click();
    await expect(
      page.getByText("所选面试官在该时间已有面试安排，请调整时间或更换面试官。")
    ).toBeVisible();

    await prisma.appointment.delete({
      where: { id: conflictAppointment.id }
    });
    await fillScheduleForm();
    await scheduleForm.getByRole("button", { name: "确认安排并锁定时间" }).click();
    await expect(page.getByText(/已安排：/)).toBeVisible();
    await expect(page.getByText(`面试官：${interviewerName}`)).toBeVisible();
    await expect(page.getByText("已发送 1 封候选人通知（测试发送预览）")).toBeVisible();
    await expect(page.getByText("2026/08/03 10:00-10:25", { exact: true })).toBeVisible();
    await expect(
      page.getByText("面试时间：2026/08/03 10:00-10:25（北京时间）", { exact: true })
    ).toBeVisible();

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
      include: { locks: true, interviewers: true }
    });
    assertFound(scheduledAppointment, "Expected scheduled appointment.");
    expect(scheduledAppointment.roundId).toBe(group.roundId);
    expect(scheduledAppointment.interviewers.map((assignment) => assignment.interviewerId)).toEqual(
      [interviewer.id]
    );
    expect(scheduledAppointment.locks).toHaveLength(2);
    expect(sorted(scheduledAppointment.locks.map((lock) => lock.slotId))).toEqual(
      sorted(scheduledSlotIds)
    );

    const appointmentEmailDelivery = await prisma.candidateEmailDelivery.findFirst({
      where: {
        groupId: group.id,
        candidateId: candidate.id,
        templateKey: "appointment_confirmed"
      },
      orderBy: { createdAt: "desc" }
    });
    assertFound(appointmentEmailDelivery, "Expected appointment email delivery.");
    expect(appointmentEmailDelivery.status).toBe("PREVIEW");
    expect(appointmentEmailDelivery.bodyTemplate).toContain("{appointmentTime}");
    expect(appointmentEmailDelivery.ccEmailSnapshots).toEqual([]);

    await expect(page.getByText("展开调整")).toBeVisible();
    await expect(page.getByRole("button", { name: "保存调整并锁定时间" })).toHaveCount(0);
    await page.getByText("调整面试时间").click();
    await expect(page.getByText("收起")).toBeVisible();

    const rescheduleForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "保存调整并锁定时间" })
    });
    await rescheduleForm.getByLabel("选择 2026/08/03 10:00-10:30").uncheck();
    await rescheduleForm.getByLabel("选择 2026/08/03 10:30-11:00").uncheck();
    await rescheduleForm.getByLabel("选择 2026/08/03 11:00-11:30").check();
    await rescheduleForm.getByLabel("选择 2026/08/03 11:30-12:00").check();
    await rescheduleForm.getByLabel("保存后发送标准面试安排通知").uncheck();
    await rescheduleForm.getByLabel("会议地点或链接").fill(rescheduledMeetingLocation);
    await rescheduleForm.getByRole("button", { name: "保存调整并锁定时间" }).click();
    await expect(page.getByText("2026/08/03 11:00-11:25", { exact: true })).toBeVisible();

    const rescheduledAppointment = await prisma.appointment.findUnique({
      where: { id: scheduledAppointment.id },
      include: { locks: true, slots: true, interviewers: true }
    });
    assertFound(rescheduledAppointment, "Expected rescheduled appointment.");
    expect(rescheduledAppointment.roundId).toBe(group.roundId);
    expect(
      rescheduledAppointment.interviewers.map((assignment) => assignment.interviewerId)
    ).toEqual([interviewer.id]);
    expect(sorted(rescheduledAppointment.slots.map((slot) => slot.slotId))).toEqual(
      sorted(rescheduledSlotIds)
    );
    const activeLocks = rescheduledAppointment.locks.filter((lock) => lock.releasedAt === null);
    expect(activeLocks).toHaveLength(2);
    expect(sorted(activeLocks.map((lock) => lock.slotId))).toEqual(sorted(rescheduledSlotIds));
    expect(
      rescheduledAppointment.locks
        .filter((lock) => scheduledSlotIds.includes(lock.slotId))
        .every((lock) => lock.activeSlotId === null && lock.releasedAt !== null)
    ).toBe(true);

    await page.getByPlaceholder("填写内部跟进备注").fill(adminPrivateNote);
    await page.getByRole("button", { name: "保存跟进备注" }).click();
    await expect(page.getByText(adminPrivateNote).first()).toBeVisible();

    await expect
      .poll(async () =>
        prisma.candidateSession.count({
          where: { groupId: group.id, normalizedEmail: candidateAEmail }
        })
      )
      .toBe(1);
    const candidateSessionCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === "interview_candidate_session"
    );
    expect(candidateSessionCookie).toMatchObject({ path: "/", secure: false });
    expect(candidateSessionCookie).toBeDefined();
    await expect
      .poll(() =>
        prisma.candidateSession.findUnique({
          where: { tokenHash: hashCandidateToken(candidateSessionCookie!.value) },
          select: { groupId: true }
        })
      )
      .toMatchObject({ groupId: group.id });
    await page.goto(`/candidate/${group.groupCode}`);
    await expect(page.getByRole("heading", { name: "面试已安排" })).toBeVisible();
    await expect(page.getByText(rescheduledMeetingLocation)).toBeVisible();
    await expect(page.getByText(candidateVisibleMessage)).toBeVisible();
    await expect(page.getByRole("link", { name: "申请修改" })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(internalNote);
    await expect(page.locator("body")).not.toContainText(adminPrivateNote);
    await expect(page.locator("body")).not.toContainText("管理员跟进备注");
    await expect(page.locator("body")).not.toContainText("已安排给");

    await enterCandidateFromJoin(page, group.groupCode, candidateBName, candidateBEmail, groupName);
    await expect(page.getByRole("button", { name: "不可选" })).toHaveCount(2);
    await expect(page.locator("body")).not.toContainText(candidateAName);
    await expect(page.locator("body")).not.toContainText("已安排给");
    await expect(page.locator("body")).not.toContainText(internalNote);
    await expect(page.locator("body")).not.toContainText(adminPrivateNote);
    await expect(page.locator("body")).not.toContainText("管理员跟进备注");

    await page.goto(`/admin/groups/${group.id}/appointments`);
    await expect(page.getByRole("table").getByText("已安排")).toBeVisible();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("确认取消");
      await dialog.accept();
    });
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

    await page.goto(`/candidate/${group.groupCode}`);
    await expect(page.getByRole("button", { name: "不可选" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "11:00-11:30" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "11:30-12:00" })).toBeEnabled();

    await page.goto(`/admin/audit?q=${encodeURIComponent(groupName)}`);
    await expect(page.getByRole("heading", { level: 2, name: "审计日志" })).toBeVisible();
    await expect(page.getByText("创建面试组").first()).toBeVisible();
    await expect(page.getByText("批量生成开放时间").first()).toBeVisible();
    await expect(page.getByText("候选人首次提交").first()).toBeVisible();
    await expect(page.getByText("候选人申请修改").first()).toBeVisible();
    await expect(page.getByText("管理员通过修改申请").first()).toBeVisible();
    await expect(page.getByText("确认面试安排").first()).toBeVisible();
    await expect(page.getByText("调整面试安排").first()).toBeVisible();
    await expect(page.getByText("发送面试安排通知").first()).toBeVisible();
    await expect(page.getByText("保存管理员跟进备注").first()).toBeVisible();
    await expect(page.getByText("取消面试安排").first()).toBeVisible();
  });
});
