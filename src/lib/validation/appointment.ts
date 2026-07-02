import { z } from "zod";

export const scheduleAppointmentSchema = z
  .object({
    slotIds: z.array(z.string().min(1)).min(1, "请选择预约时间"),
    meetingLocation: z.string().trim().max(500, "会议地点最多 500 个字符").optional(),
    candidateVisibleMessage: z
      .string()
      .trim()
      .max(1000, "候选人可见说明最多 1000 个字符")
      .optional(),
    internalNote: z.string().trim().max(1000, "内部备注最多 1000 个字符").optional(),
    sendEmail: z.boolean(),
    emailSubject: z.string().trim().max(160, "邮件主题最多 160 个字符").optional(),
    emailBody: z.string().trim().max(5000, "邮件正文最多 5000 个字符").optional()
  })
  .superRefine((value, context) => {
    if (!value.sendEmail) {
      return;
    }
    if (!value.emailSubject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emailSubject"],
        message: "请输入邮件主题"
      });
    }
    if (!value.emailBody) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["emailBody"],
        message: "请输入邮件正文"
      });
    }
  });
