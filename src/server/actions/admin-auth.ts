"use server";

import { redirect } from "next/navigation";
import { AdminStatus } from "@prisma/client";
import { createAdminSession, destroyCurrentAdminSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { adminLoginSchema } from "@/lib/validation/admin-auth";

export type AdminLoginState = {
  error?: string;
};

export async function adminLoginAction(
  _previousState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "请检查登录信息" };
  }

  const admin = await prisma.admin.findUnique({
    where: {
      email: parsed.data.email
    }
  });

  const isValid =
    admin &&
    admin.status === AdminStatus.ACTIVE &&
    (await verifyPassword(parsed.data.password, admin.passwordHash));

  if (!isValid) {
    return { error: "邮箱或密码不正确" };
  }

  await createAdminSession(admin.id);
  await prisma.admin.update({
    where: {
      id: admin.id
    },
    data: {
      lastLoginAt: new Date()
    }
  });

  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyCurrentAdminSession();
  redirect("/admin/login");
}
