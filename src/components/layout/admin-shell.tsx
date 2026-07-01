import type { Admin } from "@prisma/client";
import { AdminContent } from "@/components/layout/admin-content";
import { AdminSidebar, type AdminShellActive } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";

export function AdminShell({
  admin,
  children,
  active = "groups"
}: {
  admin: Pick<Admin, "displayName" | "email" | "role">;
  children: React.ReactNode;
  active?: AdminShellActive;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar active={active} />
      <div className="md:pl-64">
        <AdminTopbar admin={admin} title={active === "audit" ? "操作日志" : "面试组工作台"} />
        <AdminContent>{children}</AdminContent>
      </div>
    </div>
  );
}
