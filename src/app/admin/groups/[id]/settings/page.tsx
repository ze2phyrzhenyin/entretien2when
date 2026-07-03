import Link from "next/link";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { requireAdmin } from "@/lib/auth/session";
import { timezoneOptionsWith } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup } from "@/lib/permissions/admin";
import { GroupSettingsForm } from "./group-settings-form";

type SettingsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function GroupSettingsPage({ params, searchParams }: SettingsPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId }
  });
  const candidateLink = `${process.env.APP_URL ?? "http://localhost:3000"}/candidate/${group.groupCode}`;

  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="settings" />
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {group.name}
            <StatusBadge kind="group" status={group.status} />
          </span>
        }
        description="配置公开说明、时间规则和候选人入口。"
        action={
          <Link className="text-sm font-medium text-primary" href="/admin">
            返回工作台
          </Link>
        }
      />

      {query.created ? (
        <InlineNotice tone="success" className="mb-5">
          面试组已创建。请复制面试组编号或候选人链接发送给候选人。
        </InlineNotice>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <SectionHeader
            title="面试组信息"
            description="候选人可看到面试组名称和公开说明，不会看到内部设置。"
          />
          <GroupSettingsForm
            groupId={groupId}
            group={{
              name: group.name,
              publicDescription: group.publicDescription ?? "",
              timezone: group.timezone,
              status: group.status,
              slotDurationMinutes: group.slotDurationMinutes,
              interviewDurationMinutes: group.interviewDurationMinutes,
              minSelectSlots: group.minSelectSlots,
              maxSelectSlots: group.maxSelectSlots
            }}
            timezoneOptions={timezoneOptionsWith(group.timezone)}
          />
        </Card>

        <Card className="p-5">
          <SectionHeader
            title="候选人入口"
            description="候选人打开链接后提交姓名、邮箱和可用时间，不会看到管理员设置。"
          />
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">面试组编号</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold">{group.groupCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">候选人链接</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold">{candidateLink}</p>
            </div>
            <CopyButton value={group.groupCode} label="复制面试组编号" />
            <CopyButton value={candidateLink} label="复制候选人链接" />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
