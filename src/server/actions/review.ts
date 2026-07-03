"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AdminNotificationStatus,
  AuditActorType,
  CandidateStatus,
  CandidateSubmissionStatus
} from "@prisma/client";
import { assertSlotsSelectable, uniqueSlotIds } from "@/lib/business/slot-selection";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { reviewSubmissionSchema } from "@/lib/validation/review";

export async function approveSubmissionAction(
  groupId: string,
  submissionId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);

  const input = reviewSubmissionSchema.parse({
    reviewComment: formValue(formData, "reviewComment")
  });

  const pendingSubmission = await prisma.candidateSubmission.findFirst({
    where: {
      id: submissionId,
      groupId,
      status: CandidateSubmissionStatus.PENDING_REVIEW
    },
    include: {
      candidate: {
        include: {
          activeSubmission: true
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
    throw new Error("未找到待审核修改申请。");
  }

  const slotIds = uniqueSlotIds(pendingSubmission.slots.map((item) => item.slotId));
  assertSlotsSelectable(
    pendingSubmission.slots.map((item) => item.slot),
    slotIds
  );

  await prisma.$transaction(async (tx) => {
    const transactionSlots = await tx.groupTimeSlot.findMany({
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
    assertSlotsSelectable(transactionSlots, slotIds);

    if (pendingSubmission.candidate.activeSubmissionId) {
      await tx.candidateSubmission.update({
        where: { id: pendingSubmission.candidate.activeSubmissionId },
        data: { status: CandidateSubmissionStatus.SUPERSEDED }
      });
    }

    await tx.candidateSubmission.update({
      where: { id: pendingSubmission.id },
      data: {
        status: CandidateSubmissionStatus.ACTIVE,
        pendingReviewCandidateId: null,
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        reviewComment: input.reviewComment || null
      }
    });

    await tx.candidate.update({
      where: { id: pendingSubmission.candidateId },
      data: {
        activeSubmissionId: pendingSubmission.id,
        name: pendingSubmission.candidateNameSnapshot,
        email: pendingSubmission.candidateEmailSnapshot,
        normalizedEmail: pendingSubmission.candidateEmailSnapshot.toLowerCase(),
        status: CandidateStatus.SUBMITTED
      }
    });

    await tx.adminNotification.updateMany({
      where: { submissionId: pendingSubmission.id },
      data: {
        status: AdminNotificationStatus.HANDLED,
        handledAt: new Date()
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
  });

  revalidatePath(`/admin/groups/${groupId}/reviews`);
  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/groups/${groupId}/candidates/${pendingSubmission.candidateId}`);
  redirect(`/admin/groups/${groupId}/candidates/${pendingSubmission.candidateId}?review=approved`);
}

export async function rejectSubmissionAction(
  groupId: string,
  submissionId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);

  const input = reviewSubmissionSchema.parse({
    reviewComment: formValue(formData, "reviewComment")
  });

  const pendingSubmission = await prisma.candidateSubmission.findFirst({
    where: {
      id: submissionId,
      groupId,
      status: CandidateSubmissionStatus.PENDING_REVIEW
    },
    select: {
      id: true,
      candidateId: true
    }
  });

  if (!pendingSubmission) {
    throw new Error("未找到待审核修改申请。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidateSubmission.update({
      where: { id: pendingSubmission.id },
      data: {
        status: CandidateSubmissionStatus.REJECTED,
        pendingReviewCandidateId: null,
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        reviewComment: input.reviewComment || null
      }
    });

    await tx.candidate.update({
      where: { id: pendingSubmission.candidateId },
      data: { status: CandidateStatus.SUBMITTED }
    });

    await tx.adminNotification.updateMany({
      where: { submissionId: pendingSubmission.id },
      data: {
        status: AdminNotificationStatus.HANDLED,
        handledAt: new Date()
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
  });

  revalidatePath(`/admin/groups/${groupId}/reviews`);
  revalidatePath("/admin/reviews");
  redirect(`/admin/groups/${groupId}/candidates/${pendingSubmission.candidateId}?review=rejected`);
}
