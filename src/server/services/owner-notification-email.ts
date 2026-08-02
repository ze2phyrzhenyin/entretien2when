import { AdminGroupRole, AdminStatus, AuditActorType, type Prisma } from "@prisma/client";
import { getPublicAppUrl, withBasePath } from "@/lib/app-url";
import { formatDateTimeRangeWithTimezone, formatDateTimeWithTimezone } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { enqueueOwnerNotificationEmail } from "@/server/services/email-outbox";
import { normalizeLocale, type AppLocale } from "@/i18n/config";

type NotificationGroup = {
  id: string;
  name: string;
  groupCode: string;
  timezone: string;
};

type NotificationCandidate = {
  id: string;
  name: string;
  email: string;
};

type NotificationSlot = {
  startAt: Date | string;
  endAt: Date | string;
};

type SubmissionNotificationKind = "initial" | "modification";
type AppointmentNotificationKind = "scheduled" | "rescheduled" | "cancelled";

type OwnerNotificationEmail = {
  subject: string;
  body: string;
};

type OwnerRecipientClient = Pick<Prisma.TransactionClient, "adminGroupMembership">;
type OwnerNotificationClient = OwnerRecipientClient &
  Pick<Prisma.TransactionClient, "auditLog" | "emailOutbox">;

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeOwnerNotificationRecipients(values: Iterable<string>) {
  return [
    ...new Set(
      [...values]
        .flatMap((value) => value.split(/[,\s;；]+/))
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .filter(isEmailLike)
    )
  ];
}

export async function getOwnerNotificationRecipients(
  groupId: string,
  client: OwnerRecipientClient = prisma
) {
  const memberships = await client.adminGroupMembership.findMany({
    where: {
      groupId,
      role: AdminGroupRole.OWNER,
      admin: { status: AdminStatus.ACTIVE }
    },
    select: {
      admin: {
        select: { email: true }
      }
    }
  });

  return normalizeOwnerNotificationRecipients(memberships.map(({ admin }) => admin.email));
}

function adminCandidateUrl(groupId: string, candidateId: string) {
  const path = `/admin/groups/${groupId}/candidates/${candidateId}`;
  try {
    return getPublicAppUrl(path);
  } catch {
    // A malformed public URL must not prevent the business transaction from
    // committing. Keep the message useful to an authenticated owner while
    // avoiding an unsafe/incorrect external origin.
    try {
      return withBasePath(path);
    } catch {
      return path;
    }
  }
}

function formatSlots(slots: NotificationSlot[], timezone: string, locale: AppLocale) {
  const sortedSlots = [...slots].sort(
    (slotA, slotB) => new Date(slotA.startAt).getTime() - new Date(slotB.startAt).getTime()
  );

  if (sortedSlots.length === 0) {
    return locale === "en" ? "- No availability selected" : "- 未选择开放时间";
  }

  return sortedSlots
    .map(
      (slot) =>
        `- ${formatDateTimeRangeWithTimezone(
          new Date(slot.startAt),
          new Date(slot.endAt),
          timezone,
          locale
        )}`
    )
    .join("\n");
}

export function buildOwnerSubmissionNotificationEmail({
  kind,
  group,
  candidate,
  submissionId,
  slots,
  candidateNote,
  occurredAt = new Date(),
  locale: requestedLocale = "zh-CN"
}: {
  kind: SubmissionNotificationKind;
  group: NotificationGroup;
  candidate: NotificationCandidate;
  submissionId: string;
  slots: NotificationSlot[];
  candidateNote?: string | null;
  occurredAt?: Date;
  locale?: AppLocale;
}): OwnerNotificationEmail {
  const locale = normalizeLocale(requestedLocale);
  const isModification = kind === "modification";
  if (locale === "en") {
    const eventName = isModification
      ? "Candidate submitted an availability change request"
      : "Candidate submitted availability";
    const subjectPrefix = isModification ? "Availability change request" : "Availability submitted";
    return {
      subject: `[${subjectPrefix}] ${candidate.name} - ${group.name}`,
      body: [
        `Event: ${eventName}`,
        `Submitted: ${formatDateTimeWithTimezone(occurredAt, group.timezone, locale)}`,
        "",
        `Interview group: ${group.name}`,
        `Group code: ${group.groupCode}`,
        `Candidate: ${candidate.name} <${candidate.email}>`,
        `Submission ID: ${submissionId}`,
        "",
        `Selected times (${slots.length}):`,
        formatSlots(slots, group.timezone, locale),
        "",
        `Candidate note: ${candidateNote?.trim() || "Not provided"}`,
        "",
        `Open in administration: ${adminCandidateUrl(group.id, candidate.id)}`
      ].join("\n")
    };
  }
  const eventName = isModification ? "候选人提交了可用时间修改申请" : "候选人提交了可用时间";
  const subjectPrefix = isModification ? "修改申请通知" : "可用时间提交通知";

  return {
    subject: `【${subjectPrefix}】${candidate.name} - ${group.name}`,
    body: [
      `事件：${eventName}`,
      `提交时间：${formatDateTimeWithTimezone(occurredAt, group.timezone)}`,
      "",
      `面试组：${group.name}`,
      `面试组编号：${group.groupCode}`,
      `候选人：${candidate.name} <${candidate.email}>`,
      `提交编号：${submissionId}`,
      "",
      `已选时间（${slots.length} 个）：`,
      formatSlots(slots, group.timezone, locale),
      "",
      `候选人备注：${candidateNote?.trim() || "未填写"}`,
      "",
      `后台查看：${adminCandidateUrl(group.id, candidate.id)}`
    ].join("\n")
  };
}

export function buildOwnerAppointmentNotificationEmail({
  kind = "scheduled",
  group,
  candidate,
  appointmentId,
  startAt,
  endAt,
  meetingLocation,
  candidateVisibleMessage,
  scheduledByEmail,
  occurredAt = new Date(),
  locale: requestedLocale = "zh-CN"
}: {
  kind?: AppointmentNotificationKind;
  group: NotificationGroup;
  candidate: NotificationCandidate;
  appointmentId: string;
  startAt: Date | string;
  endAt: Date | string;
  meetingLocation?: string | null;
  candidateVisibleMessage?: string | null;
  scheduledByEmail?: string | null;
  occurredAt?: Date;
  locale?: AppLocale;
}): OwnerNotificationEmail {
  const locale = normalizeLocale(requestedLocale);
  if (locale === "en") {
    const statusLabel: Record<AppointmentNotificationKind, string> = {
      scheduled: "scheduled",
      rescheduled: "rescheduled",
      cancelled: "cancelled"
    };
    const eventLabel: Record<AppointmentNotificationKind, string> = {
      scheduled: "Administrator confirmed an interview",
      rescheduled: "Administrator changed an interview",
      cancelled: "Administrator cancelled an interview"
    };
    const occurredAtLabel: Record<AppointmentNotificationKind, string> = {
      scheduled: "Scheduled at",
      rescheduled: "Changed at",
      cancelled: "Cancelled at"
    };
    return {
      subject: `[Interview update] ${candidate.name} ${statusLabel[kind]} - ${group.name}`,
      body: [
        `Event: ${eventLabel[kind]}`,
        `${occurredAtLabel[kind]}: ${formatDateTimeWithTimezone(
          occurredAt,
          group.timezone,
          locale
        )}`,
        "",
        `Interview group: ${group.name}`,
        `Group code: ${group.groupCode}`,
        `Candidate: ${candidate.name} <${candidate.email}>`,
        `Appointment ID: ${appointmentId}`,
        `Interview time: ${formatDateTimeRangeWithTimezone(
          new Date(startAt),
          new Date(endAt),
          group.timezone,
          locale
        )}`,
        `Location/link: ${meetingLocation?.trim() || "Not provided"}`,
        `Candidate instructions: ${candidateVisibleMessage?.trim() || "Not provided"}`,
        `Administrator: ${scheduledByEmail || "Unknown"}`,
        "",
        `Open in administration: ${adminCandidateUrl(group.id, candidate.id)}`
      ].join("\n")
    };
  }
  const statusLabel: Record<AppointmentNotificationKind, string> = {
    scheduled: "已安排面试",
    rescheduled: "面试时间已调整",
    cancelled: "面试安排已取消"
  };
  const eventLabel: Record<AppointmentNotificationKind, string> = {
    scheduled: "管理员确认了正式面试安排",
    rescheduled: "管理员调整了正式面试安排",
    cancelled: "管理员取消了正式面试安排"
  };
  const occurredAtLabel: Record<AppointmentNotificationKind, string> = {
    scheduled: "安排时间",
    rescheduled: "调整时间",
    cancelled: "取消时间"
  };

  return {
    subject: `【面试安排通知】${candidate.name} ${statusLabel[kind]} - ${group.name}`,
    body: [
      `事件：${eventLabel[kind]}`,
      `${occurredAtLabel[kind]}：${formatDateTimeWithTimezone(occurredAt, group.timezone)}`,
      "",
      `面试组：${group.name}`,
      `面试组编号：${group.groupCode}`,
      `候选人：${candidate.name} <${candidate.email}>`,
      `安排编号：${appointmentId}`,
      `面试时间：${formatDateTimeRangeWithTimezone(
        new Date(startAt),
        new Date(endAt),
        group.timezone
      )}`,
      `地点/链接：${meetingLocation?.trim() || "未填写"}`,
      `给候选人的说明：${candidateVisibleMessage?.trim() || "未填写"}`,
      `操作管理员：${scheduledByEmail || "未知"}`,
      "",
      `后台查看：${adminCandidateUrl(group.id, candidate.id)}`
    ].join("\n")
  };
}

async function sendOwnerNotificationEmail(
  input: {
    groupId: string;
    entityType: "CandidateSubmission" | "Appointment";
    entityId: string;
    event: string;
    email: OwnerNotificationEmail;
    locale?: AppLocale;
  },
  client: OwnerNotificationClient = prisma
) {
  const recipients = await getOwnerNotificationRecipients(input.groupId, client);
  if (recipients.length === 0) {
    // Do not fall back to a personal or global mailbox.  A missing active group
    // owner is an operational failure, but it must not roll back an already
    // committed candidate/appointment change or leak PII to an unrelated party.
    await client.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        groupId: input.groupId,
        action: "system.owner_notification_not_queued",
        entityType: input.entityType,
        entityId: input.entityId,
        afterData: {
          event: input.event,
          reason: "no_active_group_owner"
        }
      }
    });
    return { queued: false };
  }

  await enqueueOwnerNotificationEmail(
    {
      kind: "owner-notification",
      groupId: input.groupId,
      entityType: input.entityType,
      entityId: input.entityId,
      event: input.event,
      recipients,
      subject: input.email.subject,
      body: input.email.body,
      locale: normalizeLocale(input.locale)
    },
    client
  );
  return { queued: true };
}

export async function notifyOwnerAboutSubmission(
  input: {
    kind: SubmissionNotificationKind;
    group: NotificationGroup;
    candidate: NotificationCandidate;
    submissionId: string;
    slots: NotificationSlot[];
    candidateNote?: string | null;
    locale?: AppLocale;
  },
  client: OwnerNotificationClient = prisma
) {
  await sendOwnerNotificationEmail(
    {
      groupId: input.group.id,
      entityType: "CandidateSubmission",
      entityId: input.submissionId,
      event:
        input.kind === "modification"
          ? "candidate.request_submission_modification"
          : "candidate.submit_initial_availability",
      email: buildOwnerSubmissionNotificationEmail(input),
      locale: input.locale
    },
    client
  );
}

export async function notifyOwnerAboutAppointment(
  input: {
    kind?: AppointmentNotificationKind;
    group: NotificationGroup;
    candidate: NotificationCandidate;
    appointmentId: string;
    startAt: Date | string;
    endAt: Date | string;
    meetingLocation?: string | null;
    candidateVisibleMessage?: string | null;
    scheduledByEmail?: string | null;
    locale?: AppLocale;
  },
  client: OwnerNotificationClient = prisma
) {
  const kind = input.kind ?? "scheduled";
  const event: Record<AppointmentNotificationKind, string> = {
    scheduled: "admin.schedule_appointment",
    rescheduled: "admin.reschedule_appointment",
    cancelled: "admin.cancel_appointment"
  };

  await sendOwnerNotificationEmail(
    {
      groupId: input.group.id,
      entityType: "Appointment",
      entityId: input.appointmentId,
      event: event[kind],
      email: buildOwnerAppointmentNotificationEmail({ ...input, kind }),
      locale: input.locale
    },
    client
  );
}
