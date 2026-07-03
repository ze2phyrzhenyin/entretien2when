import { describe, expect, it } from "vitest";
import {
  candidateEmailActionSchema,
  emailTemplateUpdateSchema,
  mailatoEmailActionSchema
} from "@/lib/validation/email";

describe("candidate email validation", () => {
  it("requires explicit confirmation before sending", () => {
    const result = candidateEmailActionSchema.safeParse({
      candidateIds: ["clx0000000000000000000000"],
      templateKey: "interview_notice",
      subject: "面试通知",
      body: "你好 {name}",
      ccEmails: "",
      returnTo: "/admin/groups/group_1/candidates"
    });

    expect(result.success).toBe(false);
  });

  it("accepts a confirmed batch within the recipient limit", () => {
    const result = candidateEmailActionSchema.safeParse({
      candidateIds: ["clx0000000000000000000000"],
      templateKey: "interview_notice",
      subject: "{groupName} 面试通知",
      body: "你好 {name}，你的邮箱是 {email}。",
      ccEmails: "hr@example.com；manager@example.com",
      confirmSend: "yes",
      returnTo: "/admin/groups/group_1/candidates"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ccEmails).toEqual(["hr@example.com", "manager@example.com"]);
    }
  });

  it("rejects invalid cc emails", () => {
    const result = candidateEmailActionSchema.safeParse({
      candidateIds: ["clx0000000000000000000000"],
      templateKey: "interview_notice",
      subject: "{groupName} 面试通知",
      body: "你好 {name}。",
      ccEmails: "not-an-email",
      confirmSend: "yes",
      returnTo: "/admin/groups/group_1/candidates"
    });

    expect(result.success).toBe(false);
  });

  it("validates direct Mailato emails with cc and bcc", () => {
    const result = mailatoEmailActionSchema.safeParse({
      toEmails: "candidate@example.com; interviewer@example.com",
      ccEmails: "hr@example.com",
      bccEmails: "owner@example.com",
      subject: "测试邮件",
      body: "正文",
      confirmSend: "yes"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toEmails).toEqual(["candidate@example.com", "interviewer@example.com"]);
      expect(result.data.ccEmails).toEqual(["hr@example.com"]);
      expect(result.data.bccEmails).toEqual(["owner@example.com"]);
    }
  });

  it("requires at least one direct Mailato recipient", () => {
    const result = mailatoEmailActionSchema.safeParse({
      toEmails: "",
      ccEmails: "",
      bccEmails: "",
      subject: "测试邮件",
      body: "正文",
      confirmSend: "yes"
    });

    expect(result.success).toBe(false);
  });

  it("validates global email template updates", () => {
    const result = emailTemplateUpdateSchema.safeParse({
      key: "interview_notice",
      label: "候选人通知",
      subject: "{groupName} 通知",
      body: "你好 {name}"
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown global email template keys", () => {
    const result = emailTemplateUpdateSchema.safeParse({
      key: "unknown_template",
      label: "未知模板",
      subject: "通知",
      body: "正文"
    });

    expect(result.success).toBe(false);
  });
});
