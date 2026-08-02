import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { AppointmentPreview } from "@/components/admin/appointment-preview";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PaginationNav } from "@/components/ui/pagination-nav";
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
  getGroupCapabilities,
  groupSchedulingRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { cancelAppointmentAction } from "@/server/actions/appointment";
import { createPagination } from "@/lib/pagination";
type AppointmentsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};
const appointmentsPageSize = 50;
export default async function AppointmentsPage({ params, searchParams }: AppointmentsPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true, timezone: true }
  });
  const totalAppointmentCount = await prisma.appointment.count({ where: { groupId } });
  const pagination = createPagination({
    page: query.page,
    pageSize: appointmentsPageSize,
    totalCount: totalAppointmentCount
  });
  const appointments = await prisma.appointment.findMany({
    where: { groupId },
    orderBy: { startAt: "asc" },
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      candidate: {
        select: { id: true, name: true, email: true }
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
    }
  });
  const candidateSelections = await prisma.candidate.findMany({
    where: {
      groupId,
      activeSubmission: { is: { status: "ACTIVE" } }
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      activeSubmission: {
        select: {
          status: true,
          slots: {
            select: {
              slot: {
                select: {
                  id: true,
                  startAt: true,
                  endAt: true,
                  status: true
                }
              }
            }
          }
        }
      }
    }
  });
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="appointments" capabilities={capabilities} />
      <PageHeader
        title={t("legacy.value0_interview_arrangement.10c9aae4", { value0: group.name })}
        description={t(
          "legacy.displays_up_to_value0_placements_per_page_with_preview_loading_up_to_100.abf842e0",
          { value0: appointmentsPageSize }
        )}
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      <section className="mb-6">
        <SectionHeader
          title={t("legacy.schedule_a_preview.e4e58260")}
          description={t(
            "legacy.also_displays_available_times_for_scheduled_interviews_and_candidate_sub.31236c1e"
          )}
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
          candidateSelections={candidateSelections.flatMap((candidate) => {
            if (!candidate.activeSubmission || candidate.activeSubmission.slots.length === 0) {
              return [];
            }
            return [
              {
                candidateId: candidate.id,
                candidateName: candidate.name,
                candidateEmail: candidate.email,
                candidateStatus: candidate.status,
                submissionStatus: candidate.activeSubmission.status,
                slots: candidate.activeSubmission.slots
                  .map(({ slot }) => ({
                    id: slot.id,
                    startAt: slot.startAt.toISOString(),
                    endAt: slot.endAt.toISOString(),
                    status: slot.status
                  }))
                  .sort((slotA, slotB) => slotA.startAt.localeCompare(slotB.startAt))
              }
            ];
          })}
          defaultTimezone={group.timezone}
        />
      </section>

      {appointments.length > 0 ? (
        <section>
          <SectionHeader
            title={t("legacy.arrangement_details.6e7c18cb")}
            description={t("legacy.contains_canceled_and_completed_records.b81af528")}
          />
          <TableContainer>
            <Table className="min-w-[1000px]">
              <TableHeader>
                <tr>
                  <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                  <TableHead>{t("legacy.time.8b6ff498")}</TableHead>
                  <TableHead>{t("legacy.interviewers.5e6ecb10")}</TableHead>
                  <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
                  <TableHead>{t("legacy.location_link.80508f83")}</TableHead>
                  <TableHead>{t("legacy.instructions_to_candidates.3768407d")}</TableHead>
                  <TableHead>
                    {t("legacy.internal_notes_visible_only_to_administrators.00bef15d")}
                  </TableHead>
                  <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
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
                    <TableCell>{appointment.meetingLocation ?? "-"}</TableCell>
                    <TableCell>{appointment.candidateVisibleMessage ?? "-"}</TableCell>
                    <TableCell>{appointment.internalNote ?? "-"}</TableCell>
                    <TableCell>
                      {appointment.status === "SCHEDULED" ? (
                        <ConfirmForm
                          action={cancelAppointmentAction.bind(null, groupId, appointment.id)}
                          confirmMessage={t(
                            "legacy.are_you_sure_to_cancel_this_interview_and_release_the_corresponding_time.cc501a5f"
                          )}
                        >
                          <Button type="submit" variant="danger" size="sm">
                            {t("legacy.cancel.2cd0f3be")}
                          </Button>
                        </ConfirmForm>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <div className="mt-4">
            <PaginationNav
              pathname={`/admin/groups/${groupId}/appointments`}
              searchParams={{}}
              itemLabel={t("pagination.appointment.other")}
              itemLabelOne={t("pagination.appointment.one")}
              {...pagination}
            />
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
