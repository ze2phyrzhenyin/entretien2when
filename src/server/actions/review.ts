"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AdminNotificationStatus,
  AuditActorType,
  CandidateSubmissionStatus,
  Prisma
} from "@prisma/client";
import {
  deriveCandidateStatus,
  isSchedulingIntegrityConflict,
  SchedulingConflictError,
  SchedulingValidationError
} from "@/lib/business/scheduling-integrity";
import { assertSlotsSelectable, uniqueSlotIds } from "@/lib/business/slot-selection";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  lockStateResources,
  serializableTransactionOptions,
  withSerializableRetry
} from "@/lib/db/transaction";
import { groupReviewRoles, requireGroupPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { reviewSubmissionSchema } from "@/lib/validation/review";

async function loadPendingSubmissionForReview(
  tx: Prisma.TransactionClient,
  groupId: string,
  submissionId: string
) {
  const pendingReference = await tx.candidateSubmission.findFirst({
    where: {
      id: submissionId,
      groupId,
      status: CandidateSubmissionStatus.PENDING_REVIEW
    },
    select: { candidateId: true }
  });
  if (!pendingReference) {
    throw new SchedulingConflictError("审核申请已被其他操作处理，请刷新后重试。");
  }

  await lockStateResources(tx, [`candidate:${pendingReference.candidateId}`]);

  const pendingSubmission = await tx.candidateSubmission.findFirst({
    where: {
      id: submissionId,
      groupId,
      candidateId: pendingReference.candidateId,
      status: CandidateSubmissionStatus.PENDING_REVIEW
    },
    include: {
      candidate: {
        select: {
          id: true,
          groupId: true,
          activeSubmissionId: true,
          activeSubmission: {
            select: {
              id: true,
              candidateNameSnapshot: true,
              candidateEmailSnapshot: true
            }
          }
        }
      },
      slots: {
        include: {
          slot: {
            include: {
              activeLock: {
                select: { id: true }
              }
            }
          }
        }
      }
    }
  });

  if (!pendingSubmission) {
    throw new SchedulingConflictError("审核申请已被其他操作处理，请刷新后重试。");
  }
  return pendingSubmission;
}

function assertPendingSubmissionSlots(
  pendingSubmission: Awaited<ReturnType<typeof loadPendingSubmissionForReview>>
) {
  const slotIds = uniqueSlotIds(pendingSubmission.slots.map((item) => item.slotId));
  try {
    assertSlotsSelectable(
      pendingSubmission.slots.map((item) => item.slot),
      slotIds
    );
  } catch (error) {
    throw new SchedulingValidationError(
      error instanceof Error ? error.message : "修改申请中的开放时间已不可用。"
    );
  }
  return slotIds;
}

async function hasScheduledAppointment(tx: Prisma.TransactionClient, candidateId: string) {
  return Boolean(
    await tx.appointment.findFirst({
      where: {
        candidateId,
        status: "SCHEDULED"
      },
      select: { id: true }
    })
  );
}

export async function approveSubmissionAction(
  groupId: string,
  submissionId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupReviewRoles);

  const input = reviewSubmissionSchema.parse({
    reviewComment: formValue(formData, "reviewComment")
  });

  let approvedCandidateId: string;
  try {
    approvedCandidateId = await withSerializableRetry(() =>
      prisma.$transaction(async (tx) => {
        const pendingSubmission = await loadPendingSubmissionForReview(tx, groupId, submissionId);
        const slotIds = assertPendingSubmissionSlots(pendingSubmission);
        const oldActiveSubmissionId = pendingSubmission.candidate.activeSubmissionId;

        if (!oldActiveSubmissionId) {
          throw new SchedulingConflictError("候选人的当前有效提交已变化，请刷新后重试。");
        }

        const oldActiveUpdate = await tx.candidateSubmission.updateMany({
          where: {
            id: oldActiveSubmissionId,
            candidateId: pendingSubmission.candidateId,
            groupId,
            status: CandidateSubmissionStatus.ACTIVE
          },
          data: { status: CandidateSubmissionStatus.SUPERSEDED }
        });
        if (oldActiveUpdate.count !== 1) {
          throw new SchedulingConflictError("候选人的当前有效提交已变化，请刷新后重试。");
        }

        const reviewedAt = new Date();
        const pendingUpdate = await tx.candidateSubmission.updateMany({
          where: {
            id: pendingSubmission.id,
            groupId,
            candidateId: pendingSubmission.candidateId,
            pendingReviewCandidateId: pendingSubmission.candidateId,
            status: CandidateSubmissionStatus.PENDING_REVIEW
          },
          data: {
            status: CandidateSubmissionStatus.ACTIVE,
            pendingReviewCandidateId: null,
            reviewedByAdminId: admin.id,
            reviewedAt,
            reviewComment: input.reviewComment || null
          }
        });
        if (pendingUpdate.count !== 1) {
          throw new SchedulingConflictError("审核申请已被其他操作处理，请刷新后重试。");
        }

        const candidateUpdate = await tx.candidate.updateMany({
          where: {
            id: pendingSubmission.candidateId,
            groupId,
            activeSubmissionId: oldActiveSubmissionId
          },
          data: {
            activeSubmissionId: pendingSubmission.id,
            name: pendingSubmission.candidateNameSnapshot,
            email: pendingSubmission.candidateEmailSnapshot,
            normalizedEmail: pendingSubmission.candidateEmailSnapshot.toLowerCase(),
            status: deriveCandidateStatus({
              hasScheduledAppointment: await hasScheduledAppointment(
                tx,
                pendingSubmission.candidateId
              ),
              hasPendingReview: false
            })
          }
        });
        if (candidateUpdate.count !== 1) {
          throw new SchedulingConflictError("候选人状态已变化，请刷新后重试。");
        }

        await tx.adminNotification.updateMany({
          where: { submissionId: pendingSubmission.id },
          data: {
            status: AdminNotificationStatus.HANDLED,
            handledAt: reviewedAt
          }
        });

        await tx.auditLog.create({
          data: {
            actorType: AuditActorType.ADMIN,
            actorAdminId: admin.id,
            groupId,
            action: "admin.approve_submission_modification",
            entityType: "CandidateSubmission",
            entityId: pendingSubmission.id,
            afterData: { slotIds }
          }
        });

        return pendingSubmission.candidateId;
      }, serializableTransactionOptions)
    );
  } catch (error) {
    if (error instanceof SchedulingValidationError || isSchedulingIntegrityConflict(error)) {
      throw new Error("审核申请或候选人状态已变化，请刷新后重试。");
    }
    throw error;
  }

  revalidatePath(`/admin/groups/${groupId}/reviews`);
  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/groups/${groupId}/candidates/${approvedCandidateId}`);
  redirect(`/admin/groups/${groupId}/candidates/${approvedCandidateId}?review=approved`);
}

export async function rejectSubmissionAction(
  groupId: string,
  submissionId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupReviewRoles);

  const input = reviewSubmissionSchema.parse({
    reviewComment: formValue(formData, "reviewComment")
  });

  let rejectedCandidateId: string;
  try {
    rejectedCandidateId = await withSerializableRetry(() =>
      prisma.$transaction(async (tx) => {
        const pendingSubmission = await loadPendingSubmissionForReview(tx, groupId, submissionId);
        const reviewedAt = new Date();
        const pendingUpdate = await tx.candidateSubmission.updateMany({
          where: {
            id: pendingSubmission.id,
            groupId,
            candidateId: pendingSubmission.candidateId,
            pendingReviewCandidateId: pendingSubmission.candidateId,
            status: CandidateSubmissionStatus.PENDING_REVIEW
          },
          data: {
            status: CandidateSubmissionStatus.REJECTED,
            pendingReviewCandidateId: null,
            reviewedByAdminId: admin.id,
            reviewedAt,
            reviewComment: input.reviewComment || null
          }
        });
        if (pendingUpdate.count !== 1) {
          throw new SchedulingConflictError("审核申请已被其他操作处理，请刷新后重试。");
        }

        const candidateUpdate = await tx.candidate.updateMany({
          where: {
            id: pendingSubmission.candidateId,
            groupId,
            activeSubmissionId: pendingSubmission.candidate.activeSubmissionId
          },
          data: {
            ...(pendingSubmission.candidate.activeSubmission
              ? {
                  name: pendingSubmission.candidate.activeSubmission.candidateNameSnapshot,
                  email: pendingSubmission.candidate.activeSubmission.candidateEmailSnapshot,
                  normalizedEmail:
                    pendingSubmission.candidate.activeSubmission.candidateEmailSnapshot.toLowerCase()
                }
              : {}),
            status: deriveCandidateStatus({
              hasScheduledAppointment: await hasScheduledAppointment(
                tx,
                pendingSubmission.candidateId
              ),
              hasPendingReview: false
            })
          }
        });
        if (candidateUpdate.count !== 1) {
          throw new SchedulingConflictError("候选人状态已变化，请刷新后重试。");
        }

        await tx.adminNotification.updateMany({
          where: { submissionId: pendingSubmission.id },
          data: {
            status: AdminNotificationStatus.HANDLED,
            handledAt: reviewedAt
          }
        });

        await tx.auditLog.create({
          data: {
            actorType: AuditActorType.ADMIN,
            actorAdminId: admin.id,
            groupId,
            action: "admin.reject_submission_modification",
            entityType: "CandidateSubmission",
            entityId: pendingSubmission.id
          }
        });

        return pendingSubmission.candidateId;
      }, serializableTransactionOptions)
    );
  } catch (error) {
    if (isSchedulingIntegrityConflict(error)) {
      throw new Error("审核申请或候选人状态已变化，请刷新后重试。");
    }
    throw error;
  }

  revalidatePath(`/admin/groups/${groupId}/reviews`);
  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/groups/${groupId}/candidates/${rejectedCandidateId}`);
  redirect(`/admin/groups/${groupId}/candidates/${rejectedCandidateId}?review=rejected`);
}
