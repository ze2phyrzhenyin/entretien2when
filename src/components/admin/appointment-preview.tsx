"use client";

import { CalendarClock, Clock3, MapPin, UserRound } from "lucide-react";
import { useMemo } from "react";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Card } from "@/components/ui/card";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";
import { formatDate, formatTime } from "@/lib/date/timezone";

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
  const { timezone } = useDisplayTimezone(defaultTimezone);
  const scheduledAppointments = appointments.filter(
    (appointment) => appointment.status === "SCHEDULED"
  );

  const groupedAppointments = useMemo(() => {
    const groups = new Map<string, Array<AppointmentPreviewItem & { timeLabel: string }>>();

    for (const appointment of scheduledAppointments) {
      const start = new Date(appointment.startAt);
      const end = new Date(appointment.endAt);
      const dateLabel = formatDate(start, timezone);
      const timeLabel = `${formatTime(start, timezone)}-${formatTime(end, timezone)}`;
      groups.set(dateLabel, [...(groups.get(dateLabel) ?? []), { ...appointment, timeLabel }]);
    }

    return [...groups.entries()];
  }, [scheduledAppointments, timezone]);

  const formattedCandidateSelections = useMemo(
    () =>
      candidateSelections
        .map((selection) => {
          const groups = new Map<
            string,
            Array<{ id: string; timeLabel: string; status: "OPEN" | "CLOSED" }>
          >();

          for (const slot of selection.slots) {
            const start = new Date(slot.startAt);
            const end = new Date(slot.endAt);
            const dateLabel = formatDate(start, timezone);
            const timeLabel = `${formatTime(start, timezone)}-${formatTime(end, timezone)}`;
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
    [candidateSelections, timezone]
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">已安排面试</h3>
          <p className="text-sm text-muted-foreground">已确认并锁定的正式面试时间。</p>
        </div>
        {scheduledAppointments.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-subtle p-5 text-sm text-muted-foreground">
            暂无已安排面试。确认面试安排后，这里会显示候选人和对应时间。
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
          <h3 className="text-base font-semibold">候选人已选时间</h3>
          <p className="text-sm text-muted-foreground">
            候选人提交的可用时间，尚未等同于已确认的正式面试安排。
          </p>
        </div>
        {formattedCandidateSelections.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-subtle p-5 text-sm text-muted-foreground">
            暂无候选人提交记录。候选人提交可用时间后会显示在这里。
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
