import { getServerTranslator } from "@/i18n/server";
import { CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
export async function CandidateAppointmentCard({
  startAt,
  endAt,
  defaultTimezone,
  meetingLocation,
  message
}: {
  startAt: string;
  endAt: string;
  defaultTimezone: string;
  meetingLocation?: string | null;
  message?: string | null;
}) {
  const { t } = await getServerTranslator();
  return (
    <Card className="p-6" variant="flat">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">
          {t("legacy.interview_has_been_arranged.98222a5d")}
        </h2>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t("legacy.interview_time.d53c6f2c")}</dt>
          <dd className="mt-1 font-medium">
            <ZonedDateTimeRange
              startAt={startAt}
              endAt={endAt}
              defaultTimezone={defaultTimezone}
              showTimezone
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("legacy.meeting_location_or_link.fe727e39")}</dt>
          <dd className="mt-1 break-all font-medium">
            {meetingLocation ?? t("legacy.to_be_notified.35abcd72")}
          </dd>
        </div>
      </dl>
      {message ? (
        <p className="mt-4 rounded-lg bg-surface-subtle p-3 text-sm leading-6">{message}</p>
      ) : null}
    </Card>
  );
}
