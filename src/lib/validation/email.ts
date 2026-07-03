import { z } from "zod";
import { candidateEmailTemplates } from "@/lib/mail/email-templates";
import { cuidSchema, requiredTextSchema } from "@/lib/validation/common";

const candidateEmailTemplateKeys = new Set(candidateEmailTemplates.map((template) => template.key));

function parseEmailList(value: string) {
  return [
    ...new Set(
      value
        .split(/[,\s;；]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  ];
}

function emailListSchema({
  label,
  maxCount,
  requireOne = false
}: {
  label: string;
  maxCount: number;
  requireOne?: boolean;
}) {
  return z
    .string()
    .max(2000, `${label}最多 2000 个字符`)
    .transform((value) => parseEmailList(value))
    .superRefine((emails, context) => {
      if (requireOne && emails.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `请填写${label}`
        });
        return;
      }
      if (emails.length > maxCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `一次最多填写 ${maxCount} 个${label}`
        });
        return;
      }

      for (const email of emails) {
        if (!z.string().email().safeParse(email).success) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label}格式无效：${email}`
          });
        }
      }
    });
}

export const ccEmailListSchema = z
  .string()
  .max(1000, "抄送（CC）最多 1000 个字符")
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
          message: `抄送（CC）邮箱格式无效：${email}`
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
    errorMap: () => ({ message: "发送前请确认收件人、主题和正文" })
  }),
  returnTo: z.string().optional()
});

export const retryCandidateEmailSchema = z.object({
  returnTo: z.string().optional()
});

export const mailatoEmailActionSchema = z.object({
  toEmails: emailListSchema({ label: "收件人", maxCount: 50, requireOne: true }),
  ccEmails: emailListSchema({ label: "抄送（CC）", maxCount: 50 }),
  bccEmails: emailListSchema({ label: "密送（BCC）", maxCount: 50 }),
  subject: requiredTextSchema("请输入邮件主题", 160),
  body: requiredTextSchema("请输入邮件正文", 10000),
  confirmSend: z.literal("yes", {
    errorMap: () => ({ message: "发送前请确认收件人、主题和正文" })
  })
});

export const emailTemplateUpdateSchema = z.object({
  key: z.string().refine((value) => candidateEmailTemplateKeys.has(value), {
    message: "未知邮件模板"
  }),
  label: requiredTextSchema("请输入模板名称", 80),
  subject: requiredTextSchema("请输入邮件主题", 160),
  body: requiredTextSchema("请输入邮件正文", 5000)
});

export const emailTemplateResetSchema = z.object({
  key: z.string().refine((value) => candidateEmailTemplateKeys.has(value), {
    message: "未知邮件模板"
  })
});
