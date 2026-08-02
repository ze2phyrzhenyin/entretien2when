import { getServerTranslator } from "@/i18n/server";
import { AdminGroupRole, AdminStatus } from "@prisma/client";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getGroupCapabilities,
  groupOwnerRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import {
  revokeGroupMembershipAction,
  upsertGroupMembershipAction
} from "@/server/actions/admin-management";
import type { MessageKey } from "@/i18n/catalogs";
import { adminGroupRoleLabel, adminStatusLabel } from "@/lib/status-labels";
type GroupMembersPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    membership?: string;
  }>;
};
const membershipMessage: Record<
  string,
  {
    tone: "success" | "warning" | "danger";
    text: MessageKey;
  }
> = {
  saved: {
    tone: "success",
    text: "legacy.member_roles_are_saved_and_written_to_the_audit_log.1c44f73d"
  },
  revoked: {
    tone: "success",
    text: "legacy.member_privileges_are_revoked_and_written_to_the_audit_log.e71b36ae"
  },
  "last-owner": {
    tone: "danger",
    text: "legacy.the_last_valid_owner_cannot_be_revoked_or_demoted.40c77253"
  },
  invalid: {
    tone: "warning",
    text: "legacy.member_or_role_information_is_incorrect.c9c2a9f7"
  }
};
export default async function GroupMembersPage({ params, searchParams }: GroupMembersPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId }, query, admin] = await Promise.all([params, searchParams, requireAdmin()]);
  await requireGroupPermission(admin, groupId, groupOwnerRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const [group, memberships, administrators] = await Promise.all([
    prisma.interviewGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: { id: true, name: true }
    }),
    prisma.adminGroupMembership.findMany({
      where: { groupId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        admin: {
          select: { id: true, email: true, displayName: true, status: true }
        }
      }
    }),
    prisma.admin.findMany({
      where: { status: AdminStatus.ACTIVE },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, email: true, displayName: true }
    })
  ]);
  const notice = query.membership ? membershipMessage[query.membership] : null;
  const memberIds = new Set(memberships.map((membership) => membership.adminId));
  const availableAdmins = administrators.filter((item) => !memberIds.has(item.id));
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="members" capabilities={capabilities} />
      <PageHeader
        title={t("legacy.value0_members_and_roles.de61927d", { value0: group.name })}
        description={t(
          "legacy.owner_manages_group_settings_and_members_scheduler_manages_scheduling_re.03773553"
        )}
      />
      {notice ? (
        <InlineNotice tone={notice.tone} className="mb-5">
          {t(notice.text)}
        </InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {memberships.map((membership) => (
            <Card key={membership.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{membership.admin.displayName}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {membership.admin.email}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">
                  {t(adminStatusLabel[membership.admin.status])}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <form
                  action={upsertGroupMembershipAction.bind(null, groupId)}
                  className="flex gap-3"
                >
                  <input type="hidden" name="adminId" value={membership.adminId} />
                  <Select
                    name="role"
                    defaultValue={membership.role}
                    aria-label={t("legacy.value0_interview_team_role.54e52cf2", {
                      value0: membership.admin.email
                    })}
                  >
                    {Object.values(AdminGroupRole).map((role) => (
                      <option key={role} value={role}>
                        {t(adminGroupRoleLabel[role])}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="secondary">{t("legacy.save.a3030bf8")}</SubmitButton>
                </form>
                <ConfirmForm
                  action={revokeGroupMembershipAction.bind(null, groupId)}
                  confirmMessage={t(
                    "legacy.confirm_to_revoke_all_permissions_of_value0_in_this_group.793306ce",
                    { value0: membership.admin.email }
                  )}
                >
                  <input type="hidden" name="adminId" value={membership.adminId} />
                  <Button type="submit" variant="danger">
                    {t("legacy.withdraw_authority.a3697df7")}
                  </Button>
                </ConfirmForm>
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-semibold">
            {t("legacy.add_existing_administrator.aebe46da")}
          </h2>
          {availableAdmins.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("legacy.all_valid_administrators_have_joined_this_group.32353773")}
            </p>
          ) : (
            <form
              action={upsertGroupMembershipAction.bind(null, groupId)}
              className="mt-4 grid gap-4"
            >
              <div>
                <Label htmlFor="adminId">{t("legacy.administrator.e1979671")}</Label>
                <Select id="adminId" name="adminId" required>
                  {availableAdmins.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} · {item.email}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="memberRole">{t("legacy.group_role.f68e8b9b")}</Label>
                <Select id="memberRole" name="role" defaultValue={AdminGroupRole.VIEWER}>
                  {Object.values(AdminGroupRole).map((role) => (
                    <option key={role} value={role}>
                      {t(adminGroupRoleLabel[role])}
                    </option>
                  ))}
                </Select>
              </div>
              <SubmitButton className="w-full">{t("legacy.add_member.ad9737da")}</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
