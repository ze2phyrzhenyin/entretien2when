import { AdminRole, type Admin } from "@prisma/client";
import { AdminContent } from "@/components/layout/admin-content";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { AdminSidebar, type AdminShellActive } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import { getAdminNavigationCapabilities } from "@/lib/permissions/admin";
import { getServerTranslator } from "@/i18n/server";
import type { MessageKey } from "@/i18n/catalogs";

const shellTitle: Record<AdminShellActive, MessageKey> = {
  groups: "legacy.interview_groups.607bbde7",
  projects: "legacy.recruitment_projects.3e10026b",
  admins: "legacy.administrators_and_roles.ca1fc9e6",
  audit: "legacy.audit_log.a0f79e91",
  reviews: "legacy.change_reviews.00df3dfb",
  appointments: "legacy.interviews.2e9d0020",
  emailTemplates: "legacy.email_templates.3e24ad26",
  mailato: "legacy.send_email.1579f7b4"
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
  const { t } = await getServerTranslator();
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
        <AdminTopbar admin={admin} title={t(shellTitle[active])} />
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
