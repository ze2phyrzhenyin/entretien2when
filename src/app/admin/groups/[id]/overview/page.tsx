import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { AdminTimeGrid } from "@/components/scheduling/admin-time-grid";
import { AdminSlotLegend } from "@/components/scheduling/slot-legend";
import type { AdminSlotView } from "@/components/scheduling/types";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getGroupCapabilities,
  groupSchedulingRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { candidateSlotWindowDays, resolveCandidateSlotWindow } from "@/lib/date/slot-window";

type OverviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function OverviewPage({ params, searchParams }: OverviewPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);

  const groupSummary = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { timezone: true }
  });
  const slotWindow = resolveCandidateSlotWindow({
    from: query.from,
    to: query.to,
    timezone: groupSummary.timezone
  });
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      timezone: true,
      timeSlots: {
        where: {
          startAt: { gte: slotWindow.startAt, lt: slotWindow.endAt }
        },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          activeLock: {
            select: { reasonInternal: true }
          },
          submissionSlots: {
            where: {
              submission: { status: "ACTIVE" }
            },
            select: {
              candidate: {
                select: { id: true, name: true }
              }
            }
          }
        }
      }
    }
  });
  const slotViews: AdminSlotView[] = group.timeSlots.map((slot) => ({
    id: slot.id,
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
    status: slot.activeLock ? "LOCKED" : slot.status === "CLOSED" ? "CLOSED" : "OPEN",
    availableCandidateCount: slot.submissionSlots.length,
    lockReasonInternal: slot.activeLock?.reasonInternal,
    candidates: slot.submissionSlots.map(({ candidate }) => candidate)
  }));

  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="overview" capabilities={capabilities} />
      <PageHeader
        title="时间总览"
        description="显示每个开放时间的候选人数量、关闭状态和锁定原因。候选人端不会看到这些内部信息。"
        action={<AdminSlotLegend />}
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>
      <Card className="mb-5 p-4">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input name="from" type="date" defaultValue={slotWindow.from} aria-label="开始日期" />
          <Input name="to" type="date" defaultValue={slotWindow.to} aria-label="结束日期" />
          <Button type="submit" variant="secondary">
            查看
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          每次最多查看连续 {candidateSlotWindowDays} 天，避免一次加载全部历史候选人选择。
        </p>
      </Card>
      {slotWindow.wasAdjusted ? (
        <InlineNotice tone="warning" className="mb-5">
          日期范围无效或过长，已恢复默认窗口。
        </InlineNotice>
      ) : null}

      {group.timeSlots.length === 0 ? (
        <EmptyState title="暂无开放时间" description="请先到开放时间页面批量生成可选时间。" />
      ) : (
        <AdminTimeGrid slots={slotViews} defaultTimezone={group.timezone} />
      )}
    </AdminShell>
  );
}
