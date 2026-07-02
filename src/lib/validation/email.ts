import { z } from "zod";
import { cuidSchema, requiredTextSchema } from "@/lib/validation/common";

export const candidateEmailActionSchema = z.object({
  candidateIds: z
    .array(cuidSchema)
    .min(1, "请选择至少一位候选人")
    .max(50, "一次最多发送 50 位候选人"),
  templateKey: z.string().trim().max(80).optional(),
  subject: requiredTextSchema("请输入邮件主题", 160),
  body: requiredTextSchema("请输入邮件正文", 5000),
  confirmSend: z.literal("yes", {
    errorMap: () => ({ message: "发送前请确认收件人和正文" })
  }),
  returnTo: z.string().optional()
});

export const retryCandidateEmailSchema = z.object({
  returnTo: z.string().optional()
});
