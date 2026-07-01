import { CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

export function CandidateAppointmentCard({
  time,
  meetingLocation,
  message
}: {
  time: string;
  meetingLocation?: string | null;
  message?: string | null;
}) {
  return (
    <Card className="p-6" variant="flat">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">面试已安排</h2>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">面试时间</dt>
          <dd className="mt-1 font-medium">{time}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">会议地点或链接</dt>
          <dd className="mt-1 break-all font-medium">{meetingLocation ?? "待通知"}</dd>
        </div>
      </dl>
      {message ? (
        <p className="mt-4 rounded-lg bg-surface-subtle p-3 text-sm leading-6">{message}</p>
      ) : null}
    </Card>
  );
}
