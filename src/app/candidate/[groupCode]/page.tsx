import Link from "next/link";
import { CalendarCheck, Clock, ShieldCheck } from "lucide-react";
import { AppointmentStatus, CandidateSubmissionStatus, GroupTimeSlotStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTimeRange, formatTime } from "@/lib/date/timezone";
import { normalizeGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";
import { AvailabilityForm } from "./availability-form";

type CandidateGroupPageProps = {
  params: Promise<{ groupCode: string }>;
  searchParams: Promise<{
    name?: string;
    email?: string;
    mode?: string;
    submitted?: string;
    pending?: string;
    error?: string;
  }>;
};

function buildCandidateSlotOptions(
  slots: Array<{
    id: string;
    startAt: Date;
    endAt: Date;
    status: GroupTimeSlotStatus;
    activeLock: { id: string } | null;
  }>,
  timezone: string,
  selectedSlotIds = new Set<string>()
) {
  return slots.map((slot) => ({
    id: slot.id,
    dateLabel: formatDate(slot.startAt, timezone),
    timeLabel: `${formatTime(slot.startAt, timezone)}-${formatTime(slot.endAt, timezone)}`,
    disabled: slot.status !== GroupTimeSlotStatus.OPEN || Boolean(slot.activeLock),
    initiallySelected: selectedSlotIds.has(slot.id)
  }));
}

export default async function CandidateGroupPage({
  params,
  searchParams
}: CandidateGroupPageProps) {
  const [{ groupCode }, query] = await Promise.all([params, searchParams]);
  const normalizedGroupCode = normalizeGroupCode(groupCode);
  const name = query.name?.trim() ?? "";
  const email = query.email?.trim().toLowerCase() ?? "";
  const isModifyMode = query.mode === "modify";

  const group = await prisma.interviewGroup.findUnique({
    where: { groupCode: normalizedGroupCode },
    include: {
      timeSlots: {
        orderBy: { startAt: "asc" },
        include: {
          activeLock: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!group) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">面试组不存在</h1>
          <p className="mt-2 text-sm text-muted-foreground">请检查招聘方提供的面试组编号。</p>
          <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
            返回填写入口
          </Link>
        </Card>
      </main>
    );
  }

  if (!name || !email) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">请先填写身份信息</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            需要姓名、邮箱和面试组编号才能进入候选人页面。
          </p>
          <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
            返回填写入口
          </Link>
        </Card>
      </main>
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: {
      groupId_normalizedEmail: {
        groupId: group.id,
        normalizedEmail: email
      }
    },
    include: {
      activeSubmission: {
        include: {
          slots: {
            include: { slot: true },
            orderBy: { createdAt: "asc" }
          }
        }
      },
      submissions: {
        where: { status: CandidateSubmissionStatus.PENDING_REVIEW },
        include: {
          slots: {
            include: { slot: true }
          }
        },
        take: 1
      },
      appointments: {
        where: { status: AppointmentStatus.SCHEDULED },
        orderBy: { startAt: "asc" },
        take: 1
      }
    }
  });

  const activeSlotIds = new Set(
    candidate?.activeSubmission?.slots.map((item) => item.slotId) ?? []
  );
  const slotOptions = buildCandidateSlotOptions(group.timeSlots, group.timezone, activeSlotIds);
  const pendingSubmission = candidate?.submissions[0] ?? null;
  const appointment = candidate?.appointments[0] ?? null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            你的信息不会展示给其他候选人
          </div>
          <h1 className="text-3xl font-semibold">{group.name}</h1>
          {group.publicDescription ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {group.publicDescription}
            </p>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit p-5">
            <p className="text-sm text-muted-foreground">候选人</p>
            <p className="mt-1 font-semibold">{name}</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">{email}</p>
            <div className="mt-4 space-y-2">
              <Badge tone={candidate?.activeSubmission ? "success" : "warning"}>
                {candidate?.activeSubmission ? "已提交" : "未提交"}
              </Badge>
              {pendingSubmission ? <Badge tone="warning">修改审核中</Badge> : null}
            </div>
          </Card>

          <div className="space-y-6">
            {query.submitted ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                可用时间已提交。
              </div>
            ) : null}
            {query.pending ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                修改申请已提交，待管理员审核。审核通过前仍以原提交为准。
              </div>
            ) : null}

            {appointment ? (
              <Card className="p-6">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">面试已安排</h2>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">面试时间</dt>
                    <dd className="mt-1 font-medium">
                      {formatDateTimeRange(appointment.startAt, appointment.endAt, group.timezone)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">会议地点或链接</dt>
                    <dd className="mt-1 break-all font-medium">
                      {appointment.meetingLocation ?? "待通知"}
                    </dd>
                  </div>
                </dl>
                {appointment.candidateVisibleMessage ? (
                  <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6">
                    {appointment.candidateVisibleMessage}
                  </p>
                ) : null}
              </Card>
            ) : null}

            {candidate?.activeSubmission && !isModifyMode ? (
              <Card className="p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                      <h2 className="text-lg font-semibold">当前有效可用时间</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      如需修改，需要提交申请并等待管理员审核。
                    </p>
                  </div>
                  <Link
                    href={`/candidate/${group.groupCode}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&mode=modify`}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium hover:bg-slate-50"
                  >
                    申请修改
                  </Link>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {candidate.activeSubmission.slots.map(({ slot }) => (
                    <div
                      key={slot.id}
                      className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm"
                    >
                      {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <p className="text-sm font-medium">候选人备注</p>
                  <p className="mt-2 rounded-md border border-border bg-white p-3 text-sm leading-6 text-muted-foreground">
                    {candidate.activeSubmission.candidateNote || "未填写"}
                  </p>
                </div>
                {pendingSubmission ? (
                  <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    修改审核中。审核通过前仍以当前有效版本为准。
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card className="p-6">
                <h2 className="text-lg font-semibold">
                  {isModifyMode ? "申请修改可用时间" : "选择你的可用时间"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  不可选时间不会展示真实原因。请选择你确认可以参加面试的时间。
                </p>
                {candidate?.activeSubmission && isModifyMode ? (
                  <div className="mt-4 rounded-md border border-border bg-slate-50 p-4">
                    <p className="text-sm font-medium">当前有效版本</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {candidate.activeSubmission.slots.map(({ slot }) => (
                        <div key={slot.id} className="rounded-md bg-white px-3 py-2 text-sm">
                          {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-5">
                  <AvailabilityForm
                    mode={candidate?.activeSubmission ? "modify" : "initial"}
                    groupCode={group.groupCode}
                    name={name}
                    email={email}
                    minSelectSlots={group.minSelectSlots}
                    maxSelectSlots={group.maxSelectSlots}
                    slots={slotOptions}
                    defaultNote={candidate?.activeSubmission?.candidateNote}
                  />
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
