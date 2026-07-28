type AppointmentCalendarInput = {
  appointmentId: string;
  sequence: number;
  groupName: string;
  roundName?: string | null;
  candidateName: string;
  startAt: Date;
  endAt: Date;
  meetingLocation?: string | null;
  description?: string | null;
  cancelled?: boolean;
};

function icsUtc(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function calendarUid(appointmentId: string) {
  let host = "when2entretien.local";
  try {
    host = new URL(process.env.APP_URL ?? "https://when2entretien.local").hostname;
  } catch {
    // Keep a deterministic non-public fallback for local/test configurations.
  }
  return `${appointmentId}@${host}`;
}

function eventTitle(input: AppointmentCalendarInput) {
  return `${input.groupName}${input.roundName ? ` · ${input.roundName}` : ""} · ${input.candidateName}`;
}

export function buildAppointmentIcs(input: AppointmentCalendarInput) {
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//When2Entretien//Interview Scheduler//ZH",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcs(calendarUid(input.appointmentId))}`,
    `SEQUENCE:${Math.max(0, Math.floor(input.sequence))}`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsUtc(input.startAt)}`,
    `DTEND:${icsUtc(input.endAt)}`,
    `SUMMARY:${escapeIcs(eventTitle(input))}`,
    `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `TRANSP:${input.cancelled ? "TRANSPARENT" : "OPAQUE"}`
  ];
  if (input.meetingLocation?.trim()) {
    lines.push(`LOCATION:${escapeIcs(input.meetingLocation.trim())}`);
  }
  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcs(input.description.trim())}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

export function buildAppointmentCalendarLinks(input: AppointmentCalendarInput) {
  const title = eventTitle(input);
  const details = input.description?.trim() ?? "";
  const location = input.meetingLocation?.trim() ?? "";
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${icsUtc(input.startAt)}/${icsUtc(input.endAt)}`,
    details,
    location
  }).toString();

  const outlook = new URL("https://outlook.office.com/calendar/0/deeplink/compose");
  outlook.search = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    startdt: input.startAt.toISOString(),
    enddt: input.endAt.toISOString(),
    body: details,
    location
  }).toString();

  return {
    google: google.toString(),
    outlook: outlook.toString()
  };
}
