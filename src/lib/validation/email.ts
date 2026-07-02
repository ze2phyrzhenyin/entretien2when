import { z } from "zod";
import { cuidSchema, requiredTextSchema } from "@/lib/validation/common";

export function parseEmailList(value: string) {
  return [
    ...new Set(
      value
        .split(/[,\s;；]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  ];
}

export const ccEmailListSchema = z
  .string()
  .max(1000, "抄送最多 1000 个字符")
  .transform((value) => parseEmailList(value))
  .superRefine((emails, context) => {
    if (emails.length > 20) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "一次最多抄送 20 个邮箱"
      });
      return;
    }

    for (const email of emails) {
      if (!z.string().email().safeParse(email).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `抄送邮箱格式无效：${email}`
        });
      }
    }
  });

export const candidateEmailActionSchema = z.object({
  candidateIds: z
    .array(cuidSchema)
    .min(1, "请选择至少一位候选人")
    .max(50, "一次最多发送 50 位候选人"),
  templateKey: z.string().trim().max(80).optional(),
  subject: requiredTextSchema("请输入邮件主题", 160),
  body: requiredTextSchema("请输入邮件正文", 5000),
  ccEmails: ccEmailListSchema,
  confirmSend: z.literal("yes", {
    errorMap: () => ({ message: "发送前请确认收件人和正文" })
  }),
  returnTo: z.string().optional()
});

export const retryCandidateEmailSchema = z.object({
  returnTo: z.string().optional()
});
