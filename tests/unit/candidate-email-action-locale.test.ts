import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireGroupPermission: vi.fn(),
  findGroup: vi.fn(),
  findCandidates: vi.fn(),
  auditCreate: vi.fn(),
  createDelivery: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/permissions/admin", () => ({
  groupSchedulingRoles: ["OWNER", "SCHEDULER"],
  requireGroupPermission: mocks.requireGroupPermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    interviewGroup: { findUniqueOrThrow: mocks.findGroup },
    candidate: { findMany: mocks.findCandidates },
    $transaction: vi.fn(async (callback) => callback({ auditLog: { create: mocks.auditCreate } }))
  }
}));
vi.mock("@/server/services/candidate-email", () => ({
  createCandidateEmailDelivery: mocks.createDelivery,
  requeueCandidateEmailDelivery: vi.fn()
}));

import { sendCandidateEmailAction } from "@/server/actions/email";

describe("sendCandidateEmailAction recipient locale", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireAdmin.mockResolvedValue({ id: "admin_1" });
    mocks.requireGroupPermission.mockResolvedValue(undefined);
    mocks.findGroup.mockResolvedValue({
      id: "group_0001",
      name: "Mixed group",
      timezone: "Europe/Paris"
    });
    mocks.findCandidates.mockResolvedValue([
      {
        id: "candidate_zh",
        name: "张三",
        email: "zh@example.com",
        preferredLocale: "zh-CN",
        appointments: [
          {
            startAt: new Date("2026-08-10T08:00:00.000Z"),
            endAt: new Date("2026-08-10T09:00:00.000Z"),
            meetingLocation: "Room 1",
            candidateVisibleMessage: null
          }
        ]
      },
      {
        id: "candidate_en",
        name: "Alex",
        email: "en@example.com",
        preferredLocale: "en",
        appointments: [
          {
            startAt: new Date("2026-08-10T08:00:00.000Z"),
            endAt: new Date("2026-08-10T09:00:00.000Z"),
            meetingLocation: "Room 2",
            candidateVisibleMessage: null
          }
        ]
      }
    ]);
    mocks.createDelivery
      .mockResolvedValueOnce({ id: "delivery_zh" })
      .mockResolvedValueOnce({ id: "delivery_en" });
    mocks.auditCreate.mockResolvedValue({ id: "audit_1" });
  });

  it("renders one mixed batch using each candidate's saved language and date format", async () => {
    const formData = new FormData();
    formData.append("candidateIds", "candidate_zh");
    formData.append("candidateIds", "candidate_en");
    formData.set("templateKey", "interview_notice");
    formData.set("contentMode", "localizedBatch");
    formData.set("subjectZhCn", "中文主题");
    formData.set("bodyZhCn", "中文正文 {appointmentTime}");
    formData.set("subjectEn", "English subject");
    formData.set("bodyEn", "English body {appointmentTime}");
    formData.set("ccEmails", "");
    formData.set("confirmSend", "yes");
    formData.set("returnTo", "/admin/groups/group_0001/candidates");

    await sendCandidateEmailAction("group_0001", formData);

    const chineseInput = mocks.createDelivery.mock.calls[0]?.[0];
    const englishInput = mocks.createDelivery.mock.calls[1]?.[0];
    expect(chineseInput).toMatchObject({
      locale: "zh-CN",
      subject: "中文主题",
      bodyTemplate: "中文正文 {appointmentTime}"
    });
    expect(englishInput).toMatchObject({
      locale: "en",
      subject: "English subject",
      bodyTemplate: "English body {appointmentTime}"
    });
    expect(chineseInput.templateValues.appointmentTime).toContain("Europe/Paris");
    expect(englishInput.templateValues.appointmentTime).toContain("Europe/Paris");
    expect(chineseInput.templateValues.appointmentTime).not.toBe(
      englishInput.templateValues.appointmentTime
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        afterData: expect.objectContaining({
          contentMode: "localizedBatch",
          recipientLocales: {
            candidate_zh: "zh-CN",
            candidate_en: "en"
          }
        })
      })
    });
  });

  it("uses the database preference for a single recipient even if the form locale is stale", async () => {
    mocks.findCandidates.mockResolvedValue([
      {
        id: "candidate_en",
        name: "Alex",
        email: "en@example.com",
        preferredLocale: "en",
        appointments: []
      }
    ]);
    mocks.createDelivery.mockReset().mockResolvedValue({ id: "delivery_en" });
    const formData = new FormData();
    formData.set("candidateIds", "candidate_en");
    formData.set("templateKey", "interview_notice");
    formData.set("contentMode", "single");
    formData.set("locale", "zh-CN");
    formData.set("subject", "Reviewed English subject");
    formData.set("body", "Hello {name}");
    formData.set("ccEmails", "");
    formData.set("confirmSend", "yes");
    formData.set("returnTo", "/admin/groups/group_0001/candidates/candidate_en");

    await sendCandidateEmailAction("group_0001", formData);

    expect(mocks.createDelivery.mock.calls[0]?.[0]).toMatchObject({
      locale: "en",
      subject: "Reviewed English subject",
      bodyTemplate: "Hello {name}",
      templateValues: {
        appointmentTime: "Not scheduled",
        meetingLocation: "Not provided"
      }
    });
  });
});
