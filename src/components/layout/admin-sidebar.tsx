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
  type LucideIcon
} from "lucide-react";
import type { AdminNavigationCapabilities } from "@/lib/permissions/admin";
import { cn } from "@/lib/utils";

export type AdminShellActive =
  "groups" | "projects" | "audit" | "reviews" | "appointments" | "emailTemplates" | "mailato";

export const adminNavItems: Array<{
  key: AdminShellActive;
  label: string;
  href: string;
  icon: LucideIcon;
  requiresSuperAdmin?: boolean;
  requiresCapability?: keyof AdminNavigationCapabilities;
}> = [
  { key: "groups", label: "面试组", href: "/admin", icon: ClipboardList },
  { key: "projects", label: "招聘项目", href: "/admin/projects", icon: BriefcaseBusiness },
  {
    key: "audit",
    label: "审计日志",
    href: "/admin/audit",
    icon: History,
    requiresCapability: "canViewAudit"
  },
  {
    key: "reviews",
    label: "修改审核",
    href: "/admin/reviews",
    icon: Inbox,
    requiresCapability: "canReview"
  },
  {
    key: "appointments",
    label: "面试安排",
    href: "/admin/appointments",
    icon: CalendarCheck,
    requiresCapability: "canSchedule"
  },
  {
    key: "emailTemplates",
    label: "邮件模板",
    href: "/admin/email-templates",
    icon: FileText,
    requiresSuperAdmin: true
  },
  {
    key: "mailato",
    label: "邮件发送",
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

export function AdminSidebar({
  active = "groups",
  isSuperAdmin,
  capabilities
}: {
  active?: AdminShellActive;
  isSuperAdmin: boolean;
  capabilities: AdminNavigationCapabilities;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface px-5 py-6 md:block">
      <Link href="/admin" className="flex items-center gap-2 text-base font-semibold">
        <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
        面试时间管理
      </Link>
      <nav className="mt-8 space-y-1 text-sm" aria-label="管理员主导航">
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
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
