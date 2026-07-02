import { z } from "zod";
import { InterviewGroupStatus } from "@prisma/client";
import { isValidTimezone } from "@/lib/date/timezone";
import { requiredTextSchema } from "@/lib/validation/common";

const minutesSchema = (label: string) =>
  z.coerce
    .number({
      invalid_type_error: `${label}必须是数字`
    })
    .int(`${label}必须是整数`)
    .positive(`${label}必须是正整数`);

export const groupFormSchema = z
  .object({
    name: requiredTextSchema("请输入面试组名称", 120),
    publicDescription: z.string().trim().max(1000, "说明最多 1000 个字符").optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .refine(isValidTimezone, "请输入有效 IANA 时区，例如 Asia/Shanghai 或 Europe/Paris")
      .default("Asia/Shanghai"),
    status: z.nativeEnum(InterviewGroupStatus).default(InterviewGroupStatus.OPEN),
    slotDurationMinutes: minutesSchema("时间粒度").default(60),
    interviewDurationMinutes: minutesSchema("面试时长").default(30),
    minSelectSlots: z.coerce.number().int().min(1).max(100).default(1),
    maxSelectSlots: z.coerce.number().int().min(1).max(100).default(6)
  })
  .refine((value) => value.interviewDurationMinutes < value.slotDurationMinutes, {
    path: ["interviewDurationMinutes"],
    message: "面试时长必须短于时间粒度"
  })
  .refine((value) => value.maxSelectSlots >= value.minSelectSlots, {
    path: ["maxSelectSlots"],
    message: "最多可选数量不能小于最少可选数量"
  });

export const grantGroupAdminSchema = z.object({
  adminEmail: z
    .string()
    .trim()
    .email("请输入管理员邮箱")
    .transform((value) => value.toLowerCase()),
  canViewCandidates: z.boolean().default(true),
  canEditGroup: z.boolean().default(false),
  canReviewModifications: z.boolean().default(false),
  canScheduleInterview: z.boolean().default(false)
});
