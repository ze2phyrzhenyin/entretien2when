import Link from "next/link";
import { CalendarClock, Search } from "lucide-react";
import { AppointmentStatus, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { appointmentStatusLabel } from "@/lib/status-labels";
import { cancelAppointmentAction } from "@/server/actions/appointment";

type AdminAppointmentsPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

function parseAppointmentStatus(value: string | undefined) {
  if (value && Object.values(AppointmentStatus).includes(value as AppointmentStatus)) {
    return value as AppointmentStatus;
  }

  return undefined;
}

export default async function AdminAppointmentsPage({ searchParams }: AdminAppointmentsPageProps) {
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const q = query.q?.trim() ?? "";
  const status = parseAppointmentStatus(query.status);

  const searchWhere: Prisma.AppointmentWhereInput = q
    ? {
        OR: [
          { candidate: { name: { contains: q, mode: "insensitive" } } },
          { candidate: { email: { contains: q, mode: "insensitive" } } },
          { group: { name: { contains: q, mode: "insensitive" } } },
          { group: { groupCode: { contains: q, mode: "insensitive" } } }
        ]
      }
    : {};

  const appointments = await prisma.appointment.findMany({
    where: {
      ...searchWhere,
      ...(status ? { status } : {})
    },
    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    include: {
      group: {
        select: {
          id: true,
          name: true,
          groupCode: true,
          timezone: true
        }
      },
      candidate: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    take: 100
  });
  const scheduledCount = appointments.filter(
    (appointment) => appointment.status === AppointmentStatus.SCHEDULED
  ).length;

  return (
    <AdminShell admin={admin} active="appointments">
      <PageHeader
        title="面试安排"
        description="集中查看全部面试组的已确认面试安排。"
        action={
          <Badge tone={scheduledCount > 0 ? "scheduled" : "neutral"}>
            {scheduledCount} 个已安排
          </Badge>
        }
      />

      <form className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="appointmentSearch">
            搜索面试安排
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="appointmentSearch"
            name="q"
            defaultValue={q}
            placeholder="搜索候选人、邮箱、面试组或编号"
            className="pl-9"
          />
        </div>
        <Select name="status" defaultValue={status ?? ""} aria-label="面试安排状态">
          <option value="">全部状态</option>
          {Object.values(AppointmentStatus).map((item) => (
            <option key={item} value={item}>
              {appointmentStatusLabel[item]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" className="h-11">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          搜索
        </Button>
        {q || status ? (
          <Link
            href="/admin/appointments"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            清除
          </Link>
        ) : null}
      </form>

      {appointments.length === 0 ? (
        <EmptyState
          title={q || status ? "没有匹配的面试安排" : "暂无面试安排"}
          description={
            q || status
              ? "换一个关键词或状态，或清除筛选后查看全部面试安排。"
              : "在候选人详情页确认面试安排后，记录会集中显示在这里。"
          }
          icon={<CalendarClock className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <TableContainer>
          <Table className="min-w-[1120px]">
            <TableHeader>
              <tr>
                <TableHead>面试组</TableHead>
                <TableHead>候选人</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>地点/链接</TableHead>
                <TableHead>操作</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${appointment.group.id}/appointments`}
                    >
                      {appointment.group.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {appointment.group.groupCode}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${appointment.group.id}/candidates/${appointment.candidate.id}`}
                    >
                      {appointment.candidate.name}
                    </Link>
                    <p className="text-muted-foreground">{appointment.candidate.email}</p>
                  </TableCell>
                  <TableCell>
                    <ZonedDateTimeRange
                      startAt={appointment.startAt.toISOString()}
                      endAt={appointment.endAt.toISOString()}
                      defaultTimezone={appointment.group.timezone}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="appointment" status={appointment.status} />
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <span className="line-clamp-2 text-muted-foreground">
                      {appointment.meetingLocation ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {appointment.status === AppointmentStatus.SCHEDULED ? (
                      <form
                        action={cancelAppointmentAction.bind(
                          null,
                          appointment.group.id,
                          appointment.id
                        )}
                      >
                        <Button type="submit" variant="danger" size="sm">
                          取消
                        </Button>
                      </form>
                    ) : (
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${appointment.group.id}/appointments`}
                      >
                        查看
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AdminShell>
  );
}
