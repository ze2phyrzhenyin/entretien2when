import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  History,
  Inbox,
  Send,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminShellActive = "groups" | "audit" | "reviews" | "appointments" | "mailato";

export const adminNavItems: Array<{
  key: AdminShellActive;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { key: "groups", label: "面试组", href: "/admin", icon: ClipboardList },
  { key: "audit", label: "审计日志", href: "/admin/audit", icon: History },
  { key: "reviews", label: "修改审核", href: "/admin/reviews", icon: Inbox },
  { key: "appointments", label: "面试安排", href: "/admin/appointments", icon: CalendarCheck },
  { key: "mailato", label: "邮件发送", href: "/admin/mailato", icon: Send }
];

export function AdminSidebar({ active = "groups" }: { active?: AdminShellActive }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface px-5 py-6 md:block">
      <Link href="/admin" className="flex items-center gap-2 text-base font-semibold">
        <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
        面试时间管理
      </Link>
      <nav className="mt-8 space-y-1 text-sm" aria-label="管理员主导航">
        {adminNavItems.map((item) => (
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
