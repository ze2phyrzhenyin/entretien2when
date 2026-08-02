import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  buildAppointmentCalendarLinks,
  buildAppointmentIcs
} from "@/lib/mail/appointment-calendar";
import { formatDateTimeRangeWithTimezone } from "@/lib/date/timezone";
import { enqueueAppointmentEmail } from "@/server/services/email-outbox";
import { normalizeLocale, type AppLocale } from "@/i18n/config";

type AppointmentNotificationClient = Pick<Prisma.TransactionClient, "emailOutbox">;
type AppointmentEventKind = "scheduled" | "rescheduled" | "cancelled";

type AppointmentNotificationInput = {
  kind: AppointmentEventKind;
  appointment: {
    id: string;
    startAt: Date;
    endAt: Date;
    calendarSequence: number;
    meetingLocation?: string | null;
    candidateVisibleMessage?: string | null;
  };
  group: {
    id: string;
    name: string;
    timezone: string;
  };
  roundName?: string | null;
  candidate: {
    name: string;
    email: string;
    locale?: AppLocale;
  };
  interviewers: Array<{
    name: string;
    email: string;
    locale?: AppLocale;
  }>;
  now?: Date;
  /** Locale used for staff recipients without an individual preference. */
  staffLocale?: AppLocale;
  /** Compatibility default for queued payloads created before recipient-class policy. */
  locale?: AppLocale;
};

function reminderHours() {
  const parsed = (process.env.APPOINTMENT_REMINDER_HOURS ?? "24,1")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 168);
  return [...new Set(parsed)].sort((left, right) => right - left);
}

function recipientKey(email: string) {
  return createHash("sha256").update(email.toLowerCase()).digest("base64url").slice(0, 16);
}

function uniqueRecipients(input: AppointmentNotificationInput) {
  const candidateLocale = normalizeLocale(input.candidate.locale ?? input.locale);
  const staffLocale = normalizeLocale(input.staffLocale ?? input.locale);
  const candidates = [
    {
      name: input.candidate.name,
      email: input.candidate.email,
      locale: candidateLocale,
      recipientClass: "candidate" as const
    },
    ...input.interviewers.map((interviewer) => ({
      ...interviewer,
      locale: normalizeLocale(interviewer.locale ?? staffLocale),
      recipientClass: "interviewer" as const
    }))
  ];
  const seen = new Set<string>();
  return candidates.filter((recipient) => {
    const key = recipient.email.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function notificationCopy(
  input: AppointmentNotificationInput,
  locale: AppLocale,
  reminder?: number
) {
  const label: Record<AppointmentEventKind, string> = {
    scheduled: "面试安排已确认",
    rescheduled: "面试时间已调整",
    cancelled: "面试安排已取消"
  };
  const calendarInput = {
    appointmentId: input.appointment.id,
    sequence: input.appointment.calendarSequence,
    groupName: input.group.name,
    roundName: input.roundName,
    candidateName: input.candidate.name,
    startAt: input.appointment.startAt,
    endAt: input.appointment.endAt,
    meetingLocation: input.appointment.meetingLocation,
    description: input.appointment.candidateVisibleMessage,
    cancelled: input.kind === "cancelled",
    locale
  };
  const links = buildAppointmentCalendarLinks(calendarInput);
  if (locale === "en") {
    const englishLabel: Record<AppointmentEventKind, string> = {
      scheduled: "Interview confirmed",
      rescheduled: "Interview rescheduled",
      cancelled: "Interview cancelled"
    };
    const eventLabel = reminder
      ? `Interview starts in ${reminder} hour${reminder === 1 ? "" : "s"}`
      : englishLabel[input.kind];
    const subject = `[${eventLabel}] ${input.candidate.name} · ${input.group.name}`;
    const body = [
      eventLabel,
      "",
      `Candidate: ${input.candidate.name}`,
      `Interview group: ${input.group.name}`,
      input.roundName ? `Round: ${input.roundName}` : null,
      `Time: ${formatDateTimeRangeWithTimezone(
        input.appointment.startAt,
        input.appointment.endAt,
        input.group.timezone,
        locale
      )}`,
      `Location/link: ${input.appointment.meetingLocation?.trim() || "Not provided"}`,
      `Instructions: ${input.appointment.candidateVisibleMessage?.trim() || "Not provided"}`,
      "",
      "The attached ICS file can be added to most calendar applications.",
      `Google Calendar: ${links.google}`,
      `Outlook Calendar: ${links.outlook}`
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    return { subject, body, icsContent: buildAppointmentIcs(calendarInput) };
  }
  const eventLabel = reminder ? `面试将在 ${reminder} 小时后开始` : label[input.kind];
  const subject = `【${eventLabel}】${input.candidate.name} · ${input.group.name}`;
  const body = [
    eventLabel,
    "",
    `候选人：${input.candidate.name}`,
    `面试组：${input.group.name}`,
    input.roundName ? `轮次：${input.roundName}` : null,
    `时间：${formatDateTimeRangeWithTimezone(
      input.appointment.startAt,
      input.appointment.endAt,
      input.group.timezone
    )}`,
    `地点/链接：${input.appointment.meetingLocation?.trim() || "未填写"}`,
    `说明：${input.appointment.candidateVisibleMessage?.trim() || "未填写"}`,
    "",
    "附件中的 ICS 文件可直接加入常用日历。",
    `Google Calendar：${links.google}`,
    `Outlook Calendar：${links.outlook}`
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    subject,
    body,
    icsContent: buildAppointmentIcs(calendarInput)
  };
}

export async function queueAppointmentNotifications(
  input: AppointmentNotificationInput,
  client: AppointmentNotificationClient
) {
  const recipients = uniqueRecipients(input);
  const expectedStartAt = input.appointment.startAt.toISOString();

  for (const recipient of recipients) {
    const immediateCopy = notificationCopy(input, recipient.locale);
    const recipientHash = recipientKey(recipient.email);
    await enqueueAppointmentEmail(
      {
        dedupeKey: [
          "appointment-email",
          input.appointment.id,
          input.kind,
          String(input.appointment.calendarSequence),
          recipientHash
        ].join(":"),
        payload: {
          kind: "appointment-email",
          category: input.kind,
          groupId: input.group.id,
          appointmentId: input.appointment.id,
          expectedStartAt,
          calendarSequence: input.appointment.calendarSequence,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          subject: immediateCopy.subject,
          body: immediateCopy.body,
          icsFilename: `interview-${input.appointment.id}.ics`,
          icsContent: immediateCopy.icsContent,
          locale: recipient.locale
        }
      },
      client
    );
  }

  if (input.kind === "cancelled") {
    return;
  }

  const now = input.now ?? new Date();
  for (const hours of reminderHours()) {
    const nextAttemptAt = new Date(input.appointment.startAt.getTime() - hours * 60 * 60 * 1000);
    if (nextAttemptAt.getTime() <= now.getTime() + 60_000) {
      continue;
    }
    for (const recipient of recipients) {
      const reminderCopy = notificationCopy(input, recipient.locale, hours);
      const recipientHash = recipientKey(recipient.email);
      await enqueueAppointmentEmail(
        {
          dedupeKey: [
            "appointment-reminder",
            input.appointment.id,
            expectedStartAt,
            String(hours),
            recipientHash
          ].join(":"),
          nextAttemptAt,
          payload: {
            kind: "appointment-email",
            category: "reminder",
            groupId: input.group.id,
            appointmentId: input.appointment.id,
            expectedStartAt,
            calendarSequence: input.appointment.calendarSequence,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject: reminderCopy.subject,
            body: reminderCopy.body,
            icsFilename: `interview-${input.appointment.id}.ics`,
            icsContent: reminderCopy.icsContent,
            locale: recipient.locale
          }
        },
        client
      );
    }
  }
}
