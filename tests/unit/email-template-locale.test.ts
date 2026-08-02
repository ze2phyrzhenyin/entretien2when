import { AdminRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  auditCreate: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    emailTemplate: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      delete: mocks.delete
    },
    auditLog: {
      create: mocks.auditCreate
    }
  }
}));

import {
  emailTemplateKeys,
  getCandidateEmailTemplates,
  getEmailTemplateForKey,
  resolveEmailTemplateContentLocale
} from "@/lib/mail/email-template-store";
import {
  resetEmailTemplateAction,
  upsertEmailTemplateAction
} from "@/server/actions/email-template";

const englishOverride = {
  id: "template_en",
  key: "interview_notice",
  locale: "en",
  label: "Custom interview details",
  subject: "Custom {groupName} interview details",
  body: "Hello {name}, this is a custom English message.",
  updatedByAdminId: "admin_super",
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  updatedAt: new Date("2026-08-01T10:00:00.000Z")
};

const chineseOverride = {
  ...englishOverride,
  id: "template_zh",
  locale: "zh-CN",
  label: "自定义面试安排",
  subject: "自定义 {groupName} 面试安排",
  body: "你好 {name}，这是一封自定义中文邮件。"
};

describe("localized email template overrides", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.requireAdmin.mockResolvedValue({
      id: "admin_super",
      role: AdminRole.SUPER_ADMIN
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit_1" });
  });

  it("loads Chinese and English overrides independently", async () => {
    mocks.findMany
      .mockResolvedValueOnce([englishOverride])
      .mockResolvedValueOnce([chineseOverride]);

    const englishTemplates = await getCandidateEmailTemplates("en");
    const chineseTemplates = await getCandidateEmailTemplates("zh-CN");

    expect(mocks.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        key: { in: emailTemplateKeys },
        locale: "en"
      },
      select: {
        key: true,
        locale: true,
        label: true,
        subject: true,
        body: true
      }
    });
    expect(mocks.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          key: { in: emailTemplateKeys },
          locale: "zh-CN"
        }
      })
    );
    expect(englishTemplates.find((template) => template.key === "interview_notice")).toEqual({
      key: "interview_notice",
      label: englishOverride.label,
      subject: englishOverride.subject,
      body: englishOverride.body
    });
    expect(chineseTemplates.find((template) => template.key === "interview_notice")).toEqual({
      key: "interview_notice",
      label: chineseOverride.label,
      subject: chineseOverride.subject,
      body: chineseOverride.body
    });
  });

  it("defaults template content to historical Chinese independently of UI locale", () => {
    expect(resolveEmailTemplateContentLocale(undefined)).toBe("zh-CN");
    expect(resolveEmailTemplateContentLocale("en")).toBe("en");
    expect(resolveEmailTemplateContentLocale("fr-FR")).toBe("zh-CN");
  });

  it("uses the composite key when loading one localized override", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const template = await getEmailTemplateForKey("interview_notice", "zh-CN");

    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key_locale: {
            key: "interview_notice",
            locale: "zh-CN"
          }
        }
      })
    );
    expect(template.subject).toBe("{groupName} 面试安排通知");
  });

  it("stores an English override without touching the Chinese row", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue(englishOverride);

    const formData = new FormData();
    formData.set("key", englishOverride.key);
    formData.set("locale", englishOverride.locale);
    formData.set("label", englishOverride.label);
    formData.set("subject", englishOverride.subject);
    formData.set("body", englishOverride.body);

    await upsertEmailTemplateAction(formData);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key_locale: {
            key: englishOverride.key,
            locale: "en"
          }
        },
        create: expect.objectContaining({
          key: englishOverride.key,
          locale: "en"
        })
      })
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        beforeData: expect.objectContaining({ locale: "en" }),
        afterData: expect.objectContaining({ locale: "en" })
      })
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/email-templates?template=saved&key=interview_notice&templateLocale=en"
    );
  });

  it("resets only the requested locale override", async () => {
    mocks.findUnique.mockResolvedValue(englishOverride);
    mocks.delete.mockResolvedValue(englishOverride);

    const formData = new FormData();
    formData.set("key", englishOverride.key);
    formData.set("locale", "en");

    await resetEmailTemplateAction(formData);

    expect(mocks.delete).toHaveBeenCalledTimes(1);
    expect(mocks.delete).toHaveBeenCalledWith({
      where: {
        key_locale: {
          key: englishOverride.key,
          locale: "en"
        }
      }
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        beforeData: expect.objectContaining({ locale: "en" }),
        afterData: expect.objectContaining({ locale: "en" })
      })
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/email-templates?template=reset&key=interview_notice&templateLocale=en"
    );
  });
});
