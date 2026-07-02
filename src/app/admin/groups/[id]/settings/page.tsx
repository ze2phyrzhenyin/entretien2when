import Link from "next/link";
import { AdminRole } from "@prisma/client";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { timezoneOptionsWith } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup } from "@/lib/permissions/admin";
import {
  grantGroupAdminAction,
  revokeGroupAdminAction,
  updateGroupAction
} from "@/server/actions/group";

type SettingsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
};

export default async function GroupSettingsPage({ params, searchParams }: SettingsPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }

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
  const candidateLink = `${process.env.APP_URL ?? "http://localhost:3000"}/candidate/${group.groupCode}`;

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="settings" />
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {group.name}
            <StatusBadge kind="group" status={group.status} />
          </span>
        }
        description="设置公开说明、时间规则、候选人入口和普通管理员授权。"
        action={
          <Link className="text-sm font-medium text-primary" href="/admin">
            返回工作台
          </Link>
        }
      />

      {query.created ? (
        <InlineNotice tone="success" className="mb-5">
          面试组已创建。请复制组编号或候选人链接发送给候选人。
        </InlineNotice>
      ) : null}
      {query.error ? (
        <InlineNotice tone="danger" className="mb-5">
          {query.error === "admin-not-found" ? "未找到该管理员邮箱。" : "该授权操作无法完成。"}
        </InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <SectionHeader
            title="面试组信息"
            description="候选人会看到组名称和公开说明，不会看到管理员授权或内部设置。"
          />
          <form action={updateGroupAction.bind(null, groupId)} className="grid gap-5">
            <FormField id="name" label="组名称">
              <Input id="name" name="name" defaultValue={group.name} required />
            </FormField>
            <FormField id="publicDescription" label="公开说明">
              <Textarea
                id="publicDescription"
                name="publicDescription"
                defaultValue={group.publicDescription ?? ""}
              />
            </FormField>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField id="timezone" label="时区">
                <Select id="timezone" name="timezone" defaultValue={group.timezone}>
                  {timezoneOptionsWith(group.timezone).map((timezone) => (
                    <option key={timezone.value} value={timezone.value}>
                      {timezone.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="status" label="状态">
                <Select id="status" name="status" defaultValue={group.status}>
                  <option value="DRAFT">草稿</option>
                  <option value="OPEN">开放</option>
                  <option value="CLOSED">关闭</option>
                  <option value="ARCHIVED">归档</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField id="slotDurationMinutes" label="时间粒度（分钟）">
                <Input
                  id="slotDurationMinutes"
                  name="slotDurationMinutes"
                  type="number"
                  defaultValue={group.slotDurationMinutes}
                />
              </FormField>
              <FormField id="interviewDurationMinutes" label="面试时长（分钟）">
                <Input
                  id="interviewDurationMinutes"
                  name="interviewDurationMinutes"
                  type="number"
                  defaultValue={group.interviewDurationMinutes}
                />
              </FormField>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField id="minSelectSlots" label="候选人最少选择">
                <Input
                  id="minSelectSlots"
                  name="minSelectSlots"
                  type="number"
                  defaultValue={group.minSelectSlots}
                />
              </FormField>
              <FormField id="maxSelectSlots" label="候选人最多选择">
                <Input
                  id="maxSelectSlots"
                  name="maxSelectSlots"
                  type="number"
                  defaultValue={group.maxSelectSlots}
                />
              </FormField>
            </div>
            <Button type="submit" className="w-full md:w-auto">
              保存设置
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeader title="候选人入口" description="复制给候选人，不要公开到无关渠道。" />
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">组编号</p>
                <p className="mt-1 break-all font-mono text-sm font-semibold">{group.groupCode}</p>
              </div>
              <CopyButton value={group.groupCode} label="复制组编号" />
              <CopyButton value={candidateLink} label="复制候选人链接" />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader
              title="普通管理员授权"
              description="普通管理员只会看到被授权的面试组和对应操作。"
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
                {[
                  ["canViewCandidates", "查看候选人"],
                  ["canEditGroup", "编辑组"],
                  ["canReviewModifications", "审核修改"],
                  ["canScheduleInterview", "安排面试"]
                ].map(([name, label]) => (
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
            <div className="mt-5 space-y-3">
              {group.groupAdmins.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无普通管理员授权。</p>
              ) : (
                group.groupAdmins.map((grant) => (
                  <div key={grant.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium">{grant.admin.displayName}</p>
                    <p className="text-muted-foreground">{grant.admin.email}</p>
                    <form
                      action={revokeGroupAdminAction.bind(null, groupId, grant.id)}
                      className="mt-2"
                    >
                      <Button type="submit" variant="ghost" className="h-8 px-2 text-red-700">
                        移除
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </Card>
          {admin.role === AdminRole.SUPER_ADMIN ? null : (
            <p className="text-xs text-muted-foreground">普通管理员只能看到自己被授权的能力。</p>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
