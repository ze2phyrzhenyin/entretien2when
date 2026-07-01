import Link from "next/link";
import { CalendarClock, LogOut, ShieldCheck } from "lucide-react";
import type { Admin } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { adminLogoutAction } from "@/server/actions/admin-auth";

export function AdminShell({
  admin,
  children
}: {
  admin: Pick<Admin, "displayName" | "email" | "role">;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white px-5 py-6 md:block">
        <Link href="/admin" className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
          面试时间管理
        </Link>
        <nav className="mt-8 space-y-1 text-sm">
          <Link className="block rounded-md bg-muted px-3 py-2 font-medium" href="/admin">
            面试组
          </Link>
          <span className="block rounded-md px-3 py-2 text-muted-foreground">审核中心</span>
          <span className="block rounded-md px-3 py-2 text-muted-foreground">预约管理</span>
        </nav>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur md:px-8">
          <div>
            <p className="text-sm text-muted-foreground">管理员后台</p>
            <h1 className="text-base font-semibold">面试组工作台</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium">{admin.displayName}</p>
              <p className="text-muted-foreground">{admin.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {admin.role === "SUPER_ADMIN" ? "超级管理员" : "管理员"}
            </span>
            <form action={adminLogoutAction}>
              <Button variant="ghost" className="h-9 px-2" type="submit" aria-label="退出登录">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
