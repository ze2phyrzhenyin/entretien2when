import { z } from "zod";
import { cuidSchema, requiredTextSchema } from "@/lib/validation/common";

export const candidateEmailActionSchema = z.object({
  candidateIds: z
    .array(cuidSchema)
    .min(1, "请选择至少一位候选人")
    .max(50, "一次最多发送 50 位候选人"),
  subject: requiredTextSchema("请输入邮件主题", 160),
  body: requiredTextSchema("请输入邮件正文", 5000),
  returnTo: z.string().optional()
});
