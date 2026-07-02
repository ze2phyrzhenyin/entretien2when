import { AuditActorType } from "@prisma/client";
import { formatDateTime, formatDateTimeRange } from "@/lib/date/timezone";
import { sendMailatoEmail } from "@/lib/mail/mailato";
import { prisma } from "@/lib/db/prisma";

const DEFAULT_OWNER_NOTIFICATION_EMAIL = "zephyr2515@gmail.com";

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

type OwnerNotificationEmail = {
  subject: string;
  body: string;
};

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getOwnerNotificationRecipients(raw = process.env.OWNER_NOTIFICATION_EMAILS) {
  const source = raw?.trim() ? raw : DEFAULT_OWNER_NOTIFICATION_EMAIL;
  const emails = [
    ...new Set(
      source
        .split(/[,\s;；]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .filter(isEmailLike)
    )
  ];

  return emails.length > 0 ? emails : [DEFAULT_OWNER_NOTIFICATION_EMAIL];
}

function adminCandidateUrl(groupId: string, candidateId: string) {
  const baseUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
  const path = `/admin/groups/${groupId}/candidates/${candidateId}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

function formatSlots(slots: NotificationSlot[], timezone: string) {
  const sortedSlots = [...slots].sort(
    (slotA, slotB) => new Date(slotA.startAt).getTime() - new Date(slotB.startAt).getTime()
  );

  if (sortedSlots.length === 0) {
    return "- 未选择时间段";
  }

  return sortedSlots
    .map(
      (slot) => `- ${formatDateTimeRange(new Date(slot.startAt), new Date(slot.endAt), timezone)}`
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
  occurredAt = new Date()
}: {
  kind: SubmissionNotificationKind;
  group: NotificationGroup;
  candidate: NotificationCandidate;
  submissionId: string;
  slots: NotificationSlot[];
  candidateNote?: string | null;
  occurredAt?: Date;
}): OwnerNotificationEmail {
  const isModification = kind === "modification";
  const eventName = isModification ? "候选人提交了可用时间修改申请" : "候选人提交了可用时间";
  const subjectPrefix = isModification ? "修改通知" : "预约通知";

  return {
    subject: `【${subjectPrefix}】${candidate.name} - ${group.name}`,
    body: [
      `事件：${eventName}`,
      `提交时间：${formatDateTime(occurredAt, group.timezone)}`,
      "",
      `面试组：${group.name}`,
      `面试组编号：${group.groupCode}`,
      `候选人：${candidate.name} <${candidate.email}>`,
      `提交编号：${submissionId}`,
      "",
      `已选时间（${slots.length} 个）：`,
      formatSlots(slots, group.timezone),
      "",
      `候选人备注：${candidateNote?.trim() || "未填写"}`,
      "",
      `后台查看：${adminCandidateUrl(group.id, candidate.id)}`
    ].join("\n")
  };
}

export function buildOwnerAppointmentNotificationEmail({
  group,
  candidate,
  appointmentId,
  startAt,
  endAt,
  meetingLocation,
  candidateVisibleMessage,
  scheduledByEmail,
  occurredAt = new Date()
}: {
  group: NotificationGroup;
  candidate: NotificationCandidate;
  appointmentId: string;
  startAt: Date | string;
  endAt: Date | string;
  meetingLocation?: string | null;
  candidateVisibleMessage?: string | null;
  scheduledByEmail?: string | null;
  occurredAt?: Date;
}): OwnerNotificationEmail {
  return {
    subject: `【预约通知】${candidate.name} 已安排面试 - ${group.name}`,
    body: [
      "事件：管理员安排了正式面试预约",
      `安排时间：${formatDateTime(occurredAt, group.timezone)}`,
      "",
      `面试组：${group.name}`,
      `面试组编号：${group.groupCode}`,
      `候选人：${candidate.name} <${candidate.email}>`,
      `预约编号：${appointmentId}`,
      `预约时间：${formatDateTimeRange(new Date(startAt), new Date(endAt), group.timezone)}`,
      `地点/链接：${meetingLocation?.trim() || "未填写"}`,
      `候选人可见说明：${candidateVisibleMessage?.trim() || "未填写"}`,
      `安排管理员：${scheduledByEmail || "未知"}`,
      "",
      `后台查看：${adminCandidateUrl(group.id, candidate.id)}`
    ].join("\n")
  };
}

async function writeOwnerNotificationAudit(input: {
  groupId: string;
  entityType: "CandidateSubmission" | "Appointment";
  entityId: string;
  event: string;
  recipients: string[];
  status: "sent" | "preview" | "failure";
  emailId?: string | null;
  dryRun?: boolean;
  errorMessage?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        groupId: input.groupId,
        action: "system.owner_notification_email",
        entityType: input.entityType,
        entityId: input.entityId,
        afterData: {
          event: input.event,
          recipients: input.recipients,
          status: input.status,
          emailId: input.emailId ?? null,
          dryRun: input.dryRun ?? false,
          errorMessage: input.errorMessage ?? null
        }
      }
    });
  } catch (error) {
    console.error("Failed to write owner notification audit log", error);
  }
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0]?.slice(0, 240) || "发送负责人通知失败";
  }
  return "发送负责人通知失败";
}

async function sendOwnerNotificationEmail(input: {
  groupId: string;
  entityType: "CandidateSubmission" | "Appointment";
  entityId: string;
  event: string;
  email: OwnerNotificationEmail;
}) {
  const recipients = getOwnerNotificationRecipients();
  const [primaryRecipient, ...ccRecipients] = recipients;
  if (!primaryRecipient) {
    return;
  }

  try {
    const result = await sendMailatoEmail({
      recipient: {
        email: primaryRecipient,
        name: "Interview Scheduler"
      },
      cc: ccRecipients.map((email) => ({ email })),
      subject: input.email.subject,
      body: input.email.body,
      auditId: `owner-notification:${input.entityType}:${input.entityId}`,
      timeoutMs: 15_000
    });

    await writeOwnerNotificationAudit({
      groupId: input.groupId,
      entityType: input.entityType,
      entityId: input.entityId,
      event: input.event,
      recipients,
      status: result.status,
      emailId: result.emailId ?? null,
      dryRun: result.dryRun
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    await writeOwnerNotificationAudit({
      groupId: input.groupId,
      entityType: input.entityType,
      entityId: input.entityId,
      event: input.event,
      recipients,
      status: "failure",
      errorMessage
    });
    console.error(errorMessage);
  }
}

export async function notifyOwnerAboutSubmission(input: {
  kind: SubmissionNotificationKind;
  group: NotificationGroup;
  candidate: NotificationCandidate;
  submissionId: string;
  slots: NotificationSlot[];
  candidateNote?: string | null;
}) {
  await sendOwnerNotificationEmail({
    groupId: input.group.id,
    entityType: "CandidateSubmission",
    entityId: input.submissionId,
    event:
      input.kind === "modification"
        ? "candidate.request_submission_modification"
        : "candidate.submit_initial_availability",
    email: buildOwnerSubmissionNotificationEmail(input)
  });
}

export async function notifyOwnerAboutAppointment(input: {
  group: NotificationGroup;
  candidate: NotificationCandidate;
  appointmentId: string;
  startAt: Date | string;
  endAt: Date | string;
  meetingLocation?: string | null;
  candidateVisibleMessage?: string | null;
  scheduledByEmail?: string | null;
}) {
  await sendOwnerNotificationEmail({
    groupId: input.group.id,
    entityType: "Appointment",
    entityId: input.appointmentId,
    event: "admin.schedule_appointment",
    email: buildOwnerAppointmentNotificationEmail(input)
  });
}
