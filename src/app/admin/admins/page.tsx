import { getServerTranslator } from "@/i18n/server";
import { AdminRole, AdminStatus } from "@prisma/client";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/permissions/admin";
import { adminStatusLabel } from "@/lib/status-labels";
import {
  createAdminAction,
  resetAdminPasswordAction,
  updateAdminAction
} from "@/server/actions/admin-management";
import type { MessageKey } from "@/i18n/catalogs";
type AdminsPageProps = {
  searchParams: Promise<{
    admin?: string;
  }>;
};
const statusMessage: Record<
  string,
  {
    tone: "success" | "warning" | "danger";
    text: MessageKey;
  }
> = {
  created: { tone: "success", text: "legacy.administrator_has_been_created.00cf4323" },
  updated: { tone: "success", text: "legacy.administrator_roles_and_status_updated.f1794f4c" },
  "password-reset": {
    tone: "success",
    text: "legacy.the_password_has_been_reset_and_the_original_login_session_has_been_revo.47450a2e"
  },
  duplicate: {
    tone: "warning",
    text: "legacy.there_is_already_an_administrator_account_for_this_email_address.a9c96ccc"
  },
  "last-owner": {
    tone: "danger",
    text: "legacy.the_last_valid_owner_of_an_interview_group_cannot_be_deactivated.b04563aa"
  },
  "last-super-admin": {
    tone: "danger",
    text: "legacy.the_last_active_super_administrator_cannot_be_deactivated_or_demoted.c8331c16"
  },
  invalid: {
    tone: "warning",
    text: "legacy.administrator_information_is_incomplete_or_incorrectly_formatted.a3691de9"
  },
  "invalid-password": {
    tone: "warning",
    text: "legacy.the_new_password_needs_to_be_at_least_12_characters.254f2660"
  }
};
export default async function AdminsPage({ searchParams }: AdminsPageProps) {
  const { t } = await getServerTranslator();
  const [actor, query] = await Promise.all([requireAdmin(), searchParams]);
  requireSuperAdmin(actor);
  const admins = await prisma.admin.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { groupMemberships: true, sessions: true } }
    }
  });
  const notice = query.admin ? statusMessage[query.admin] : null;
  return (
    <AdminShell admin={actor} active="admins">
      <PageHeader
        title={t("legacy.administrators_and_global_roles.7384d374")}
        description={t(
          "legacy.create_administrators_adjust_global_roles_and_status_or_securely_reset_p.ed3ba574"
        )}
      />
      {notice ? (
        <InlineNotice tone={notice.tone} className="mb-5">
          {t(notice.text)}
        </InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {admins.map((admin) => (
            <Card key={admin.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{admin.displayName}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{admin.email}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("admin.accountActivitySummary", {
                      groupRoleCount: admin._count.groupMemberships,
                      sessionCount: admin._count.sessions
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">
                  {t(adminStatusLabel[admin.status])}
                </span>
              </div>
              <form
                action={updateAdminAction}
                className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <input type="hidden" name="adminId" value={admin.id} />
                <Select
                  name="role"
                  defaultValue={admin.role}
                  aria-label={t("legacy.value0_global_role.973b4958", { value0: admin.email })}
                >
                  <option value={AdminRole.ADMIN}>
                    {t("legacy.group_level_administrator.bd7363ad")}
                  </option>
                  <option value={AdminRole.SUPER_ADMIN}>
                    {t("legacy.super_administrator.56db2484")}
                  </option>
                </Select>
                <Select
                  name="status"
                  defaultValue={admin.status}
                  aria-label={t("legacy.value0_account_status.ced458c7", { value0: admin.email })}
                >
                  <option value={AdminStatus.ACTIVE}>{t("legacy.enable.f4f0ead1")}</option>
                  <option value={AdminStatus.DISABLED}>{t("legacy.deactivate.4e6fd0e2")}</option>
                </Select>
                <SubmitButton variant="secondary">{t("legacy.save.a3030bf8")}</SubmitButton>
              </form>
              <details className="mt-4 rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {t("legacy.reset_password_and_revoke_session.5dd3fef9")}
                </summary>
                <ConfirmForm
                  action={resetAdminPasswordAction}
                  confirmMessage={t(
                    "legacy.confirm_to_reset_value0_s_password_and_revoke_all_login_sessions.445b84b5",
                    { value0: admin.email }
                  )}
                  className="mt-3 flex flex-col gap-3 sm:flex-row"
                >
                  <input type="hidden" name="adminId" value={admin.id} />
                  <Input
                    name="password"
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    placeholder={t("legacy.at_least_12_characters.50a65a87")}
                    required
                  />
                  <Button type="submit" variant="danger">
                    {t("legacy.reset_password.d70928de")}
                  </Button>
                </ConfirmForm>
              </details>
            </Card>
          ))}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-semibold">{t("legacy.create_administrator.09728129")}</h2>
          <form action={createAdminAction} className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="displayName">{t("legacy.name.50b5b1d2")}</Label>
              <Input id="displayName" name="displayName" required />
            </div>
            <div>
              <Label htmlFor="email">{t("legacy.email.73075237")}</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">{t("legacy.initial_password.df387080")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="role">{t("legacy.global_role.8d504358")}</Label>
              <Select id="role" name="role" defaultValue={AdminRole.ADMIN}>
                <option value={AdminRole.ADMIN}>
                  {t("legacy.group_level_administrator.bd7363ad")}
                </option>
                <option value={AdminRole.SUPER_ADMIN}>
                  {t("legacy.super_administrator.56db2484")}
                </option>
              </Select>
            </div>
            <SubmitButton className="w-full">
              {t("legacy.create_administrator.09728129")}
            </SubmitButton>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
