import { describe, expect, it } from "vitest";
import { candidateEmailActionSchema } from "@/lib/validation/email";

describe("candidate email validation", () => {
  it("requires explicit confirmation before sending", () => {
    const result = candidateEmailActionSchema.safeParse({
      candidateIds: ["clx0000000000000000000000"],
      templateKey: "interview_notice",
      subject: "面试通知",
      body: "你好 {name}",
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
      confirmSend: "yes",
      returnTo: "/admin/groups/group_1/candidates"
    });

    expect(result.success).toBe(true);
  });
});
