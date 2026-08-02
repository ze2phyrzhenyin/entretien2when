import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { type AdminShellActive, visibleAdminNavItems } from "@/components/layout/admin-sidebar";
import type { AdminNavigationCapabilities } from "@/lib/permissions/admin";
import { cn } from "@/lib/utils";
export async function AdminMobileNav({
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
    <nav
      className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-border bg-surface/95 px-2 py-2 backdrop-blur md:hidden"
      aria-label={t("legacy.administrator_main_navigation.0d120ef1")}
    >
      {visibleAdminNavItems(isSuperAdmin, capabilities).map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            "flex min-h-11 min-w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors duration-fast",
            active === item.key
              ? "bg-primary-soft text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          <span className="max-w-full truncate">{t(item.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
