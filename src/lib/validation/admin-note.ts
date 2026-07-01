import { z } from "zod";

export const candidateAdminNoteSchema = z.object({
  body: z.string().trim().min(1, "请输入管理员私有备注").max(2000, "备注最多 2000 个字符")
});
