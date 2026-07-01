import { z } from "zod";
import { InterviewGroupStatus } from "@prisma/client";
import { requiredTextSchema } from "@/lib/validation/common";

export const groupFormSchema = z
  .object({
    name: requiredTextSchema("请输入面试组名称", 120),
    publicDescription: z.string().trim().max(1000, "说明最多 1000 个字符").optional(),
    timezone: z.string().trim().min(1).default("Asia/Shanghai"),
    status: z.nativeEnum(InterviewGroupStatus).default(InterviewGroupStatus.OPEN),
    slotDurationMinutes: z.coerce.number().int().min(15).max(180).default(30),
    interviewDurationMinutes: z.coerce.number().int().min(15).max(240).default(60),
    minSelectSlots: z.coerce.number().int().min(1).max(100).default(1),
    maxSelectSlots: z.coerce.number().int().min(1).max(100).default(6)
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
