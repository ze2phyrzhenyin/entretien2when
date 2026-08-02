import { getServerTranslator } from "@/i18n/server";
import { LogOut, ShieldCheck } from "lucide-react";
import { AdminRole, type Admin } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { adminLogoutAction } from "@/server/actions/admin-auth";
export async function AdminTopbar({
  admin,
  title
}: {
  admin: Pick<Admin, "displayName" | "email" | "role">;
  title: string;
}) {
  const { t } = await getServerTranslator();
  const roleLabel =
    admin.role === AdminRole.SUPER_ADMIN
      ? t("legacy.super_administrator.56db2484")
      : t("legacy.group_level_administrator.bd7363ad");
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface/95 py-2 pl-4 pr-32 backdrop-blur sm:pr-36 md:pl-8 md:pr-40">
      <div>
        <p className="text-sm text-muted-foreground">{t("legacy.administration.ed498fef")}</p>
        <h1 className="text-base font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right text-sm sm:block">
          <p className="font-medium">{admin.displayName}</p>
          <p className="text-muted-foreground">{admin.email}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {roleLabel}
        </span>
        <form action={adminLogoutAction}>
          <Button
            variant="ghost"
            size="icon"
            type="submit"
            aria-label={t("legacy.log_out.3ab8cc15")}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </header>
  );
}
