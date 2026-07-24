import { AdminRole, type Admin } from "@prisma/client";
import { AdminContent } from "@/components/layout/admin-content";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { AdminSidebar, type AdminShellActive } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import { getAdminNavigationCapabilities } from "@/lib/permissions/admin";

const shellTitle: Record<AdminShellActive, string> = {
  groups: "面试组管理",
  projects: "招聘项目",
  audit: "审计日志",
  reviews: "修改审核",
  appointments: "面试安排",
  emailTemplates: "邮件模板",
  mailato: "邮件发送"
};

export async function AdminShell({
  admin,
  children,
  active = "groups"
}: {
  admin: Pick<Admin, "id" | "displayName" | "email" | "role">;
  children: React.ReactNode;
  active?: AdminShellActive;
}) {
  const isSuperAdmin = admin.role === AdminRole.SUPER_ADMIN;
  const navigationCapabilities = await getAdminNavigationCapabilities(admin);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar
        active={active}
        isSuperAdmin={isSuperAdmin}
        capabilities={navigationCapabilities}
      />
      <div className="md:pl-64">
        <AdminTopbar admin={admin} title={shellTitle[active]} />
        <AdminMobileNav
          active={active}
          isSuperAdmin={isSuperAdmin}
          capabilities={navigationCapabilities}
        />
        <AdminContent>{children}</AdminContent>
      </div>
    </div>
  );
}
