import { getServerTranslator } from "@/i18n/server";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentCandidateSession } from "@/lib/auth/candidate-session";
import { candidateSlotWindowDays, resolveCandidateSlotWindow } from "@/lib/date/slot-window";
import { normalizeGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";
import { AvailabilityForm } from "./availability-form";
type CandidateGroupPageProps = {
  params: Promise<{
    groupCode: string;
  }>;
  searchParams: Promise<{
    mode?: string;
    submitted?: string;
    pending?: string;
    error?: string;
    from?: string;
    to?: string;
  }>;
};
function buildCandidateSlotOptions(
  slots: Array<{
    id: string;
    startAt: Date;
    endAt: Date;
    status: GroupTimeSlotStatus;
    activeLock: {
      id: string;
    } | null;
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
  const { t } = await getServerTranslator();
  const [{ groupCode }, query] = await Promise.all([params, searchParams]);
  const normalizedGroupCode = normalizeGroupCode(groupCode);
  const requestedModifyMode = query.mode === "modify";
  const group = await prisma.interviewGroup.findUnique({
    where: { groupCode: normalizedGroupCode }
  });
  if (!group) {
    return (
      <CandidateShell size="narrow">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">
            {t("legacy.the_interview_group_does_not_exist.5417de95")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("legacy.please_check_the_interview_group_number_provided_by_the_recruiter.27617216")}
          </p>
          <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
            {t("legacy.return_to_fill_in_the_entry.eeb690e4")}
          </Link>
        </Card>
      </CandidateShell>
    );
  }
  const session = await getCurrentCandidateSession(group.id);
  if (!session) {
    return (
      <CandidateShell size="narrow">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">
            {t("legacy.please_enter_via_email_link.be3a87e4")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "legacy.to_protect_candidate_information_please_send_an_access_link_on_the_entra.ce60eade"
            )}
          </p>
          <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
            {t("legacy.send_access_link.685a3d8b")}
          </Link>
        </Card>
      </CandidateShell>
    );
  }
  const candidate = await prisma.candidate.findUnique({
    where: {
      groupId_normalizedEmail: {
        groupId: group.id,
        normalizedEmail: session.normalizedEmail
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
  const slotWindow = resolveCandidateSlotWindow({
    from: query.from,
    to: query.to,
    timezone: group.timezone
  });
  const visibleSlots = await prisma.groupTimeSlot.findMany({
    where: {
      groupId: group.id,
      OR: [
        {
          startAt: {
            gte: slotWindow.startAt,
            lt: slotWindow.endAt
          }
        },
        ...(activeSlotIds.size > 0 ? [{ id: { in: [...activeSlotIds] } }] : [])
      ]
    },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    include: {
      activeLock: {
        select: { id: true }
      }
    }
  });
  const slotOptions = buildCandidateSlotOptions(visibleSlots, activeSlotIds);
  const pendingSubmission = candidate?.submissions[0] ?? null;
  const appointment = candidate?.appointments[0] ?? null;
  const canRequestModification =
    Boolean(candidate?.activeSubmission) && !pendingSubmission && !appointment;
  const isModifyMode = requestedModifyMode && canRequestModification;
  const activeSlotItems =
    candidate?.activeSubmission?.slots.map(({ slot }) => ({
      id: slot.id,
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString()
    })) ?? [];
  const identityName = candidate?.name ?? session.name;
  const identityEmail = candidate?.email ?? session.email;
  const modifyHref = `/candidate/${group.groupCode}?mode=modify`;
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
            name={identityName}
            email={identityEmail}
            status={candidate?.status}
            hasActiveSubmission={Boolean(candidate?.activeSubmission)}
            hasPendingSubmission={Boolean(pendingSubmission)}
          />

          <div className="space-y-6">
            {query.submitted ? (
              <InlineNotice tone="success">
                {t("legacy.available_time_has_been_submitted.22164b30")}
              </InlineNotice>
            ) : null}
            {query.pending ? <ReviewNotice mode="pending" /> : null}
            {requestedModifyMode && !canRequestModification ? (
              <InlineNotice tone="warning">
                {t(
                  "legacy.there_are_currently_formal_interview_arrangements_or_modification_applic.044a1976"
                )}
              </InlineNotice>
            ) : null}

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
                canRequestModification={canRequestModification}
              />
            ) : (
              <Card className="p-6" variant="flat">
                <h2 className="text-lg font-semibold">
                  {isModifyMode
                    ? t("legacy.apply_to_modify_the_available_time.109a1326")
                    : t("legacy.select_available_time.8600b794")}
                </h2>
                {candidate?.activeSubmission && isModifyMode ? (
                  <div className="mt-4 rounded-lg border border-border bg-surface-subtle p-4">
                    <p className="text-sm font-medium">
                      {t("legacy.currently_valid_version.813c8a91")}
                    </p>
                    <div className="mt-3">
                      <TimeRangePreview items={activeSlotItems} defaultTimezone={group.timezone} />
                    </div>
                  </div>
                ) : null}
                <div className="mt-5">
                  {slotWindow.wasAdjusted ? (
                    <InlineNotice tone="warning" className="mb-4">
                      {t("availability.dateRangeInvalid", { days: candidateSlotWindowDays })}
                    </InlineNotice>
                  ) : null}
                  <Card className="mb-4 p-4" variant="subtle">
                    <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      {isModifyMode ? <input type="hidden" name="mode" value="modify" /> : null}
                      <label className="grid gap-1 text-sm font-medium">
                        {t("legacy.start_date.76050649")}
                        <Input name="from" type="date" defaultValue={slotWindow.from} required />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">
                        {t("legacy.end_date.895cd52f")}
                        <Input name="to" type="date" defaultValue={slotWindow.to} required />
                      </label>
                      <Button type="submit" variant="secondary" className="self-end">
                        {t("legacy.view_time_period.d1d659b1")}
                      </Button>
                    </form>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {t("availability.windowHelp", { days: candidateSlotWindowDays })}
                    </p>
                  </Card>
                  <AvailabilityForm
                    mode={candidate?.activeSubmission ? "modify" : "initial"}
                    groupCode={group.groupCode}
                    defaultTimezone={group.timezone}
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
