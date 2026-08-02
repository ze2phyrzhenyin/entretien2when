import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  FileText,
  History,
  Inbox,
  Send,
  UserCog,
  type LucideIcon
} from "lucide-react";
import type { AdminNavigationCapabilities } from "@/lib/permissions/admin";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/i18n/catalogs";
export type AdminShellActive =
  | "groups"
  | "projects"
  | "admins"
  | "audit"
  | "reviews"
  | "appointments"
  | "emailTemplates"
  | "mailato";
export const adminNavItems: Array<{
  key: AdminShellActive;
  label: MessageKey;
  href: string;
  icon: LucideIcon;
  requiresSuperAdmin?: boolean;
  requiresCapability?: keyof AdminNavigationCapabilities;
}> = [
  { key: "groups", label: "legacy.interview_groups.e677802f", href: "/admin", icon: ClipboardList },
  {
    key: "projects",
    label: "legacy.recruitment_projects.3e10026b",
    href: "/admin/projects",
    icon: BriefcaseBusiness
  },
  {
    key: "admins",
    label: "legacy.administrator.e1979671",
    href: "/admin/admins",
    icon: UserCog,
    requiresSuperAdmin: true
  },
  {
    key: "audit",
    label: "legacy.audit_log.a0f79e91",
    href: "/admin/audit",
    icon: History,
    requiresCapability: "canViewAudit"
  },
  {
    key: "reviews",
    label: "legacy.change_reviews.00df3dfb",
    href: "/admin/reviews",
    icon: Inbox,
    requiresCapability: "canReview"
  },
  {
    key: "appointments",
    label: "legacy.interviews.2e9d0020",
    href: "/admin/appointments",
    icon: CalendarCheck,
    requiresCapability: "canSchedule"
  },
  {
    key: "emailTemplates",
    label: "legacy.email_templates.3e24ad26",
    href: "/admin/email-templates",
    icon: FileText,
    requiresSuperAdmin: true
  },
  {
    key: "mailato",
    label: "legacy.send_email.1579f7b4",
    href: "/admin/mailato",
    icon: Send,
    requiresSuperAdmin: true
  }
];
export function visibleAdminNavItems(
  isSuperAdmin: boolean,
  capabilities: AdminNavigationCapabilities
) {
  return adminNavItems.filter(
    (item) =>
      (isSuperAdmin || !item.requiresSuperAdmin) &&
      (!item.requiresCapability || capabilities[item.requiresCapability])
  );
}
export async function AdminSidebar({
  active = "groups",
  isSuperAdmin,
  capabilities
}: {
  active?: AdminShellActive;
  isSuperAdmin: boolean;
  capabilities: AdminNavigationCapabilities;
}) {
  const { t } = await getServerTranslator();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface px-5 py-6 md:block">
      <Link href="/admin" className="flex items-center gap-2 text-base font-semibold">
        <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
        {t("legacy.interview_time_management.d146c064")}
      </Link>
      <nav
        className="mt-8 space-y-1 text-sm"
        aria-label={t("legacy.administrator_main_navigation.0d120ef1")}
      >
        {visibleAdminNavItems(isSuperAdmin, capabilities).map((item) => (
          <Link
            key={item.key}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 font-medium transition-colors duration-fast",
              active === item.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            href={item.href}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {t(item.label)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
