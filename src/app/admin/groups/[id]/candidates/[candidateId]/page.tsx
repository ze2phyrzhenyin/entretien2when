import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";
import { CandidateAdminNoteEditor } from "@/components/admin/candidate-admin-note-editor";
import { CandidateEmailBatchSummary } from "@/components/admin/candidate-email-batch-summary";
import { CandidateEmailComposer } from "@/components/admin/candidate-email-composer";
import { CandidateEmailHistory } from "@/components/admin/candidate-email-history";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";
import { candidateSubmissionStatusLabel, candidateSubmissionTypeLabel } from "@/lib/status-labels";
import { scheduleAppointmentAction } from "@/server/actions/appointment";
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
  }>;
};

export default async function CandidateDetailPage({
  params,
  searchParams
}: CandidateDetailPageProps) {
  const [{ id: groupId, candidateId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId, "canViewCandidates");

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId }
  });
  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { id: candidateId, groupId },
    include: {
      activeSubmission: {
        include: {
          slots: {
            include: {
              slot: {
                include: {
                  activeLock: true
                }
              }
            }
          }
        }
      },
      submissions: {
        orderBy: { versionNo: "desc" },
        include: {
          slots: {
            include: { slot: true }
          }
        }
      },
      appointments: {
        orderBy: { startAt: "desc" }
      },
      adminNotes: {
        orderBy: { updatedAt: "desc" },
        include: {
          authorAdmin: {
            select: { displayName: true, email: true }
          }
        }
      },
      emailDeliveries: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          sentByAdmin: {
            select: { displayName: true, email: true }
          }
        }
      }
    }
  });
  const batchDeliveries = query.mailBatch
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
          subject: true,
          status: true,
          errorMessage: true
        }
      })
    : [];
  const scheduledAppointment = candidate.appointments.find(
    (appointment) => appointment.status === AppointmentStatus.SCHEDULED
  );
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
      <GroupAdminNav groupId={groupId} active="candidates" />
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

      {query.review ? (
        <InlineNotice tone="success" className="mb-5">
          审核操作已完成。
        </InlineNotice>
      ) : null}
      {query.mail === "sent" ? (
        <InlineNotice tone="success" className="mb-5">
          已发送 {mailCount} 封候选人邮件{query.mailDryRun ? "（dry-run 预览）" : ""}。
        </InlineNotice>
      ) : null}
      {query.mail === "partial" ? (
        <InlineNotice tone="warning" className="mb-5">
          已发送 {mailCount} 封，失败 {mailFailed} 封。请检查 mailato 配置或发送日志。
        </InlineNotice>
      ) : null}
      {query.mail === "error" ? (
        <InlineNotice tone="danger" className="mb-5">
          邮件发送失败。请检查服务器 mailato 配置和发送日志。
        </InlineNotice>
      ) : null}
      {query.mail === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请填写邮件主题和正文，并确认后再发送。
        </InlineNotice>
      ) : null}
      <CandidateEmailBatchSummary deliveries={batchDeliveries} />

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
                        {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                      </p>
                      {slot.activeLock ? (
                        <p className="mt-1 text-xs text-amber-700">
                          锁定：{slot.activeLock.reasonInternal ?? "已锁定"}
                        </p>
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

          <Card className="p-6">
            <h3 className="text-lg font-semibold">安排面试</h3>
            {scheduledAppointment ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                已预约：
                {formatDateTimeRange(
                  scheduledAppointment.startAt,
                  scheduledAppointment.endAt,
                  group.timezone
                )}
              </div>
            ) : schedulableSlots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                当前没有可安排且未锁定的候选人可用时间。
              </p>
            ) : (
              <form
                action={scheduleAppointmentAction.bind(null, groupId, candidateId)}
                className="mt-4 space-y-4"
              >
                <div className="grid gap-2 md:grid-cols-2">
                  {schedulableSlots.map(({ slot }) => (
                    <label
                      key={slot.id}
                      className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
                    >
                      <Checkbox name="slotIds" value={slot.id} />
                      {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                    </label>
                  ))}
                </div>
                <FormField id="meetingLocation" label="会议地点或链接">
                  <Input
                    id="meetingLocation"
                    name="meetingLocation"
                    placeholder="会议室 / 腾讯会议链接"
                  />
                </FormField>
                <FormField id="candidateVisibleMessage" label="候选人可见说明">
                  <Textarea id="candidateVisibleMessage" name="candidateVisibleMessage" />
                </FormField>
                <FormField id="internalNote" label="内部备注">
                  <Textarea id="internalNote" name="internalNote" />
                </FormField>
                <SubmitButton>安排并锁定时间</SubmitButton>
              </form>
            )}
          </Card>

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
                        {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
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
              authorName: note.authorAdmin.displayName,
              authorEmail: note.authorAdmin.email
            }))}
          />
          <CandidateEmailComposer
            groupId={groupId}
            groupName={group.name}
            returnTo={returnTo}
            mode="single"
            candidates={[
              {
                id: candidate.id,
                name: candidate.name,
                email: candidate.email,
                status: candidate.status
              }
            ]}
          />
          <CandidateEmailHistory
            groupId={groupId}
            returnTo={returnTo}
            deliveries={candidate.emailDeliveries.map((delivery) => ({
              id: delivery.id,
              subject: delivery.subject,
              status: delivery.status,
              providerMessageId: delivery.providerMessageId,
              errorMessage: delivery.errorMessage,
              createdAt: delivery.createdAt,
              sentByAdminName: delivery.sentByAdmin.displayName,
              sentByAdminEmail: delivery.sentByAdmin.email,
              retriedFromId: delivery.retriedFromId
            }))}
          />
        </div>
      </div>
    </AdminShell>
  );
}
