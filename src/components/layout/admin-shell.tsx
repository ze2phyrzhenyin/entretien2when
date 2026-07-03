import type { Admin } from "@prisma/client";
import { AdminContent } from "@/components/layout/admin-content";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { AdminSidebar, type AdminShellActive } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";

const shellTitle: Record<AdminShellActive, string> = {
  groups: "面试组管理",
  audit: "审计日志",
  reviews: "修改审核",
  appointments: "面试安排",
  mailato: "邮件发送"
};

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
        <AdminTopbar admin={admin} title={shellTitle[active]} />
        <AdminMobileNav active={active} />
        <AdminContent>{children}</AdminContent>
      </div>
    </div>
  );
}
