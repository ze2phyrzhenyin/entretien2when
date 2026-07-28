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

type GroupMembersPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ membership?: string }>;
};

const membershipMessage: Record<string, { tone: "success" | "warning" | "danger"; text: string }> =
  {
    saved: { tone: "success", text: "成员角色已保存并写入审计日志。" },
    revoked: { tone: "success", text: "成员权限已撤销并写入审计日志。" },
    "last-owner": { tone: "danger", text: "不能撤销或降级最后一个有效 OWNER。" },
    invalid: { tone: "warning", text: "成员或角色信息不正确。" }
  };

export default async function GroupMembersPage({ params, searchParams }: GroupMembersPageProps) {
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
        title={`${group.name} · 成员与角色`}
        description="OWNER 管理组设置与成员；SCHEDULER 管理排期；REVIEWER 审核；VIEWER 只读。"
      />
      {notice ? (
        <InlineNotice tone={notice.tone} className="mb-5">
          {notice.text}
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
                  {membership.admin.status}
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
                    aria-label={`${membership.admin.email} 面试组角色`}
                  >
                    {Object.values(AdminGroupRole).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="secondary">保存</SubmitButton>
                </form>
                <ConfirmForm
                  action={revokeGroupMembershipAction.bind(null, groupId)}
                  confirmMessage={`确认撤销 ${membership.admin.email} 在本组的全部权限？`}
                >
                  <input type="hidden" name="adminId" value={membership.adminId} />
                  <Button type="submit" variant="danger">
                    撤权
                  </Button>
                </ConfirmForm>
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-semibold">添加现有管理员</h2>
          {availableAdmins.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">所有有效管理员都已加入本组。</p>
          ) : (
            <form
              action={upsertGroupMembershipAction.bind(null, groupId)}
              className="mt-4 grid gap-4"
            >
              <div>
                <Label htmlFor="adminId">管理员</Label>
                <Select id="adminId" name="adminId" required>
                  {availableAdmins.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} · {item.email}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="memberRole">组角色</Label>
                <Select id="memberRole" name="role" defaultValue={AdminGroupRole.VIEWER}>
                  {Object.values(AdminGroupRole).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </div>
              <SubmitButton className="w-full">添加成员</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
