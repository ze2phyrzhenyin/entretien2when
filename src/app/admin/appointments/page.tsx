import { getServerTranslator } from "@/i18n/server";
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
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};
const appointmentsPageSize = 50;
function parseAppointmentStatus(value: string | undefined) {
  if (value && Object.values(AppointmentStatus).includes(value as AppointmentStatus)) {
    return value as AppointmentStatus;
  }
  return undefined;
}
export default async function AdminAppointmentsPage({ searchParams }: AdminAppointmentsPageProps) {
  const { t } = await getServerTranslator();
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
        title={t("legacy.interviews.2e9d0020")}
        description={
          superAdmin
            ? t(
                "legacy.view_confirmed_interview_schedules_for_all_interview_groups_in_one_place.3a36afbe"
              )
            : t(
                "legacy.view_confirmed_interview_schedules_from_your_authorized_interview_group_.2da6a612"
              )
        }
        action={
          <Badge tone={scheduledAppointmentCount > 0 ? "scheduled" : "neutral"}>
            {t("appointment.scheduledCount", { count: scheduledAppointmentCount })}
          </Badge>
        }
      />

      <form className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="appointmentSearch">
            {t("legacy.search_interview_schedule.b435263f")}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="appointmentSearch"
            name="q"
            defaultValue={q}
            placeholder={t(
              "legacy.search_candidates_email_addresses_interview_groups_or_numbers.2c8fec3f"
            )}
            className="pl-9"
          />
        </div>
        <Select
          name="status"
          defaultValue={status ?? ""}
          aria-label={t("legacy.interview_scheduling_status.a770c145")}
        >
          <option value="">{t("legacy.all_status.0a379c1e")}</option>
          {Object.values(AppointmentStatus).map((item) => (
            <option key={item} value={item}>
              {t(appointmentStatusLabel[item])}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" className="h-11">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("legacy.search.44ce7ae9")}
        </Button>
        {q || status ? (
          <Link
            href="/admin/appointments"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            {t("legacy.clear.bce23772")}
          </Link>
        ) : null}
      </form>

      {appointments.length === 0 ? (
        <EmptyState
          title={
            q || status
              ? t("legacy.no_matching_interview_schedule.089a76fc")
              : t("legacy.no_interview_arrangements_yet.c9494939")
          }
          description={
            q || status
              ? t(
                  "legacy.change_a_keyword_or_status_or_clear_the_filter_to_view_all_interview_sch.c0779e97"
                )
              : t(
                  "legacy.after_confirming_the_interview_schedule_on_the_candidate_details_page_th.c475cf72"
                )
          }
          icon={<CalendarClock className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table className="min-w-[1120px]">
              <TableHeader>
                <tr>
                  <TableHead>{t("legacy.interview_groups.e677802f")}</TableHead>
                  <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                  <TableHead>{t("legacy.time.8b6ff498")}</TableHead>
                  <TableHead>{t("legacy.interviewers.5e6ecb10")}</TableHead>
                  <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
                  <TableHead>{t("legacy.location_link.80508f83")}</TableHead>
                  <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
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
                          confirmMessage={t(
                            "legacy.are_you_sure_to_cancel_this_interview_and_release_the_corresponding_time.cc501a5f"
                          )}
                        >
                          <Button type="submit" variant="danger" size="sm">
                            {t("legacy.cancel.2cd0f3be")}
                          </Button>
                        </ConfirmForm>
                      ) : (
                        <Link
                          className="font-medium text-primary"
                          href={`/admin/groups/${appointment.group.id}/appointments`}
                        >
                          {t("legacy.check.db8db053")}
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
            itemLabel={t("pagination.appointment.other")}
            itemLabelOne={t("pagination.appointment.one")}
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
