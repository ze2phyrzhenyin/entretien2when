"use server";

import { revalidatePath } from "next/cache";
import { AuditActorType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireGroupPermission } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";
import { candidateAdminNoteSchema } from "@/lib/validation/admin-note";

export async function upsertCandidateAdminNoteAction(
  groupId: string,
  candidateId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);

  const input = candidateAdminNoteSchema.parse({
    body: formValue(formData, "body")
  });

  const existing = await prisma.candidateAdminNote.findFirst({
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
    ? await prisma.candidateAdminNote.update({
        where: { id: existing.id },
        data: { body: input.body }
      })
    : await prisma.candidateAdminNote.create({
        data: {
          groupId,
          candidateId,
          authorAdminId: admin.id,
          body: input.body
        }
      });

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      groupId,
      action: "admin.upsert_candidate_admin_note",
      entityType: "CandidateAdminNote",
      entityId: note.id
    }
  });

  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
}
