"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AdminNotificationType,
  AuditActorType,
  CandidateStatus,
  CandidateSubmissionStatus,
  CandidateSubmissionType,
  InterviewGroupStatus
} from "@prisma/client";
import { getPublicAppUrl, withBasePath } from "@/lib/app-url";
import { getCurrentCandidateSession } from "@/lib/auth/candidate-session";
import { generateCandidateToken, hashCandidateToken } from "@/lib/auth/candidate-token";
import { sendMailatoEmail } from "@/lib/mail/mailato";
import {
  assertRateLimit,
  createRateLimitKey,
  getTrustedClientIp,
  RateLimitError
} from "@/lib/rate-limit";
import { prisma } from "@/lib/db/prisma";
import {
  lockStateResources,
  serializableTransactionOptions,
  withSerializableRetry
} from "@/lib/db/transaction";
import { formValue } from "@/lib/validation/common";
import {
  candidateAccessRequestSchema,
  candidateAvailabilitySessionSchema
} from "@/lib/validation/candidate";
import { notifyOwnerAboutSubmission } from "@/server/services/owner-notification-email";
import {
  assertSlotSelectionCount,
  assertSlotsSelectable,
  uniqueSlotIds
} from "@/lib/business/slot-selection";

function parseSlotIds(formData: FormData) {
  return uniqueSlotIds(formValue(formData, "slotIds").split(","));
}

export type CandidateAccessRequestState = {
  status?: "success" | "error";
  message?: string;
  previewHref?: string;
};

function isCandidateAuthDevPreviewEnabled() {
  const value = process.env.CANDIDATE_AUTH_DEV_PREVIEW?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function getCandidateAccessTokenExpiresAt(now = new Date()) {
  const ttlMinutes = Number.parseInt(process.env.CANDIDATE_ACCESS_TOKEN_TTL_MINUTES ?? "30", 10);
  const safeTtlMinutes = Number.isSafeInteger(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 30;
  return new Date(now.getTime() + safeTtlMinutes * 60 * 1000);
}

async function assertCandidateAccessRateLimit(groupCode: string, email: string) {
  const requestHeaders = await headers();
  const clientIp = getTrustedClientIp(requestHeaders) ?? "untrusted-proxy";

  // The global bucket constrains unauthenticated flood volume. The IP and
  // group+identity buckets limit normal retry behaviour without retaining raw
  // email addresses or IP addresses in the in-process Map.
  await assertRateLimit({
    key: "candidate-access-global",
    limit: 100,
    windowMs: 60_000
  });
  await assertRateLimit({
    key: createRateLimitKey("candidate-access-ip", clientIp),
    limit: 20,
    windowMs: 15 * 60 * 1000
  });
  await assertRateLimit({
    key: createRateLimitKey("candidate-access-identity", `${groupCode}:${email}`),
    limit: 5,
    windowMs: 15 * 60 * 1000
  });
}

function candidateAccessEmail({
  groupName,
  candidateName,
  accessUrl,
  expiresAt
}: {
  groupName: string;
  candidateName: string;
  accessUrl: string;
  expiresAt: Date;
}) {
  return {
    subject: `【面试时间】${groupName} 访问链接`,
    body: [
      `${candidateName}，你好：`,
      "",
      `请使用下面的链接进入「${groupName}」并提交或查看你的可用时间。`,
      accessUrl,
      "",
      `链接将在 ${expiresAt.toLocaleString("zh-CN", { hour12: false })} 失效，且只能使用一次。`,
      "如果不是你本人请求，可以忽略这封邮件。"
    ].join("\n")
  };
}

export async function requestCandidateAccessAction(
  _previousState: CandidateAccessRequestState,
  formData: FormData
): Promise<CandidateAccessRequestState> {
  const parsed = candidateAccessRequestSchema.safeParse({
    groupCode: formValue(formData, "groupCode"),
    name: formValue(formData, "name"),
    email: formValue(formData, "email")
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "请检查填写信息。" };
  }

  const input = parsed.data;
  try {
    await assertCandidateAccessRateLimit(input.groupCode, input.email);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const group = await prisma.interviewGroup.findUnique({
    where: { groupCode: input.groupCode },
    select: {
      id: true,
      name: true,
      groupCode: true,
      status: true
    }
  });

  if (!group || group.status !== InterviewGroupStatus.OPEN) {
    return { status: "error", message: "面试组不存在或暂未开放。" };
  }

  const rawToken = generateCandidateToken();
  const expiresAt = getCandidateAccessTokenExpiresAt();
  const accessPath = `/candidate/auth/${rawToken}`;
  let accessUrl: string;

  try {
    accessUrl = getPublicAppUrl(accessPath);
  } catch {
    // Do not generate a bearer token or send a link when production transport
    // configuration is unsafe or inconsistent with the configured base path.
    return { status: "error", message: "服务访问地址未安全配置，请联系招聘方。" };
  }

  const accessToken = await prisma.candidateAccessToken.create({
    data: {
      groupId: group.id,
      tokenHash: hashCandidateToken(rawToken),
      name: input.name,
      email: input.email,
      normalizedEmail: input.email,
      expiresAt
    },
    select: { id: true }
  });

  const email = candidateAccessEmail({
    groupName: group.name,
    candidateName: input.name,
    accessUrl,
    expiresAt
  });
  const devPreview = isCandidateAuthDevPreviewEnabled();

  try {
    const result = await sendMailatoEmail({
      recipient: {
        email: input.email,
        name: input.name
      },
      subject: email.subject,
      body: email.body,
      auditId: `candidate-access:${accessToken.id}`,
      timeoutMs: 15_000
    });

    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        groupId: group.id,
        action: "system.send_candidate_access_link",
        entityType: "CandidateAccessToken",
        entityId: accessToken.id,
        afterData: {
          normalizedEmail: input.email,
          status: result.status,
          dryRun: result.dryRun,
          emailId: result.emailId ?? null
        }
      }
    });
  } catch (error) {
    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        groupId: group.id,
        action: "system.send_candidate_access_link",
        entityType: "CandidateAccessToken",
        entityId: accessToken.id,
        afterData: {
          normalizedEmail: input.email,
          status: "failure",
          errorMessage: error instanceof Error ? error.message.slice(0, 240) : "发送失败"
        }
      }
    });

    if (!devPreview) {
      return { status: "error", message: "访问链接发送失败，请联系招聘方。" };
    }
  }

  return {
    status: "success",
    message: "访问链接已发送到邮箱，请从邮件中的链接进入。",
    previewHref: devPreview ? withBasePath(accessPath) : undefined
  };
}

async function assertCandidateSlots(groupId: string, slotIds: string[]) {
  return prisma.groupTimeSlot.findMany({
    where: {
      groupId,
      id: { in: slotIds }
    },
    include: {
      activeLock: {
        select: { id: true }
      }
    }
  });
}

export async function submitInitialAvailabilityAction(formData: FormData) {
  const input = candidateAvailabilitySessionSchema.parse({
    groupCode: formValue(formData, "groupCode"),
    candidateNote: formValue(formData, "candidateNote"),
    slotIds: parseSlotIds(formData)
  });

  const group = await prisma.interviewGroup.findUnique({
    where: { groupCode: input.groupCode }
  });

  if (!group || group.status !== InterviewGroupStatus.OPEN) {
    redirect(`/join?access=group-not-open`);
  }

  const session = await getCurrentCandidateSession(group.id);
  if (!session) {
    redirect(`/join?access=required`);
  }

  const slotIds = uniqueSlotIds(input.slotIds);
  assertSlotSelectionCount(slotIds, group.minSelectSlots, group.maxSelectSlots);
  const slots = await assertCandidateSlots(group.id, slotIds);
  assertSlotsSelectable(slots, slotIds);

  await withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const transactionSlots = await tx.groupTimeSlot.findMany({
        where: {
          groupId: group.id,
          id: { in: slotIds }
        },
        include: {
          activeLock: {
            select: { id: true }
          }
        }
      });
      assertSlotsSelectable(transactionSlots, slotIds);

      const existing = await tx.candidate.findUnique({
        where: {
          groupId_normalizedEmail: {
            groupId: group.id,
            normalizedEmail: session.normalizedEmail
          }
        },
        include: {
          activeSubmission: true
        }
      });

      if (existing?.activeSubmission) {
        throw new Error("已提交候选人需要提交修改申请。");
      }

      const candidate =
        existing ??
        (await tx.candidate.create({
          data: {
            groupId: group.id,
            name: session.name,
            email: session.email,
            normalizedEmail: session.normalizedEmail,
            status: CandidateStatus.SUBMITTED
          }
        }));

      const latestSubmission = await tx.candidateSubmission.findFirst({
        where: { candidateId: candidate.id },
        orderBy: { versionNo: "desc" },
        select: { versionNo: true }
      });
      const versionNo = (latestSubmission?.versionNo ?? 0) + 1;

      const submission = await tx.candidateSubmission.create({
        data: {
          candidateId: candidate.id,
          groupId: group.id,
          versionNo,
          submissionType: CandidateSubmissionType.INITIAL,
          candidateNameSnapshot: session.name,
          candidateEmailSnapshot: session.email,
          candidateNote: input.candidateNote || null,
          status: CandidateSubmissionStatus.ACTIVE,
          slots: {
            create: slotIds.map((slotId) => ({
              candidateId: candidate.id,
              groupId: group.id,
              slotId
            }))
          }
        }
      });

      await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          name: session.name,
          email: session.email,
          normalizedEmail: session.normalizedEmail,
          status: CandidateStatus.SUBMITTED,
          activeSubmissionId: submission.id
        }
      });

      await tx.candidateSession.update({
        where: { id: session.id },
        data: { candidateId: candidate.id }
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.CANDIDATE,
          actorCandidateId: candidate.id,
          groupId: group.id,
          action: "candidate.submit_initial_availability",
          entityType: "CandidateSubmission",
          entityId: submission.id,
          afterData: { slotIds }
        }
      });

      // Queue the owner notification in this same transaction. The worker
      // performs the provider call later, so a committed submission can never
      // be left without a durable notification record after a process crash.
      await notifyOwnerAboutSubmission(
        {
          kind: "initial",
          group,
          candidate: {
            id: candidate.id,
            name: session.name,
            email: session.email
          },
          submissionId: submission.id,
          slots: transactionSlots,
          candidateNote: input.candidateNote
        },
        tx
      );
    }, serializableTransactionOptions)
  );

  redirect(`/candidate/${input.groupCode}?submitted=1`);
}

export async function requestSubmissionModificationAction(formData: FormData) {
  const input = candidateAvailabilitySessionSchema.parse({
    groupCode: formValue(formData, "groupCode"),
    candidateNote: formValue(formData, "candidateNote"),
    slotIds: parseSlotIds(formData)
  });

  const group = await prisma.interviewGroup.findUnique({
    where: { groupCode: input.groupCode }
  });

  if (!group || group.status !== InterviewGroupStatus.OPEN) {
    redirect(`/join?access=group-not-open`);
  }

  const session = await getCurrentCandidateSession(group.id);
  if (!session) {
    redirect(`/join?access=required`);
  }

  const slotIds = uniqueSlotIds(input.slotIds);
  assertSlotSelectionCount(slotIds, group.minSelectSlots, group.maxSelectSlots);
  const slots = await assertCandidateSlots(group.id, slotIds);
  assertSlotsSelectable(slots, slotIds);

  await withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const candidateReference = await tx.candidate.findUnique({
        where: {
          groupId_normalizedEmail: {
            groupId: group.id,
            normalizedEmail: session.normalizedEmail
          }
        },
        select: { id: true }
      });

      if (!candidateReference) {
        throw new Error("尚无有效提交，请先完成首次提交。");
      }

      await lockStateResources(tx, [
        `candidate:${candidateReference.id}`,
        ...slotIds.map((slotId) => `slot:${slotId}`)
      ]);

      const transactionSlots = await tx.groupTimeSlot.findMany({
        where: {
          groupId: group.id,
          id: { in: slotIds }
        },
        include: {
          activeLock: {
            select: { id: true }
          }
        }
      });
      assertSlotsSelectable(transactionSlots, slotIds);

      const candidate = await tx.candidate.findUnique({
        where: {
          groupId_normalizedEmail: {
            groupId: group.id,
            normalizedEmail: session.normalizedEmail
          }
        },
        include: {
          activeSubmission: true
        }
      });

      if (!candidate?.activeSubmission) {
        throw new Error("尚无有效提交，请先完成首次提交。");
      }
      if (candidate.status === CandidateStatus.SCHEDULED) {
        throw new Error("面试已安排，如需调整请联系招聘方处理。");
      }

      const pending = await tx.candidateSubmission.findUnique({
        where: {
          pendingReviewCandidateId: candidate.id
        },
        select: { id: true }
      });

      if (pending) {
        throw new Error("已有修改申请正在审核中。");
      }

      const latestSubmission = await tx.candidateSubmission.findFirst({
        where: { candidateId: candidate.id },
        orderBy: { versionNo: "desc" },
        select: { versionNo: true }
      });
      const versionNo = (latestSubmission?.versionNo ?? 0) + 1;

      const submission = await tx.candidateSubmission.create({
        data: {
          candidateId: candidate.id,
          pendingReviewCandidateId: candidate.id,
          groupId: group.id,
          versionNo,
          submissionType: CandidateSubmissionType.MODIFICATION,
          candidateNameSnapshot: session.name,
          candidateEmailSnapshot: session.email,
          candidateNote: input.candidateNote || null,
          status: CandidateSubmissionStatus.PENDING_REVIEW,
          slots: {
            create: slotIds.map((slotId) => ({
              candidateId: candidate.id,
              groupId: group.id,
              slotId
            }))
          }
        }
      });

      await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          status: CandidateStatus.PENDING_REVIEW
        }
      });

      await tx.adminNotification.create({
        data: {
          groupId: group.id,
          candidateId: candidate.id,
          submissionId: submission.id,
          type: AdminNotificationType.MODIFICATION_REVIEW,
          title: "新的候选人修改申请",
          content: `${session.name} 提交了可用时间修改申请。`
        }
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.CANDIDATE,
          actorCandidateId: candidate.id,
          groupId: group.id,
          action: "candidate.request_submission_modification",
          entityType: "CandidateSubmission",
          entityId: submission.id,
          afterData: { slotIds }
        }
      });

      // This follows the same transactional-outbox rule as the initial
      // submission: only committed review work becomes eligible for email.
      await notifyOwnerAboutSubmission(
        {
          kind: "modification",
          group,
          candidate: {
            id: candidate.id,
            name: session.name,
            email: session.email
          },
          submissionId: submission.id,
          slots: transactionSlots,
          candidateNote: input.candidateNote
        },
        tx
      );
    }, serializableTransactionOptions)
  );

  redirect(`/candidate/${input.groupCode}?pending=1`);
}
