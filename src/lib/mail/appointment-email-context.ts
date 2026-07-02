import { formatDateTimeRange } from "@/lib/date/timezone";

export type AppointmentEmailContextInput = {
  startAt: Date | string;
  endAt: Date | string;
  meetingLocation?: string | null;
  candidateVisibleMessage?: string | null;
};

function formatBeijingAppointmentTime(startAt: Date | string, endAt: Date | string) {
  return `${formatDateTimeRange(new Date(startAt), new Date(endAt), "Asia/Shanghai")}（北京时间）`;
}

export function buildAppointmentEmailContext(appointment?: AppointmentEmailContextInput | null) {
  if (!appointment) {
    return {
      appointmentTime: "尚未安排",
      meetingLocation: "未填写",
      candidateMessage: ""
    };
  }

  return {
    appointmentTime: formatBeijingAppointmentTime(appointment.startAt, appointment.endAt),
    meetingLocation: appointment.meetingLocation?.trim() || "未填写",
    candidateMessage: appointment.candidateVisibleMessage?.trim() || ""
  };
}
