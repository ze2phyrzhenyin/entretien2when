import { z } from "zod";
import { AdminGroupRole, AdminRole, AdminStatus } from "@prisma/client";
import { cuidSchema, emailSchema, requiredTextSchema } from "@/lib/validation/common";

export const createAdminSchema = z.object({
  email: emailSchema,
  displayName: requiredTextSchema("请输入管理员姓名", 120),
  password: z.string().min(12, "初始密码至少 12 个字符").max(256, "密码过长"),
  role: z.nativeEnum(AdminRole).default(AdminRole.ADMIN)
});

export const updateAdminSchema = z.object({
  adminId: cuidSchema,
  role: z.nativeEnum(AdminRole),
  status: z.nativeEnum(AdminStatus)
});

export const resetAdminPasswordSchema = z.object({
  adminId: cuidSchema,
  password: z.string().min(12, "新密码至少 12 个字符").max(256, "密码过长")
});

export const upsertGroupMembershipSchema = z.object({
  adminId: cuidSchema,
  role: z.nativeEnum(AdminGroupRole)
});

export const revokeGroupMembershipSchema = z.object({
  adminId: cuidSchema
});
