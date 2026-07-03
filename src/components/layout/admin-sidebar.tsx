import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminShellActive = "groups" | "audit" | "reviews" | "appointments" | "mailato";

const navItems: Array<{ key: AdminShellActive; label: string; href: string }> = [
  { key: "groups", label: "面试组", href: "/admin" },
  { key: "audit", label: "操作日志", href: "/admin/audit" },
  { key: "reviews", label: "审核中心", href: "/admin/reviews" },
  { key: "appointments", label: "预约管理", href: "/admin/appointments" },
  { key: "mailato", label: "Mailato 邮件", href: "/admin/mailato" }
];

export function AdminSidebar({ active = "groups" }: { active?: AdminShellActive }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface px-5 py-6 md:block">
      <Link href="/admin" className="flex items-center gap-2 text-base font-semibold">
        <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
        面试时间管理
      </Link>
      <nav className="mt-8 space-y-1 text-sm" aria-label="管理员主导航">
        {navItems.map((item) => (
          <Link
            key={item.key}
            className={cn(
              "block rounded-md px-3 py-2 font-medium transition-colors duration-fast",
              active === item.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
