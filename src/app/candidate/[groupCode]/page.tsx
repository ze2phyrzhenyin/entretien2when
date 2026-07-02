import Link from "next/link";
import { AppointmentStatus, CandidateSubmissionStatus, GroupTimeSlotStatus } from "@prisma/client";
import { CandidateAppointmentCard } from "@/components/candidate/candidate-appointment-card";
import { CandidateIdentityCard } from "@/components/candidate/candidate-identity-card";
import { CandidateSubmittedSummary } from "@/components/candidate/candidate-submitted-summary";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { ReviewNotice } from "@/components/design-system/review-notice";
import { CandidateShell } from "@/components/layout/candidate-shell";
import { TimeRangePreview } from "@/components/scheduling/time-range-preview";
import type { CandidateSlotView } from "@/components/scheduling/types";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { Card } from "@/components/ui/card";
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
  selectedSlotIds = new Set<string>()
): CandidateSlotView[] {
  return slots.map((slot) => ({
    id: slot.id,
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
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
      <CandidateShell size="narrow">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">面试组不存在</h1>
          <p className="mt-2 text-sm text-muted-foreground">请检查招聘方提供的面试组编号。</p>
          <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
            返回填写入口
          </Link>
        </Card>
      </CandidateShell>
    );
  }

  if (!name || !email) {
    return (
      <CandidateShell size="narrow">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">请先填写身份信息</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            需要姓名、邮箱和面试组编号才能进入候选人页面。
          </p>
          <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
            返回填写入口
          </Link>
        </Card>
      </CandidateShell>
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
  const slotOptions = buildCandidateSlotOptions(group.timeSlots, activeSlotIds);
  const pendingSubmission = candidate?.submissions[0] ?? null;
  const appointment = candidate?.appointments[0] ?? null;
  const activeSlotItems =
    candidate?.activeSubmission?.slots.map(({ slot }) => ({
      id: slot.id,
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString()
    })) ?? [];
  const modifyHref = `/candidate/${group.groupCode}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&mode=modify`;

  return (
    <CandidateShell>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">{group.name}</h1>
          {group.publicDescription ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {group.publicDescription}
            </p>
          ) : null}
          <div className="mt-5 max-w-2xl">
            <TimezoneSwitcher defaultTimezone={group.timezone} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <CandidateIdentityCard
            name={name}
            email={email}
            status={candidate?.status}
            hasActiveSubmission={Boolean(candidate?.activeSubmission)}
            hasPendingSubmission={Boolean(pendingSubmission)}
          />

          <div className="space-y-6">
            {query.submitted ? <InlineNotice tone="success">可用时间已提交。</InlineNotice> : null}
            {query.pending ? <ReviewNotice mode="pending" /> : null}

            {appointment ? (
              <CandidateAppointmentCard
                startAt={appointment.startAt.toISOString()}
                endAt={appointment.endAt.toISOString()}
                defaultTimezone={group.timezone}
                meetingLocation={appointment.meetingLocation}
                message={appointment.candidateVisibleMessage}
              />
            ) : null}

            {candidate?.activeSubmission && !isModifyMode ? (
              <CandidateSubmittedSummary
                slots={activeSlotItems}
                defaultTimezone={group.timezone}
                note={candidate.activeSubmission.candidateNote}
                modifyHref={modifyHref}
                hasPendingSubmission={Boolean(pendingSubmission)}
              />
            ) : (
              <Card className="p-6" variant="flat">
                <h2 className="text-lg font-semibold">
                  {isModifyMode ? "申请修改可用时间" : "选择你的可用时间"}
                </h2>
                {candidate?.activeSubmission && isModifyMode ? (
                  <div className="mt-4 rounded-lg border border-border bg-surface-subtle p-4">
                    <p className="text-sm font-medium">当前有效版本</p>
                    <div className="mt-3">
                      <TimeRangePreview items={activeSlotItems} defaultTimezone={group.timezone} />
                    </div>
                  </div>
                ) : null}
                <div className="mt-5">
                  <AvailabilityForm
                    mode={candidate?.activeSubmission ? "modify" : "initial"}
                    groupCode={group.groupCode}
                    defaultTimezone={group.timezone}
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
    </CandidateShell>
  );
}
