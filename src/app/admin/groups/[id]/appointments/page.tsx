import Link from "next/link";
import { AppointmentPreview } from "@/components/admin/appointment-preview";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
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
    orderBy: { startAt: "asc" },
    include: {
      candidate: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="appointments" />
      <PageHeader
        title={`${group.name} · 预约`}
        description="预览谁预约了什么时间。取消预约会自动释放对应时间锁。"
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      <section className="mb-6">
        <SectionHeader
          title="预约预览"
          description="按日期展示当前已预约面试，便于快速确认候选人和时间。"
        />
        <AppointmentPreview
          groupId={groupId}
          appointments={appointments.map((appointment) => ({
            id: appointment.id,
            candidateId: appointment.candidate.id,
            candidateName: appointment.candidate.name,
            candidateEmail: appointment.candidate.email,
            startAt: appointment.startAt.toISOString(),
            endAt: appointment.endAt.toISOString(),
            status: appointment.status,
            meetingLocation: appointment.meetingLocation
          }))}
          defaultTimezone={group.timezone}
        />
      </section>

      {appointments.length > 0 ? (
        <section>
          <SectionHeader title="预约明细" description="包含已取消和已完成记录。" />
          <TableContainer>
            <Table className="min-w-[1000px]">
              <TableHeader>
                <tr>
                  <TableHead>候选人</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>地点/链接</TableHead>
                  <TableHead>候选人说明</TableHead>
                  <TableHead>内部备注</TableHead>
                  <TableHead>操作</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${groupId}/candidates/${appointment.candidate.id}`}
                      >
                        {appointment.candidate.name}
                      </Link>
                      <p className="text-muted-foreground">{appointment.candidate.email}</p>
                    </TableCell>
                    <TableCell>
                      <ZonedDateTimeRange
                        startAt={appointment.startAt.toISOString()}
                        endAt={appointment.endAt.toISOString()}
                        defaultTimezone={group.timezone}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="appointment" status={appointment.status} />
                    </TableCell>
                    <TableCell>{appointment.meetingLocation ?? "-"}</TableCell>
                    <TableCell>{appointment.candidateVisibleMessage ?? "-"}</TableCell>
                    <TableCell>{appointment.internalNote ?? "-"}</TableCell>
                    <TableCell>
                      {appointment.status === "SCHEDULED" ? (
                        <form action={cancelAppointmentAction.bind(null, groupId, appointment.id)}>
                          <Button type="submit" variant="danger" size="sm">
                            取消
                          </Button>
                        </form>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </section>
      ) : null}
    </AdminShell>
  );
}
