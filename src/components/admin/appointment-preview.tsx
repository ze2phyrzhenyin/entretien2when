"use client";
import { CalendarClock, Clock3, MapPin, UserRound } from "lucide-react";
import { useMemo } from "react";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Card } from "@/components/ui/card";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";
import { formatDate, formatTime } from "@/lib/date/timezone";
import { useLocale } from "@/i18n/locale-provider";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
function withBasePath(href: string) {
  if (!basePath || !href.startsWith("/") || href.startsWith(basePath)) {
    return href;
  }
  return `${basePath}${href}`;
}
type AppointmentPreviewItem = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  startAt: string;
  endAt: string;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  meetingLocation?: string | null;
};
type CandidateSelectionPreviewItem = {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateStatus: "SUBMITTED" | "PENDING_REVIEW" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  submissionStatus: "ACTIVE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  slots: Array<{
    id: string;
    startAt: string;
    endAt: string;
    status: "OPEN" | "CLOSED";
  }>;
};
export function AppointmentPreview({
  groupId,
  appointments,
  candidateSelections,
  defaultTimezone
}: {
  groupId: string;
  appointments: AppointmentPreviewItem[];
  candidateSelections: CandidateSelectionPreviewItem[];
  defaultTimezone: string;
}) {
  const { t } = useLocale();
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const { locale } = useLocale();
  const scheduledAppointments = appointments.filter(
    (appointment) => appointment.status === "SCHEDULED"
  );
  const groupedAppointments = useMemo(() => {
    const groups = new Map<
      string,
      Array<
        AppointmentPreviewItem & {
          timeLabel: string;
        }
      >
    >();
    for (const appointment of scheduledAppointments) {
      const start = new Date(appointment.startAt);
      const end = new Date(appointment.endAt);
      const dateLabel = formatDate(start, timezone, locale);
      const timeLabel = `${formatTime(start, timezone, locale)}-${formatTime(end, timezone, locale)}`;
      groups.set(dateLabel, [...(groups.get(dateLabel) ?? []), { ...appointment, timeLabel }]);
    }
    return [...groups.entries()];
  }, [locale, scheduledAppointments, timezone]);
  const formattedCandidateSelections = useMemo(
    () =>
      candidateSelections
        .map((selection) => {
          const groups = new Map<
            string,
            Array<{
              id: string;
              timeLabel: string;
              status: "OPEN" | "CLOSED";
            }>
          >();
          for (const slot of selection.slots) {
            const start = new Date(slot.startAt);
            const end = new Date(slot.endAt);
            const dateLabel = formatDate(start, timezone, locale);
            const timeLabel = `${formatTime(start, timezone, locale)}-${formatTime(end, timezone, locale)}`;
            groups.set(dateLabel, [
              ...(groups.get(dateLabel) ?? []),
              { id: slot.id, timeLabel, status: slot.status }
            ]);
          }
          return {
            ...selection,
            groupedSlots: [...groups.entries()]
          };
        })
        .filter((selection) => selection.groupedSlots.length > 0),
    [candidateSelections, locale, timezone]
  );
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">{t("legacy.interview_arranged.c7cf9fba")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("legacy.formal_interview_time_confirmed_and_locked.bea37bf6")}
          </p>
        </div>
        {scheduledAppointments.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-subtle p-5 text-sm text-muted-foreground">
            {t(
              "legacy.no_interviews_have_been_scheduled_yet_after_the_interview_schedule_is_co.6e2a3836"
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groupedAppointments.map(([dateLabel, dayAppointments]) => (
              <section key={dateLabel} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                  {dateLabel}
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {dayAppointments.map((appointment) => (
                    <Card key={appointment.id} variant="flat" className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-foreground">
                            {appointment.timeLabel}
                          </p>
                          <a
                            href={withBasePath(
                              `/admin/groups/${groupId}/candidates/${appointment.candidateId}`
                            )}
                            className="mt-2 inline-flex max-w-full items-center gap-2 text-sm font-medium text-primary"
                          >
                            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{appointment.candidateName}</span>
                          </a>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {appointment.candidateEmail}
                          </p>
                        </div>
                        <StatusBadge kind="appointment" status={appointment.status} />
                      </div>
                      {appointment.meetingLocation ? (
                        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="break-words">{appointment.meetingLocation}</span>
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">
            {t("legacy.candidate_selected_time.2bd3359e")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t(
              "legacy.availability_of_candidate_submissions_does_not_yet_equate_to_confirmed_f.5eafa31b"
            )}
          </p>
        </div>
        {formattedCandidateSelections.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-subtle p-5 text-sm text-muted-foreground">
            {t(
              "legacy.there_is_currently_no_candidate_submission_record_candidates_available_t.e89ef20a"
            )}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {formattedCandidateSelections.map((selection) => (
              <Card key={selection.candidateId} variant="flat" className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={withBasePath(
                        `/admin/groups/${groupId}/candidates/${selection.candidateId}`
                      )}
                      className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-primary"
                    >
                      <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{selection.candidateName}</span>
                    </a>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {selection.candidateEmail}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge kind="candidate" status={selection.candidateStatus} />
                    <StatusBadge kind="submission" status={selection.submissionStatus} />
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {selection.groupedSlots.map(([dateLabel, slots]) => (
                    <div key={dateLabel} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                        {dateLabel}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((slot) => (
                          <span
                            key={slot.id}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-sm"
                          >
                            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            {slot.timeLabel}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
