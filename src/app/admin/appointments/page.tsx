import Link from "next/link";
import { CalendarClock, Search } from "lucide-react";
import { AppointmentStatus, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/pagination-nav";
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
import { accessibleGroupWhere, groupSchedulingRoles, isSuperAdmin } from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
import { appointmentStatusLabel } from "@/lib/status-labels";
import { cancelAppointmentAction } from "@/server/actions/appointment";

type AdminAppointmentsPageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};

const appointmentsPageSize = 50;

function parseAppointmentStatus(value: string | undefined) {
  if (value && Object.values(AppointmentStatus).includes(value as AppointmentStatus)) {
    return value as AppointmentStatus;
  }

  return undefined;
}

export default async function AdminAppointmentsPage({ searchParams }: AdminAppointmentsPageProps) {
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const superAdmin = isSuperAdmin(admin);
  const q = query.q?.trim() ?? "";
  const status = parseAppointmentStatus(query.status);

  const searchWhere: Prisma.AppointmentWhereInput = q
    ? {
        OR: [
          { candidate: { name: { contains: q, mode: "insensitive" } } },
          { candidate: { email: { contains: q, mode: "insensitive" } } },
          { group: { name: { contains: q, mode: "insensitive" } } },
          { group: { groupCode: { contains: q, mode: "insensitive" } } },
          {
            interviewers: { some: { interviewer: { name: { contains: q, mode: "insensitive" } } } }
          },
          {
            interviewers: { some: { interviewer: { email: { contains: q, mode: "insensitive" } } } }
          }
        ]
      }
    : {};

  const appointmentFilters: Prisma.AppointmentWhereInput[] = [
    // Appointment details contain candidate and interviewer PII. They are a
    // scheduling surface, not merely a group-read surface, so REVIEWER and
    // VIEWER memberships must not expose them through the global route.
    { group: accessibleGroupWhere(admin, groupSchedulingRoles) },
    searchWhere
  ];
  if (status) {
    appointmentFilters.push({ status });
  }

  const appointmentWhere: Prisma.AppointmentWhereInput = { AND: appointmentFilters };
  const [totalAppointmentCount, scheduledAppointmentCount] = await Promise.all([
    prisma.appointment.count({ where: appointmentWhere }),
    prisma.appointment.count({
      where: {
        AND: [...appointmentFilters, { status: AppointmentStatus.SCHEDULED }]
      }
    })
  ]);
  const pagination = createPagination({
    page: query.page,
    pageSize: appointmentsPageSize,
    totalCount: totalAppointmentCount
  });

  const appointments = await prisma.appointment.findMany({
    where: appointmentWhere,
    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }, { id: "asc" }],
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
      },
      interviewers: {
        include: {
          interviewer: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    skip: pagination.skip,
    take: pagination.pageSize
  });

  return (
    <AdminShell admin={admin} active="appointments">
      <PageHeader
        title="面试安排"
        description={
          superAdmin
            ? "集中查看全部面试组的已确认面试安排。"
            : "集中查看你获授权面试组的已确认面试安排。"
        }
        action={
          <Badge tone={scheduledAppointmentCount > 0 ? "scheduled" : "neutral"}>
            {scheduledAppointmentCount} 个已安排
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
        <div className="space-y-4">
          <TableContainer>
            <Table className="min-w-[1120px]">
              <TableHeader>
                <tr>
                  <TableHead>面试组</TableHead>
                  <TableHead>候选人</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>面试官</TableHead>
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
                      {appointment.interviewers.length > 0 ? (
                        <div className="space-y-1">
                          {appointment.interviewers.map((assignment) => (
                            <div key={assignment.interviewerId}>
                              <p className="font-medium">{assignment.interviewer.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {assignment.interviewer.email}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
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
                        <ConfirmForm
                          action={cancelAppointmentAction.bind(
                            null,
                            appointment.group.id,
                            appointment.id
                          )}
                          confirmMessage="确认取消这场面试并释放对应时间吗？候选人安排会立即失效。"
                        >
                          <Button type="submit" variant="danger" size="sm">
                            取消
                          </Button>
                        </ConfirmForm>
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
          <PaginationNav
            pathname="/admin/appointments"
            searchParams={{ q: q || undefined, status: status ?? undefined }}
            itemLabel="个面试安排"
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
