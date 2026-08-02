import { formatDateTimeRangeWithTimezone } from "@/lib/date/timezone";
import { normalizeLocale, type AppLocale } from "@/i18n/config";

export type AppointmentEmailContextInput = {
  startAt: Date | string;
  endAt: Date | string;
  meetingLocation?: string | null;
  candidateVisibleMessage?: string | null;
};

export function formatAppointmentEmailTime(
  startAt: Date | string,
  endAt: Date | string,
  timezone = "Asia/Shanghai",
  requestedLocale: AppLocale = "zh-CN"
) {
  const locale = normalizeLocale(requestedLocale);
  return formatDateTimeRangeWithTimezone(new Date(startAt), new Date(endAt), timezone, locale);
}

export function buildAppointmentEmailContext(
  appointment?: AppointmentEmailContextInput | null,
  timezone = "Asia/Shanghai",
  requestedLocale: AppLocale = "zh-CN"
) {
  const locale = normalizeLocale(requestedLocale);
  if (!appointment) {
    return {
      appointmentTime: locale === "en" ? "Not scheduled" : "尚未安排",
      meetingLocation: locale === "en" ? "Not provided" : "未填写",
      candidateMessage: ""
    };
  }

  return {
    appointmentTime: formatAppointmentEmailTime(
      appointment.startAt,
      appointment.endAt,
      timezone,
      locale
    ),
    meetingLocation:
      appointment.meetingLocation?.trim() || (locale === "en" ? "Not provided" : "未填写"),
    candidateMessage: appointment.candidateVisibleMessage?.trim() || ""
  };
}
