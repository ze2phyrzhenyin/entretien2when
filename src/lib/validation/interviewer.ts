import { z } from "zod";
import { emailSchema, requiredTextSchema } from "@/lib/validation/common";

export const interviewerFormSchema = z.object({
  name: requiredTextSchema("请输入面试官姓名", 120),
  email: emailSchema
});
