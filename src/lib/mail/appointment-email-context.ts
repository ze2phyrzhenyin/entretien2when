import { formatDateTimeRange } from "@/lib/date/timezone";

export type AppointmentEmailContextInput = {
  startAt: Date | string;
  endAt: Date | string;
  meetingLocation?: string | null;
  candidateVisibleMessage?: string | null;
};

export function formatAppointmentEmailTime(
  startAt: Date | string,
  endAt: Date | string,
  timezone = "Asia/Shanghai"
) {
  const timezoneLabel = timezone === "Asia/Shanghai" ? "北京时间" : timezone;
  return `${formatDateTimeRange(new Date(startAt), new Date(endAt), timezone)}（${timezoneLabel}）`;
}

export function buildAppointmentEmailContext(
  appointment?: AppointmentEmailContextInput | null,
  timezone = "Asia/Shanghai"
) {
  if (!appointment) {
    return {
      appointmentTime: "尚未安排",
      meetingLocation: "未填写",
      candidateMessage: ""
    };
  }

  return {
    appointmentTime: formatAppointmentEmailTime(appointment.startAt, appointment.endAt, timezone),
    meetingLocation: appointment.meetingLocation?.trim() || "未填写",
    candidateMessage: appointment.candidateVisibleMessage?.trim() || ""
  };
}
