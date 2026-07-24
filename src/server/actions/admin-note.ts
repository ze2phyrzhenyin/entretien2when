"use server";

import { revalidatePath } from "next/cache";
import { AuditActorType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { groupCandidateCareRoles, requireGroupPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { candidateAdminNoteSchema } from "@/lib/validation/admin-note";

export async function upsertCandidateAdminNoteAction(
  groupId: string,
  candidateId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupCandidateCareRoles);

  const input = candidateAdminNoteSchema.parse({
    body: formValue(formData, "body")
  });

  await prisma.$transaction(async (tx) => {
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
  });

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
}
