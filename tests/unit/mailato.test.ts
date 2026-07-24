import { describe, expect, it } from "vitest";
import { buildMailatoArgs } from "@/lib/mail/mailato";
import { renderCandidateEmailTemplate } from "@/lib/mail/render-template";

describe("mailato adapter", () => {
  it("builds dry-run args for one recipient without shell interpolation", () => {
    const args = buildMailatoArgs({
      recipients: [
        {
          name: "张三",
          email: "zhangsan@example.com"
        },
        {
          email: "lisi@example.com"
        }
      ],
      cc: [
        {
          email: "hr@example.com"
        },
        {
          name: "面试官",
          email: "interviewer@example.com"
        }
      ],
      bcc: [{ email: "owner@example.com" }],
      subject: "面试通知",
      bodyFile: "/tmp/body.txt",
      idempotencyKey: "candidate-email-delivery-1",
      auditId: "audit-1",
      dryRun: true
    });

    expect(args).toEqual([
      "send",
      "--to",
      "张三 <zhangsan@example.com>",
      "--to",
      "lisi@example.com",
      "--subject",
      "面试通知",
      "--body-file",
      "/tmp/body.txt",
      "--cc",
      "hr@example.com",
      "--cc",
      "面试官 <interviewer@example.com>",
      "--bcc",
      "owner@example.com",
      "--idempotency-key",
      "candidate-email-delivery-1",
      "--audit-id",
      "audit-1",
      "--dry-run-json"
    ]);
  });

  it("builds confirmed send args for production delivery", () => {
    const args = buildMailatoArgs({
      recipient: {
        email: "candidate@example.com"
      },
      subject: "面试通知",
      bodyFile: "/tmp/body.txt",
      dryRun: false
    });

    expect(args).toContain("--json");
    expect(args).toContain("--yes");
    expect(args).not.toContain("--dry-run-json");
  });

  it("renders candidate placeholders per recipient", () => {
    expect(
      renderCandidateEmailTemplate("你好 {name}，请查看 {groupName}。你的邮箱：{email}", {
        candidateName: "李四",
        candidateEmail: "lisi@example.com",
        groupName: "产品一面"
      })
    ).toBe("你好 李四，请查看 产品一面。你的邮箱：lisi@example.com");
  });

  it("renders appointment placeholders for confirmed interview emails", () => {
    expect(
      renderCandidateEmailTemplate(
        "时间：{appointmentTime}\n地点：{meetingLocation}\n说明：{candidateMessage}",
        {
          candidateName: "李四",
          candidateEmail: "lisi@example.com",
          groupName: "产品一面",
          appointmentTime: "2026/08/03 10:00-11:00（北京时间）",
          meetingLocation: "腾讯会议 100-200-300",
          candidateMessage: "请提前 5 分钟进入会议。"
        }
      )
    ).toBe(
      "时间：2026/08/03 10:00-11:00（北京时间）\n地点：腾讯会议 100-200-300\n说明：请提前 5 分钟进入会议。"
    );
  });
});
