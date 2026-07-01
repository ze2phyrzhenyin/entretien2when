import { z } from "zod";
import { emailSchema, groupCodeSchema, requiredTextSchema } from "@/lib/validation/common";

export const candidateIdentitySchema = z.object({
  groupCode: groupCodeSchema,
  name: requiredTextSchema("请输入姓名", 80),
  email: emailSchema
});

export const candidateAvailabilitySchema = candidateIdentitySchema.extend({
  candidateNote: z.string().trim().max(1000, "备注最多 1000 个字符").optional(),
  slotIds: z.array(z.string().min(1)).min(1, "请选择可用时间")
});
