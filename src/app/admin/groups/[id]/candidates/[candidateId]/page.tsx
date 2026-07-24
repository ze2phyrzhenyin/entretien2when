import Link from "next/link";
import { AppointmentStatus, InterviewerStatus } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import { AppointmentEmailFields } from "@/components/admin/appointment-email-fields";
import { AppointmentInterviewerPicker } from "@/components/admin/appointment-interviewer-picker";
import { AppointmentSlotPicker } from "@/components/admin/appointment-slot-picker";
import { CandidateAdminNoteEditor } from "@/components/admin/candidate-admin-note-editor";
import { CandidateEmailBatchSummary } from "@/components/admin/candidate-email-batch-summary";
import { CandidateEmailComposer } from "@/components/admin/candidate-email-composer";
import { CandidateEmailHistory } from "@/components/admin/candidate-email-history";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildAppointmentEmailContext } from "@/lib/mail/appointment-email-context";
import { appointmentConfirmedEmailTemplate } from "@/lib/mail/email-templates";
import { getCandidateEmailTemplates } from "@/lib/mail/email-template-store";
import {
  getGroupCapabilities,
  groupCandidateCareRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { candidateSubmissionStatusLabel, candidateSubmissionTypeLabel } from "@/lib/status-labels";
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
  scheduleAppointmentAction
} from "@/server/actions/appointment";
import { upsertCandidateAdminNoteAction } from "@/server/actions/admin-note";

type CandidateDetailPageProps = {
  params: Promise<{ id: string; candidateId: string }>;
  searchParams: Promise<{
    review?: string;
    mail?: string;
    mailCount?: string;
    mailFailed?: string;
    mailDryRun?: string;
    mailBatch?: string;
    appointment?: string;
  }>;
};

export default async function CandidateDetailPage({
  params,
  searchParams
}: CandidateDetailPageProps) {
  const [{ id: groupId, candidateId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupCandidateCareRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      timezone: true,
      projectId: true
    }
  });
  const projectInterviewers =
    capabilities.canSchedule && group.projectId
      ? await prisma.interviewer.findMany({
          where: {
            projectId: group.projectId,
            status: InterviewerStatus.ACTIVE
          },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: {
            id: true,
            name: true,
            email: true
          }
        })
      : [];
  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { id: candidateId, groupId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      activeSubmission: {
        select: {
          candidateNote: true,
          slots: {
            select: {
              slot: {
                select: {
                  id: true,
                  startAt: true,
                  endAt: true,
                  status: true,
                  activeLock: {
                    select: { id: true }
                  }
                }
              }
            }
          }
        }
      },
      submissions: {
        orderBy: { versionNo: "desc" },
        select: {
          id: true,
          versionNo: true,
          status: true,
          submissionType: true,
          slots: {
            select: {
              slot: {
                select: {
                  id: true,
                  startAt: true,
                  endAt: true
                }
              }
            }
          }
        }
      },
      adminNotes: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          body: true,
          authorAdminId: true,
          authorAdmin: {
            select: { displayName: true }
          }
        }
      }
    }
  });
  const schedulingData = capabilities.canSchedule
    ? await prisma.candidate.findFirstOrThrow({
        where: { id: candidateId, groupId },
        select: {
          appointments: {
            where: { status: AppointmentStatus.SCHEDULED },
            orderBy: { startAt: "desc" },
            take: 1,
            select: {
              id: true,
              startAt: true,
              endAt: true,
              meetingLocation: true,
              candidateVisibleMessage: true,
              internalNote: true,
              slots: {
                select: { slotId: true }
              },
              interviewers: {
                include: {
                  interviewer: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          },
          emailDeliveries: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              subject: true,
              ccEmailSnapshots: true,
              status: true,
              idempotencyKey: true,
              providerMessageId: true,
              errorMessage: true,
              createdAt: true,
              retriedFromId: true,
              sentByAdmin: {
                select: { displayName: true, email: true }
              }
            }
          }
        }
      })
    : null;
  const batchDeliveries =
    capabilities.canSchedule && query.mailBatch
      ? await prisma.candidateEmailDelivery.findMany({
          where: {
            groupId,
            candidateId,
            batchId: query.mailBatch
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            candidateNameSnapshot: true,
            recipientEmailSnapshot: true,
            ccEmailSnapshots: true,
            subject: true,
            status: true,
            errorMessage: true
          }
        })
      : [];
  const emailTemplates = capabilities.canSchedule ? await getCandidateEmailTemplates() : [];
  const appointmentEmailTemplate =
    emailTemplates.find((template) => template.key === appointmentConfirmedEmailTemplate.key) ??
    appointmentConfirmedEmailTemplate;
  const scheduledAppointment = schedulingData?.appointments[0] ?? null;
  const scheduledAppointmentEmailContext = buildAppointmentEmailContext(
    scheduledAppointment,
    group.timezone
  );
  const scheduledAppointmentSlotIds = new Set(
    scheduledAppointment?.slots.map((slot) => slot.slotId) ?? []
  );
  const scheduledAppointmentInterviewerIds =
    scheduledAppointment?.interviewers.map((assignment) => assignment.interviewerId) ?? [];
  const groupTimeSlots = scheduledAppointment
    ? await prisma.groupTimeSlot.findMany({
        where: { groupId },
        orderBy: { startAt: "asc" },
        include: {
          activeLock: {
            select: { id: true, appointmentId: true }
          }
        }
      })
    : [];
  const schedulableSlots =
    candidate.activeSubmission?.slots.filter(
      ({ slot }) => slot.status === "OPEN" && !slot.activeLock
    ) ?? [];
  const ownNote = candidate.adminNotes.find((note) => note.authorAdminId === admin.id);
  const returnTo = `/admin/groups/${groupId}/candidates/${candidateId}`;
  const mailCount = Number(query.mailCount ?? 0);
  const mailFailed = Number(query.mailFailed ?? 0);

  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="candidates" capabilities={capabilities} />
      <PageHeader
        title={candidate.name}
        description={candidate.email}
        action={
          <Link
            className="text-sm font-medium text-primary"
            href={`/admin/groups/${groupId}/candidates`}
          >
            返回候选人列表
          </Link>
        }
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      {query.review ? (
        <InlineNotice tone="success" className="mb-5">
          审核操作已完成。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "scheduled" ? (
        <InlineNotice tone="success" className="mb-5">
          面试安排已确认。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "rescheduled" ? (
        <InlineNotice tone="success" className="mb-5">
          面试安排已调整。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请选择候选人当前有效可用时间中的连续开放时间后再确认安排。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "conflict" ? (
        <InlineNotice tone="warning" className="mb-5">
          所选面试官在该时间已有面试安排，请调整时间或更换面试官。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "sent" ? (
        <InlineNotice tone="success" className="mb-5">
          已发送 {mailCount} 封候选人通知{query.mailDryRun ? "（测试发送预览）" : ""}。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "partial" ? (
        <InlineNotice tone="warning" className="mb-5">
          已发送 {mailCount} 封，失败 {mailFailed} 封。请检查 Mailato 配置或发送记录。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "error" ? (
        <InlineNotice tone="danger" className="mb-5">
          通知发送失败。请检查服务器 Mailato 配置和发送记录。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请填写邮件主题和正文，并确认后再发送。
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule ? (
        <CandidateEmailBatchSummary deliveries={batchDeliveries} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">当前有效可用时间</h3>
              <StatusBadge kind="candidate" status={candidate.status} />
            </div>
            {candidate.activeSubmission ? (
              <>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {candidate.activeSubmission.slots.map(({ slot }) => (
                    <div
                      key={slot.id}
                      className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm"
                    >
                      <p className="font-medium">
                        <ZonedDateTimeRange
                          startAt={slot.startAt.toISOString()}
                          endAt={slot.endAt.toISOString()}
                          defaultTimezone={group.timezone}
                        />
                      </p>
                      {slot.activeLock ? (
                        <p className="mt-1 text-xs text-amber-700">已锁定</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <p className="text-sm font-medium">候选人备注</p>
                  <p className="mt-2 rounded-md border border-border bg-white p-3 text-sm leading-6 text-muted-foreground">
                    {candidate.activeSubmission.candidateNote || "未填写"}
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">暂无有效提交。</p>
            )}
          </Card>

          {capabilities.canSchedule ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold">安排面试</h3>
              {scheduledAppointment ? (
                <div className="mt-4 space-y-5">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    已安排：
                    <ZonedDateTimeRange
                      startAt={scheduledAppointment.startAt.toISOString()}
                      endAt={scheduledAppointment.endAt.toISOString()}
                      defaultTimezone={group.timezone}
                    />
                    <p className="mt-2 text-xs">
                      面试官：
                      {scheduledAppointment.interviewers.length > 0
                        ? scheduledAppointment.interviewers
                            .map((assignment) => assignment.interviewer.name)
                            .join("、")
                        : "未指定"}
                    </p>
                  </div>
                  <details className="group rounded-lg border border-border bg-surface-subtle">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-fast hover:bg-muted [&::-webkit-details-marker]:hidden">
                      <span>调整面试时间</span>
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="group-open:hidden">展开调整</span>
                        <span className="hidden group-open:inline">收起</span>
                        <ChevronDown
                          className="h-4 w-4 transition-transform duration-fast group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </span>
                    </summary>
                    <form
                      action={rescheduleAppointmentAction.bind(
                        null,
                        groupId,
                        candidateId,
                        scheduledAppointment.id
                      )}
                      className="space-y-4 border-t border-border p-4"
                    >
                      <div>
                        <AppointmentSlotPicker
                          defaultTimezone={group.timezone}
                          initiallySelectedSlotIds={[...scheduledAppointmentSlotIds]}
                          slots={groupTimeSlots.map((slot) => {
                            const isCurrentAppointmentSlot = scheduledAppointmentSlotIds.has(
                              slot.id
                            );
                            const lockedByOther = Boolean(
                              slot.activeLock &&
                              slot.activeLock.appointmentId !== scheduledAppointment.id
                            );

                            return {
                              id: slot.id,
                              startAt: slot.startAt.toISOString(),
                              endAt: slot.endAt.toISOString(),
                              status: slot.status,
                              isCurrent: isCurrentAppointmentSlot,
                              lockedByOther
                            };
                          })}
                        />
                      </div>
                      <AppointmentInterviewerPicker
                        projectId={group.projectId}
                        interviewers={projectInterviewers}
                        defaultSelectedInterviewerIds={scheduledAppointmentInterviewerIds}
                      />
                      <FormField id="rescheduleMeetingLocation" label="会议地点或链接">
                        <Input
                          id="rescheduleMeetingLocation"
                          name="meetingLocation"
                          defaultValue={scheduledAppointment.meetingLocation ?? ""}
                          placeholder="会议室 / 腾讯会议链接"
                        />
                      </FormField>
                      <FormField id="rescheduleCandidateVisibleMessage" label="给候选人的说明">
                        <Textarea
                          id="rescheduleCandidateVisibleMessage"
                          name="candidateVisibleMessage"
                          defaultValue={scheduledAppointment.candidateVisibleMessage ?? ""}
                        />
                      </FormField>
                      <FormField id="rescheduleInternalNote" label="内部备注（仅管理员可见）">
                        <Textarea
                          id="rescheduleInternalNote"
                          name="internalNote"
                          defaultValue={scheduledAppointment.internalNote ?? ""}
                        />
                      </FormField>
                      <AppointmentEmailFields
                        checkboxLabel="保存后发送标准面试安排通知"
                        template={appointmentEmailTemplate}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <SubmitButton pendingText="正在保存">保存调整并锁定时间</SubmitButton>
                      </div>
                    </form>
                  </details>
                  <ConfirmForm
                    action={cancelAppointmentAction.bind(null, groupId, scheduledAppointment.id)}
                    confirmMessage="确认取消这场面试并释放对应时间吗？候选人安排会立即失效。"
                  >
                    <SubmitButton variant="danger" pendingText="正在删除">
                      取消安排并释放时间
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              ) : schedulableSlots.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  当前没有可用于安排面试且未锁定的时间。
                </p>
              ) : (
                <form
                  action={scheduleAppointmentAction.bind(null, groupId, candidateId)}
                  className="mt-4 space-y-4"
                >
                  <AppointmentSlotPicker
                    defaultTimezone={group.timezone}
                    slots={schedulableSlots.map(({ slot }) => ({
                      id: slot.id,
                      startAt: slot.startAt.toISOString(),
                      endAt: slot.endAt.toISOString(),
                      status: slot.status
                    }))}
                  />
                  <AppointmentInterviewerPicker
                    projectId={group.projectId}
                    interviewers={projectInterviewers}
                  />
                  <FormField id="meetingLocation" label="会议地点或链接">
                    <Input
                      id="meetingLocation"
                      name="meetingLocation"
                      placeholder="会议室 / 腾讯会议链接"
                    />
                  </FormField>
                  <FormField id="candidateVisibleMessage" label="给候选人的说明">
                    <Textarea id="candidateVisibleMessage" name="candidateVisibleMessage" />
                  </FormField>
                  <FormField id="internalNote" label="内部备注（仅管理员可见）">
                    <Textarea id="internalNote" name="internalNote" />
                  </FormField>
                  <AppointmentEmailFields
                    checkboxLabel="确认安排后发送标准面试安排通知"
                    template={appointmentEmailTemplate}
                  />
                  <SubmitButton>确认安排并锁定时间</SubmitButton>
                </form>
              )}
            </Card>
          ) : null}

          <Card className="p-6">
            <h3 className="text-lg font-semibold">提交历史</h3>
            <div className="mt-4 space-y-3">
              {candidate.submissions.map((submission) => (
                <div key={submission.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">版本 {submission.versionNo}</span>
                    <Badge tone={submission.status === "ACTIVE" ? "success" : "neutral"}>
                      {candidateSubmissionStatusLabel[submission.status]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {candidateSubmissionTypeLabel[submission.submissionType]}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {submission.slots.map(({ slot }) => (
                      <span key={slot.id} className="rounded-md bg-slate-50 px-2 py-1">
                        <ZonedDateTimeRange
                          startAt={slot.startAt.toISOString()}
                          endAt={slot.endAt.toISOString()}
                          defaultTimezone={group.timezone}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <CandidateAdminNoteEditor
            defaultValue={ownNote?.body}
            action={upsertCandidateAdminNoteAction.bind(null, groupId, candidateId)}
            notes={candidate.adminNotes.map((note) => ({
              id: note.id,
              body: note.body,
              authorName: note.authorAdmin.displayName
            }))}
          />
          {capabilities.canSchedule ? (
            <>
              <CandidateEmailComposer
                groupId={groupId}
                groupName={group.name}
                returnTo={returnTo}
                templates={emailTemplates}
                mode="single"
                candidates={[
                  {
                    id: candidate.id,
                    name: candidate.name,
                    email: candidate.email,
                    status: candidate.status,
                    appointmentTime: scheduledAppointmentEmailContext.appointmentTime,
                    meetingLocation: scheduledAppointmentEmailContext.meetingLocation,
                    candidateMessage: scheduledAppointmentEmailContext.candidateMessage
                  }
                ]}
              />
              <CandidateEmailHistory
                groupId={groupId}
                returnTo={returnTo}
                defaultTimezone={group.timezone}
                historyLimit={10}
                deliveries={(schedulingData?.emailDeliveries ?? []).map((delivery) => ({
                  id: delivery.id,
                  subject: delivery.subject,
                  ccEmailSnapshots: delivery.ccEmailSnapshots,
                  status: delivery.status,
                  idempotencyKey: delivery.idempotencyKey,
                  providerMessageId: delivery.providerMessageId,
                  errorMessage: delivery.errorMessage,
                  createdAt: delivery.createdAt,
                  sentByAdminName: delivery.sentByAdmin.displayName,
                  sentByAdminEmail: delivery.sentByAdmin.email,
                  retriedFromId: delivery.retriedFromId
                }))}
              />
            </>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
