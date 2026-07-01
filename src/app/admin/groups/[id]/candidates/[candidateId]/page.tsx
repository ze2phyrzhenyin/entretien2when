import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";
import {
  candidateStatusLabel,
  candidateSubmissionStatusLabel,
  candidateSubmissionTypeLabel
} from "@/lib/status-labels";
import { scheduleAppointmentAction } from "@/server/actions/appointment";
import { upsertCandidateAdminNoteAction } from "@/server/actions/admin-note";

type CandidateDetailPageProps = {
  params: Promise<{ id: string; candidateId: string }>;
  searchParams: Promise<{ review?: string }>;
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
      }
    }
  });
  const scheduledAppointment = candidate.appointments.find(
    (appointment) => appointment.status === AppointmentStatus.SCHEDULED
  );
  const schedulableSlots =
    candidate.activeSubmission?.slots.filter(
      ({ slot }) => slot.status === "OPEN" && !slot.activeLock
    ) ?? [];
  const ownNote = candidate.adminNotes.find((note) => note.authorAdminId === admin.id);

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="candidates" />
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">{candidate.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{candidate.email}</p>
        </div>
        <Link
          className="text-sm font-medium text-primary"
          href={`/admin/groups/${groupId}/candidates`}
        >
          返回候选人列表
        </Link>
      </div>

      {query.review ? (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          审核操作已完成。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">当前有效可用时间</h3>
              <Badge tone={candidate.status === "SCHEDULED" ? "success" : "neutral"}>
                {candidateStatusLabel[candidate.status]}
              </Badge>
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
                      <input name="slotIds" type="checkbox" value={slot.id} />
                      {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                    </label>
                  ))}
                </div>
                <div>
                  <Label htmlFor="meetingLocation">会议地点或链接</Label>
                  <Input
                    id="meetingLocation"
                    name="meetingLocation"
                    placeholder="会议室 / 腾讯会议链接"
                  />
                </div>
                <div>
                  <Label htmlFor="candidateVisibleMessage">候选人可见说明</Label>
                  <Textarea id="candidateVisibleMessage" name="candidateVisibleMessage" />
                </div>
                <div>
                  <Label htmlFor="internalNote">内部备注</Label>
                  <Textarea id="internalNote" name="internalNote" />
                </div>
                <Button type="submit">安排并锁定时间</Button>
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
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">管理员私有备注</h3>
              <Badge tone="warning">仅管理员可见</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              该备注只在管理员后台可见，候选人页面和候选人 API 永远不会返回。
            </p>
            <form
              action={upsertCandidateAdminNoteAction.bind(null, groupId, candidateId)}
              className="mt-4 space-y-3"
            >
              <Textarea
                name="body"
                defaultValue={ownNote?.body ?? ""}
                placeholder="填写内部跟进信息"
              />
              <Button type="submit" variant="secondary" className="w-full">
                保存私有备注
              </Button>
            </form>
            <div className="mt-5 space-y-3">
              {candidate.adminNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无私有备注。</p>
              ) : (
                candidate.adminNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-md border border-border bg-slate-50 p-3 text-sm"
                  >
                    <p className="whitespace-pre-wrap leading-6">{note.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {note.authorAdmin.displayName} · {note.authorAdmin.email}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
