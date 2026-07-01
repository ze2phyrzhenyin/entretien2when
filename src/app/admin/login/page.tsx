import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/layout/auth-layout";
import { getCurrentAdmin } from "@/lib/auth/session";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">管理员后台</p>
        <h1 className="mt-2 text-2xl font-semibold">邮箱密码登录</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          登录后可以管理授权面试组、审核候选人修改申请并安排面试。
        </p>
      </div>
      <AdminLoginForm />
    </AuthLayout>
  );
}
