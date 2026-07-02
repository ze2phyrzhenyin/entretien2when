import Link from "next/link";
import { AdminRole } from "@prisma/client";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";
import { grantGroupAdminAction, revokeGroupAdminAction } from "@/server/actions/group";

type GroupAdminsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

const grantOptions = [
  ["canViewCandidates", "查看候选人"],
  ["canEditGroup", "编辑组"],
  ["canReviewModifications", "审核修改"],
  ["canScheduleInterview", "安排面试"]
] as const;

const errorMessage: Record<string, string> = {
  "admin-not-found": "未找到该管理员邮箱。",
  "super-admin-no-grant-needed": "超级管理员默认拥有全部权限，不需要单独授权。"
};

export default async function GroupAdminsPage({ params, searchParams }: GroupAdminsPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId, "canEditGroup");

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      groupAdmins: {
        include: {
          admin: {
            select: { email: true, displayName: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="admins" />
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {group.name} · 管理员授权
            <StatusBadge kind="group" status={group.status} />
          </span>
        }
        description="给普通管理员授予该面试组的查看、编辑、审核和安排面试权限。"
        action={
          <Link
            className="text-sm font-medium text-primary"
            href={`/admin/groups/${groupId}/settings`}
          >
            返回设置
          </Link>
        }
      />

      {query.error ? (
        <InlineNotice tone="danger" className="mb-5">
          {errorMessage[query.error] ?? "该授权操作无法完成。"}
        </InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <Card className="p-6">
          <SectionHeader
            title="新增或更新授权"
            description="输入已存在的普通管理员邮箱；重复保存会更新该管理员的权限。"
          />
          <form action={grantGroupAdminAction.bind(null, groupId)} className="mt-4 space-y-4">
            <FormField id="adminEmail" label="管理员邮箱">
              <Input
                id="adminEmail"
                name="adminEmail"
                type="email"
                placeholder="admin@example.com"
              />
            </FormField>
            <div className="space-y-2 text-sm">
              {grantOptions.map(([name, label]) => (
                <label key={name} className="flex items-center gap-2">
                  <Checkbox name={name} defaultChecked={name === "canViewCandidates"} />
                  {label}
                </label>
              ))}
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              保存授权
            </Button>
          </form>
          {admin.role === AdminRole.SUPER_ADMIN ? null : (
            <p className="mt-4 text-xs text-muted-foreground">
              普通管理员只能管理自己已拥有编辑权限的面试组授权。
            </p>
          )}
        </Card>

        <Card className="p-6">
          <SectionHeader
            title="当前普通管理员"
            description="普通管理员只会看到被授权的面试组和对应操作。"
          />
          <div className="mt-5 space-y-3">
            {group.groupAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无普通管理员授权。</p>
            ) : (
              group.groupAdmins.map((grant) => (
                <div key={grant.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{grant.admin.displayName}</p>
                      <p className="break-all text-muted-foreground">{grant.admin.email}</p>
                    </div>
                    <form action={revokeGroupAdminAction.bind(null, groupId, grant.id)}>
                      <Button type="submit" variant="ghost" className="h-8 px-2 text-red-700">
                        移除
                      </Button>
                    </form>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {grantOptions.map(([key, label]) =>
                      grant[key] ? (
                        <Badge key={key} tone="primary">
                          {label}
                        </Badge>
                      ) : null
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
