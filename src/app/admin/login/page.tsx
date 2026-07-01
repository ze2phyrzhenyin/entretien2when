import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentAdmin } from "@/lib/auth/session";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <Card className="w-full p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-medium text-primary">管理员后台</p>
            <h1 className="mt-2 text-2xl font-semibold">邮箱密码登录</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              登录后可以管理授权面试组、审核候选人修改申请并安排面试。
            </p>
          </div>
          <AdminLoginForm />
        </Card>
      </div>
    </main>
  );
}
