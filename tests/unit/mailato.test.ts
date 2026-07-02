import { describe, expect, it } from "vitest";
import { buildMailatoArgs } from "@/lib/mail/mailato";
import { renderCandidateEmailTemplate } from "@/lib/mail/render-template";

describe("mailato adapter", () => {
  it("builds dry-run args for one recipient without shell interpolation", () => {
    const args = buildMailatoArgs({
      recipient: {
        name: "张三",
        email: "zhangsan@example.com"
      },
      subject: "面试通知",
      bodyFile: "/tmp/body.txt",
      auditId: "audit-1",
      dryRun: true
    });

    expect(args).toEqual([
      "send",
      "--to",
      "张三 <zhangsan@example.com>",
      "--subject",
      "面试通知",
      "--body-file",
      "/tmp/body.txt",
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
});
