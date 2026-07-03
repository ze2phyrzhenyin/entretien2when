import Link from "next/link";
import { adminNavItems, type AdminShellActive } from "@/components/layout/admin-sidebar";
import { cn } from "@/lib/utils";

export function AdminMobileNav({ active = "groups" }: { active?: AdminShellActive }) {
  return (
    <nav
      className="sticky top-16 z-20 grid grid-cols-3 gap-1 border-b border-border bg-surface/95 px-2 py-2 backdrop-blur md:hidden"
      aria-label="管理员主导航"
    >
      {adminNavItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium transition-colors duration-fast",
            active === item.key
              ? "bg-primary-soft text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          <span className="max-w-full truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
