import Link from "next/link";
import { AdminRole } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup } from "@/lib/permissions/admin";
import { interviewGroupStatusLabel } from "@/lib/status-labels";
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
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold">{group.name}</h2>
            <Badge tone={group.status === "OPEN" ? "success" : "neutral"}>
              {interviewGroupStatusLabel[group.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">设置公开说明、规则和普通管理员授权。</p>
        </div>
        <Link className="text-sm font-medium text-primary" href="/admin">
          返回工作台
        </Link>
      </div>

      {query.created ? (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          面试组已创建。请复制组编号或候选人链接发送给候选人。
        </div>
      ) : null}
      {query.error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
          {query.error === "admin-not-found" ? "未找到该管理员邮箱。" : "该授权操作无法完成。"}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <form action={updateGroupAction.bind(null, groupId)} className="grid gap-5">
            <div>
              <Label htmlFor="name">组名称</Label>
              <Input id="name" name="name" defaultValue={group.name} required />
            </div>
            <div>
              <Label htmlFor="publicDescription">公开说明</Label>
              <Textarea
                id="publicDescription"
                name="publicDescription"
                defaultValue={group.publicDescription ?? ""}
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="timezone">时区</Label>
                <Input id="timezone" name="timezone" defaultValue={group.timezone} required />
              </div>
              <div>
                <Label htmlFor="status">状态</Label>
                <Select id="status" name="status" defaultValue={group.status}>
                  <option value="DRAFT">草稿</option>
                  <option value="OPEN">开放</option>
                  <option value="CLOSED">关闭</option>
                  <option value="ARCHIVED">归档</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="slotDurationMinutes">时间粒度（分钟）</Label>
                <Input
                  id="slotDurationMinutes"
                  name="slotDurationMinutes"
                  type="number"
                  defaultValue={group.slotDurationMinutes}
                />
              </div>
              <div>
                <Label htmlFor="interviewDurationMinutes">面试时长（分钟）</Label>
                <Input
                  id="interviewDurationMinutes"
                  name="interviewDurationMinutes"
                  type="number"
                  defaultValue={group.interviewDurationMinutes}
                />
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="minSelectSlots">候选人最少选择</Label>
                <Input
                  id="minSelectSlots"
                  name="minSelectSlots"
                  type="number"
                  defaultValue={group.minSelectSlots}
                />
              </div>
              <div>
                <Label htmlFor="maxSelectSlots">候选人最多选择</Label>
                <Input
                  id="maxSelectSlots"
                  name="maxSelectSlots"
                  type="number"
                  defaultValue={group.maxSelectSlots}
                />
              </div>
            </div>
            <Button type="submit" className="w-full md:w-auto">
              保存设置
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold">候选人入口</h3>
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
            <h3 className="font-semibold">普通管理员授权</h3>
            <form action={grantGroupAdminAction.bind(null, groupId)} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="adminEmail">管理员邮箱</Label>
                <Input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  placeholder="admin@example.com"
                />
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ["canViewCandidates", "查看候选人"],
                  ["canEditGroup", "编辑组"],
                  ["canReviewModifications", "审核修改"],
                  ["canScheduleInterview", "安排面试"]
                ].map(([name, label]) => (
                  <label key={name} className="flex items-center gap-2">
                    <input
                      name={name}
                      type="checkbox"
                      defaultChecked={name === "canViewCandidates"}
                    />
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
