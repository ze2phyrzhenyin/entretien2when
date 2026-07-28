"use server";

import { AuditActorType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { groupCandidateCareRoles, requireGroupPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { candidateAdminNoteSchema } from "@/lib/validation/admin-note";

export type CandidateAdminNoteState = {
  status?: "success" | "error";
  message?: string;
  note?: {
    id: string;
    body: string;
    authorName: string;
    authorEmail?: string;
  };
};

export async function upsertCandidateAdminNoteAction(
  groupId: string,
  candidateId: string,
  _previousState: CandidateAdminNoteState,
  formData: FormData
): Promise<CandidateAdminNoteState> {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupCandidateCareRoles);

  const parsed = candidateAdminNoteSchema.safeParse({
    body: formValue(formData, "body")
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "请检查备注内容。"
    };
  }
  const input = parsed.data;

  const note = await prisma.$transaction(async (tx) => {
    // Both IDs are attacker-controlled Server Action arguments. Bind them in
    // the same transaction before creating a note so access to group A can
    // never be used to write a note on a candidate in group B.
    const candidate = await tx.candidate.findFirst({
      where: { id: candidateId, groupId },
      select: { id: true }
    });

    if (!candidate) {
      throw new Error("候选人不属于该面试组。");
    }

    const existing = await tx.candidateAdminNote.findFirst({
      where: {
        groupId,
        candidateId,
        authorAdminId: admin.id
      },
      select: {
        id: true
      }
    });

    const note = existing
      ? await tx.candidateAdminNote.update({
          where: { id: existing.id },
          data: { body: input.body }
        })
      : await tx.candidateAdminNote.create({
          data: {
            groupId,
            candidateId,
            authorAdminId: admin.id,
            body: input.body
          }
        });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.upsert_candidate_admin_note",
        entityType: "CandidateAdminNote",
        entityId: note.id
      }
    });

    return note;
  });

  return {
    status: "success",
    message: "跟进备注已保存并写入审计日志。",
    note: {
      id: note.id,
      body: note.body,
      authorName: admin.displayName
    }
  };
}
