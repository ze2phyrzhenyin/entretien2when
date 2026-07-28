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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

const appointmentsPageSize = 50;

export default async function AppointmentsPage({ params, searchParams }: AppointmentsPageProps) {
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
        title={`${group.name} · 面试安排`}
        description={`每页显示最多 ${appointmentsPageSize} 个安排，预览最多加载 100 位最近候选人。取消安排会释放时间锁并发送日历取消更新。`}
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      <section className="mb-6">
        <SectionHeader title="安排预览" description="同时展示已安排面试和候选人提交的可用时间。" />
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
          <SectionHeader title="安排明细" description="包含已取消和已完成记录。" />
          <TableContainer>
            <Table className="min-w-[1000px]">
              <TableHeader>
                <tr>
                  <TableHead>候选人</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>面试官</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>地点/链接</TableHead>
                  <TableHead>给候选人的说明</TableHead>
                  <TableHead>内部备注（仅管理员可见）</TableHead>
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
                          confirmMessage="确认取消这场面试并释放对应时间吗？候选人安排会立即失效。"
                        >
                          <Button type="submit" variant="danger" size="sm">
                            取消
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
              itemLabel="个面试安排"
              {...pagination}
            />
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
