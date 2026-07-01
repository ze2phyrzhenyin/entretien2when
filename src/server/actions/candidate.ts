"use server";

import { redirect } from "next/navigation";
import {
  AdminNotificationType,
  AuditActorType,
  CandidateStatus,
  CandidateSubmissionStatus,
  CandidateSubmissionType,
  InterviewGroupStatus
} from "@prisma/client";
import {
  assertSlotSelectionCount,
  assertSlotsSelectable,
  uniqueSlotIds
} from "@/lib/business/slot-selection";
import { prisma } from "@/lib/db/prisma";
import { formValue } from "@/lib/validation/common";
import { candidateAvailabilitySchema } from "@/lib/validation/candidate";

function parseSlotIds(formData: FormData) {
  return uniqueSlotIds(formValue(formData, "slotIds").split(","));
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
  const input = candidateAvailabilitySchema.parse({
    groupCode: formValue(formData, "groupCode"),
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    candidateNote: formValue(formData, "candidateNote"),
    slotIds: parseSlotIds(formData)
  });

  const group = await prisma.interviewGroup.findUnique({
    where: { groupCode: input.groupCode }
  });

  if (!group || group.status !== InterviewGroupStatus.OPEN) {
    redirect(
      `/candidate/${input.groupCode}?name=${encodeURIComponent(input.name)}&email=${encodeURIComponent(input.email)}&error=group-not-open`
    );
  }

  const slotIds = uniqueSlotIds(input.slotIds);
  assertSlotSelectionCount(slotIds, group.minSelectSlots, group.maxSelectSlots);
  const slots = await assertCandidateSlots(group.id, slotIds);
  assertSlotsSelectable(slots, slotIds);

  await prisma.$transaction(async (tx) => {
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
          normalizedEmail: input.email
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
          name: input.name,
          email: input.email,
          normalizedEmail: input.email,
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
        candidateNameSnapshot: input.name,
        candidateEmailSnapshot: input.email,
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
        name: input.name,
        email: input.email,
        normalizedEmail: input.email,
        status: CandidateStatus.SUBMITTED,
        activeSubmissionId: submission.id
      }
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
  });

  redirect(
    `/candidate/${input.groupCode}?name=${encodeURIComponent(input.name)}&email=${encodeURIComponent(input.email)}&submitted=1`
  );
}

export async function requestSubmissionModificationAction(formData: FormData) {
  const input = candidateAvailabilitySchema.parse({
    groupCode: formValue(formData, "groupCode"),
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    candidateNote: formValue(formData, "candidateNote"),
    slotIds: parseSlotIds(formData)
  });

  const group = await prisma.interviewGroup.findUnique({
    where: { groupCode: input.groupCode }
  });

  if (!group || group.status !== InterviewGroupStatus.OPEN) {
    redirect(
      `/candidate/${input.groupCode}?name=${encodeURIComponent(input.name)}&email=${encodeURIComponent(input.email)}&error=group-not-open`
    );
  }

  const slotIds = uniqueSlotIds(input.slotIds);
  assertSlotSelectionCount(slotIds, group.minSelectSlots, group.maxSelectSlots);
  const slots = await assertCandidateSlots(group.id, slotIds);
  assertSlotsSelectable(slots, slotIds);

  await prisma.$transaction(async (tx) => {
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
          normalizedEmail: input.email
        }
      },
      include: {
        activeSubmission: true
      }
    });

    if (!candidate?.activeSubmission) {
      throw new Error("尚无有效提交，请先完成首次提交。");
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
        candidateNameSnapshot: input.name,
        candidateEmailSnapshot: input.email,
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
        name: input.name,
        email: input.email,
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
        content: `${input.name} 提交了可用时间修改申请。`
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
  });

  redirect(
    `/candidate/${input.groupCode}?name=${encodeURIComponent(input.name)}&email=${encodeURIComponent(input.email)}&pending=1`
  );
}
