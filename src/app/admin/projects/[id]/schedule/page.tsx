import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { AppointmentStatus, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  accessibleGroupWhere,
  accessibleProjectWhere,
  requireProjectPermission
} from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
import { appointmentStatusLabel } from "@/lib/status-labels";
type ProjectSchedulePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    groupId?: string;
    roundId?: string;
    interviewerId?: string;
    status?: string;
    page?: string;
  }>;
};
const pageSize = 50;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
function resolveWindow(from?: string, to?: string) {
  const now = new Date();
  const defaultStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 7);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setUTCDate(defaultEnd.getUTCDate() + 37);
  const startAt = from && datePattern.test(from) ? new Date(`${from}T00:00:00.000Z`) : defaultStart;
  const inclusiveEnd = to && datePattern.test(to) ? new Date(`${to}T00:00:00.000Z`) : defaultEnd;
  const invalid =
    !Number.isFinite(startAt.getTime()) ||
    !Number.isFinite(inclusiveEnd.getTime()) ||
    inclusiveEnd < startAt ||
    inclusiveEnd.getTime() - startAt.getTime() > 90 * 24 * 60 * 60 * 1000;
  const safeStart = invalid ? defaultStart : startAt;
  const safeInclusiveEnd = invalid ? defaultEnd : inclusiveEnd;
  const endAt = new Date(safeInclusiveEnd);
  endAt.setUTCDate(endAt.getUTCDate() + 1);
  return {
    startAt: safeStart,
    endAt,
    from: dateOnly(safeStart),
    to: dateOnly(safeInclusiveEnd),
    adjusted: invalid
  };
}
export default async function ProjectSchedulePage({
  params,
  searchParams
}: ProjectSchedulePageProps) {
  const { t } = await getServerTranslator();
  const [{ id: projectId }, query, admin] = await Promise.all([
    params,
    searchParams,
    requireAdmin()
  ]);
  await requireProjectPermission(admin, projectId);
  const groupAccessWhere = accessibleGroupWhere(admin);
  const groupWhere: Prisma.InterviewGroupWhereInput = {
    AND: [{ projectId }, groupAccessWhere]
  };
  const [project, groups] = await Promise.all([
    prisma.interviewProject.findFirstOrThrow({
      where: { AND: [{ id: projectId }, accessibleProjectWhere(admin)] },
      select: { id: true, name: true }
    }),
    prisma.interviewGroup.findMany({
      where: groupWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true, roundId: true, timezone: true }
    })
  ]);
  const groupIds = new Set(groups.map((group) => group.id));
  const accessibleRoundIds = [
    ...new Set(groups.flatMap((group) => (group.roundId ? [group.roundId] : [])))
  ];
  const [rounds, interviewers] = await Promise.all([
    prisma.interviewRound.findMany({
      where: { projectId, id: { in: accessibleRoundIds } },
      orderBy: { orderIndex: "asc" },
      select: { id: true, name: true, orderIndex: true }
    }),
    prisma.interviewer.findMany({
      where: {
        projectId,
        appointmentLinks: {
          some: {
            appointment: {
              group: groupWhere
            }
          }
        }
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true }
    })
  ]);
  const window = resolveWindow(query.from, query.to);
  const groupId = query.groupId && groupIds.has(query.groupId) ? query.groupId : undefined;
  const roundId =
    query.roundId && accessibleRoundIds.includes(query.roundId) ? query.roundId : undefined;
  const interviewerId = interviewers.some((item) => item.id === query.interviewerId)
    ? query.interviewerId
    : undefined;
  const status =
    query.status && query.status in AppointmentStatus
      ? (query.status as AppointmentStatus)
      : undefined;
  const appointmentWhere: Prisma.AppointmentWhereInput = {
    group: groupWhere,
    startAt: { gte: window.startAt, lt: window.endAt },
    ...(groupId ? { groupId } : {}),
    ...(roundId ? { roundId } : {}),
    ...(status ? { status } : {}),
    ...(interviewerId ? { interviewers: { some: { interviewerId } } } : {})
  };
  const totalCount = await prisma.appointment.count({ where: appointmentWhere });
  const pagination = createPagination({
    page: query.page,
    pageSize,
    totalCount
  });
  const appointments = await prisma.appointment.findMany({
    where: appointmentWhere,
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      meetingLocation: true,
      candidate: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true, timezone: true } },
      round: { select: { id: true, name: true, orderIndex: true } },
      interviewers: {
        select: {
          interviewer: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });
  const filterSearchParams = {
    from: window.from,
    to: window.to,
    groupId,
    roundId,
    interviewerId,
    status
  };
  return (
    <AdminShell admin={admin} active="projects">
      <PageHeader
        title={t("legacy.value0_project_scheduling.7f23c270", { value0: project.name })}
        description={t(
          "legacy.filter_by_date_interview_group_round_interviewer_and_status_maximum_valu.e53184f3",
          { value0: pageSize }
        )}
        action={
          <Link className="text-sm font-medium text-primary" href={`/admin/projects/${projectId}`}>
            {t("legacy.return_items.514a2a27")}
          </Link>
        }
      />
      {window.adjusted ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t(
            "legacy.date_range_is_invalid_or_older_than_90_days_default_window_has_been_rest.2e2c4d4f"
          )}
        </p>
      ) : null}
      <Card className="mb-5 p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Input
            name="from"
            type="date"
            defaultValue={window.from}
            aria-label={t("legacy.start_date.76050649")}
          />
          <Input
            name="to"
            type="date"
            defaultValue={window.to}
            aria-label={t("legacy.end_date.895cd52f")}
          />
          <Select
            name="groupId"
            defaultValue={groupId ?? ""}
            aria-label={t("legacy.interview_groups.e677802f")}
          >
            <option value="">{t("legacy.all_interview_groups.f0e3213c")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Select
            name="roundId"
            defaultValue={roundId ?? ""}
            aria-label={t("legacy.round.4890584b")}
          >
            <option value="">{t("legacy.all_rounds.ee302df5")}</option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.orderIndex}. {round.name}
              </option>
            ))}
          </Select>
          <Select
            name="interviewerId"
            defaultValue={interviewerId ?? ""}
            aria-label={t("legacy.interviewers.5e6ecb10")}
          >
            <option value="">{t("legacy.all_interviewers.086459bf")}</option>
            {interviewers.map((interviewer) => (
              <option key={interviewer.id} value={interviewer.id}>
                {interviewer.name}
              </option>
            ))}
          </Select>
          <Select
            name="status"
            defaultValue={status ?? ""}
            aria-label={t("legacy.appointment_status.26643ff0")}
          >
            <option value="">{t("legacy.all_status.0a379c1e")}</option>
            {Object.values(AppointmentStatus).map((item) => (
              <option key={item} value={item}>
                {t(appointmentStatusLabel[item])}
              </option>
            ))}
          </Select>
          <Button type="submit">{t("legacy.filter.b5f15473")}</Button>
        </form>
      </Card>

      <div className="space-y-3 md:hidden">
        {appointments.map((appointment) => (
          <Card key={appointment.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{appointment.candidate.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{appointment.group.name}</p>
              </div>
              <StatusBadge kind="appointment" status={appointment.status} />
            </div>
            <p className="mt-3 text-sm">
              <ZonedDateTimeRange
                startAt={appointment.startAt.toISOString()}
                endAt={appointment.endAt.toISOString()}
                defaultTimezone={appointment.group.timezone}
              />
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {appointment.round
                ? appointment.interviewers.length > 0
                  ? t("schedule.assignmentSummary", {
                      roundName: appointment.round.name,
                      interviewerNames: appointment.interviewers
                        .map(({ interviewer }) => interviewer.name)
                        .join(", ")
                    })
                  : t("schedule.assignmentSummaryNoInterviewer", {
                      roundName: appointment.round.name
                    })
                : appointment.interviewers.length > 0
                  ? t("schedule.assignmentSummaryNoRound", {
                      interviewerNames: appointment.interviewers
                        .map(({ interviewer }) => interviewer.name)
                        .join(", ")
                    })
                  : t("schedule.assignmentSummaryNoRoundOrInterviewer")}
            </p>
            <Link
              className="mt-3 inline-flex text-sm font-medium text-primary"
              href={`/admin/groups/${appointment.group.id}/candidates/${appointment.candidate.id}`}
            >
              {t("legacy.view_candidates.8c06d66f")}
            </Link>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>{t("legacy.time.8b6ff498")}</TableHead>
                <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                <TableHead>{t("legacy.interview_group_round.5f351a68")}</TableHead>
                <TableHead>{t("legacy.interviewers.5e6ecb10")}</TableHead>
                <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
                <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    <ZonedDateTimeRange
                      startAt={appointment.startAt.toISOString()}
                      endAt={appointment.endAt.toISOString()}
                      defaultTimezone={appointment.group.timezone}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{appointment.candidate.name}</p>
                    <p className="text-xs text-muted-foreground">{appointment.candidate.email}</p>
                  </TableCell>
                  <TableCell>
                    <p>{appointment.group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {appointment.round?.name ?? t("legacy.unassociated_rounds.f21aa45d")}
                    </p>
                  </TableCell>
                  <TableCell>
                    {appointment.interviewers
                      .map(({ interviewer }) => interviewer.name)
                      .join(", ") || t("legacy.not_specified.7409a608")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="appointment" status={appointment.status} />
                  </TableCell>
                  <TableCell>
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${appointment.group.id}/candidates/${appointment.candidate.id}`}
                    >
                      {t("legacy.check.db8db053")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
      <div className="mt-5">
        <PaginationNav
          pathname={`/admin/projects/${projectId}/schedule`}
          searchParams={filterSearchParams}
          itemLabel={t("pagination.appointment.other")}
          itemLabelOne={t("pagination.appointment.one")}
          {...pagination}
        />
      </div>
    </AdminShell>
  );
}
