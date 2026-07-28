import { z } from "zod";
import { InterviewRoundStatus } from "@prisma/client";
import { cuidSchema, requiredTextSchema } from "@/lib/validation/common";

export const roundFormSchema = z.object({
  roundId: cuidSchema.optional(),
  name: requiredTextSchema("请输入轮次名称", 120),
  orderIndex: z.coerce.number().int().min(1).max(1000),
  description: z.string().trim().max(1000, "轮次说明最多 1000 个字符").optional(),
  interviewDurationMinutes: z.coerce.number().int().min(5).max(480),
  status: z.nativeEnum(InterviewRoundStatus).default(InterviewRoundStatus.ACTIVE)
});
