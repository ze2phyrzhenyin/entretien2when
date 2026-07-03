import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { AdminTimeGrid } from "@/components/scheduling/admin-time-grid";
import { AdminSlotLegend } from "@/components/scheduling/slot-legend";
import type { AdminSlotView } from "@/components/scheduling/types";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";

type OverviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OverviewPage({ params }: OverviewPageProps) {
  const { id: groupId } = await params;
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId);

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      timeSlots: {
        orderBy: { startAt: "asc" },
        include: {
          activeLock: true,
          submissionSlots: {
            where: {
              submission: { status: "ACTIVE" }
            },
            include: {
              candidate: {
                select: { id: true, name: true, email: true }
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
      <GroupNav groupId={groupId} active="overview" />
      <PageHeader
        title="时间总览"
        description="管理员端显示可用候选人人数、关闭和锁定原因。候选人端不会看到这些信息。"
        action={<AdminSlotLegend />}
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      {group.timeSlots.length === 0 ? (
        <EmptyState title="还没有时间段" description="先到时间段页面批量生成开放时间。" />
      ) : (
        <AdminTimeGrid slots={slotViews} defaultTimezone={group.timezone} />
      )}
    </AdminShell>
  );
}
