import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/date/timezone";
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
  await requireGroupPermission(admin, groupId, "canViewCandidates");

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

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="overview" />
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">时间总览</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          管理员端显示可用候选人人数、关闭和锁定原因。候选人端不会看到这些信息。
        </p>
      </div>

      {group.timeSlots.length === 0 ? (
        <EmptyState title="还没有时间段" description="先到时间段页面批量生成开放时间。" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {group.timeSlots.map((slot) => (
            <div key={slot.id} className="rounded-lg border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                </p>
                {slot.activeLock ? (
                  <Badge tone="warning">已锁定</Badge>
                ) : slot.status === "CLOSED" ? (
                  <Badge>关闭</Badge>
                ) : (
                  <Badge tone="success">开放</Badge>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                可用候选人：{slot.submissionSlots.length} 人
              </p>
              {slot.activeLock ? (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  {slot.activeLock.reasonInternal ?? "已锁定"}
                </p>
              ) : null}
              {slot.submissionSlots.length > 0 ? (
                <div className="mt-3 space-y-1 text-sm">
                  {slot.submissionSlots.slice(0, 4).map(({ candidate }) => (
                    <p key={candidate.id} className="truncate text-muted-foreground">
                      {candidate.name} · {candidate.email}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
