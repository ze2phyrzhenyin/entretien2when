import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  buildAppointmentCalendarLinks,
  buildAppointmentIcs
} from "@/lib/mail/appointment-calendar";
import { formatDateTimeRange } from "@/lib/date/timezone";
import { enqueueAppointmentEmail } from "@/server/services/email-outbox";

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
  };
  interviewers: Array<{
    name: string;
    email: string;
  }>;
  now?: Date;
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
  const candidates = [
    { name: input.candidate.name, email: input.candidate.email },
    ...input.interviewers
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

function notificationCopy(input: AppointmentNotificationInput, reminder?: number) {
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
    cancelled: input.kind === "cancelled"
  };
  const links = buildAppointmentCalendarLinks(calendarInput);
  const eventLabel = reminder ? `面试将在 ${reminder} 小时后开始` : label[input.kind];
  const subject = `【${eventLabel}】${input.candidate.name} · ${input.group.name}`;
  const body = [
    eventLabel,
    "",
    `候选人：${input.candidate.name}`,
    `面试组：${input.group.name}`,
    input.roundName ? `轮次：${input.roundName}` : null,
    `时间：${formatDateTimeRange(
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
  const immediateCopy = notificationCopy(input);
  const expectedStartAt = input.appointment.startAt.toISOString();

  for (const recipient of recipients) {
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
          icsContent: immediateCopy.icsContent
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
    const reminderCopy = notificationCopy(input, hours);
    for (const recipient of recipients) {
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
            icsContent: reminderCopy.icsContent
          }
        },
        client
      );
    }
  }
}
