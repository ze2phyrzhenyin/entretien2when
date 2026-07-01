import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("请输入有效邮箱")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "请输入密码").max(256, "密码过长")
});
