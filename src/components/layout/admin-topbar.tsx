import { LogOut, ShieldCheck } from "lucide-react";
import type { Admin } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { adminLogoutAction } from "@/server/actions/admin-auth";

export function AdminTopbar({
  admin,
  title
}: {
  admin: Pick<Admin, "displayName" | "email" | "role">;
  title: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur md:px-8">
      <div>
        <p className="text-sm text-muted-foreground">管理员后台</p>
        <h1 className="text-base font-semibold">{title}</h1>
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
          <Button variant="ghost" size="icon" type="submit" aria-label="退出登录">
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </header>
  );
}
