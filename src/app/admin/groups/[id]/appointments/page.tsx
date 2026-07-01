import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";
import { cancelAppointmentAction } from "@/server/actions/appointment";

type AppointmentsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AppointmentsPage({ params }: AppointmentsPageProps) {
  const { id: groupId } = await params;
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId, "canScheduleInterview");

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true, timezone: true }
  });
  const appointments = await prisma.appointment.findMany({
    where: { groupId },
    orderBy: { startAt: "desc" },
    include: {
      candidate: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="appointments" />
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{group.name} · 预约</h2>
        <p className="mt-1 text-sm text-muted-foreground">取消预约会自动释放对应时间锁。</p>
      </div>

      {appointments.length === 0 ? (
        <EmptyState title="暂无预约" description="在候选人详情页选择候选人可用时间并安排面试。" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">候选人</th>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">地点/链接</th>
                <th className="px-4 py-3">候选人说明</th>
                <th className="px-4 py-3">内部备注</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${groupId}/candidates/${appointment.candidate.id}`}
                    >
                      {appointment.candidate.name}
                    </Link>
                    <p className="text-muted-foreground">{appointment.candidate.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {formatDateTimeRange(appointment.startAt, appointment.endAt, group.timezone)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        appointment.status === AppointmentStatus.SCHEDULED ? "success" : "neutral"
                      }
                    >
                      {appointment.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{appointment.meetingLocation ?? "-"}</td>
                  <td className="px-4 py-3">{appointment.candidateVisibleMessage ?? "-"}</td>
                  <td className="px-4 py-3">{appointment.internalNote ?? "-"}</td>
                  <td className="px-4 py-3">
                    {appointment.status === AppointmentStatus.SCHEDULED ? (
                      <form action={cancelAppointmentAction.bind(null, groupId, appointment.id)}>
                        <Button type="submit" variant="danger" className="h-8 px-3">
                          取消
                        </Button>
                      </form>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
