"use client";

import { CalendarClock, MapPin, UserRound } from "lucide-react";
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

export function AppointmentPreview({
  groupId,
  appointments,
  defaultTimezone
}: {
  groupId: string;
  appointments: AppointmentPreviewItem[];
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

  if (scheduledAppointments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-subtle p-5 text-sm text-muted-foreground">
        暂无已预约面试。安排面试后，这里会显示候选人和对应时间。
      </div>
    );
  }

  return (
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
                    <p className="text-lg font-semibold text-foreground">{appointment.timeLabel}</p>
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
  );
}
