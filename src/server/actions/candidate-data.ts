"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditActorType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { lockStateResources, serializableTransactionOptions } from "@/lib/db/transaction";
import { requireSuperAdmin } from "@/lib/permissions/admin";
import { formValue } from "@/lib/validation/common";

// Persist a language-neutral redaction marker. User-facing explanations are
// localized at render time; durable candidate and submission facts must not
// depend on the administrator's current UI locale.
const ANONYMIZED_CANDIDATE_NAME = "—";

function erasedCandidateAddress(candidateId: string) {
  const suffix = createHash("sha256").update(candidateId).digest("hex").slice(0, 20);
  return `erased+${suffix}@invalid.local`;
}

export async function anonymizeCandidateAction(
  groupId: string,
  candidateId: string,
  formData: FormData
) {
  const admin = await requireAdmin();
  requireSuperAdmin(admin);

  if (formValue(formData, "confirmation") !== "ANONYMIZE") {
    redirect(`/admin/groups/${groupId}/candidates/${candidateId}?section=overview&privacy=invalid`);
  }

  await prisma.$transaction(async (tx) => {
    await lockStateResources(tx, [`candidate:${candidateId}`, `group:${groupId}`]);
    const candidate = await tx.candidate.findFirstOrThrow({
      where: { id: candidateId, groupId },
      select: { id: true, email: true, normalizedEmail: true }
    });
    const erasedEmail = erasedCandidateAddress(candidate.id);

    // Outbox payloads are intentionally denormalized. Remove every known
    // candidate-bound shape before the relational rows or identity change.
    await tx.$executeRaw`
      DELETE FROM "EmailOutbox"
      WHERE "payload" ->> 'candidateId' = ${candidateId}
        OR lower("payload" ->> 'recipientEmail') = ${candidate.normalizedEmail}
        OR "payload" ->> 'appointmentId' IN (
          SELECT "id" FROM "Appointment" WHERE "candidateId" = ${candidateId}
        )
        OR "payload" ->> 'entityId' IN (
          SELECT "id" FROM "Appointment" WHERE "candidateId" = ${candidateId}
          UNION
          SELECT "id" FROM "CandidateSubmission" WHERE "candidateId" = ${candidateId}
        )
    `;

    // Remove message bodies and credentials first. Appointment timing remains
    // available for aggregate reporting, but free-text fields and identities do not.
    await Promise.all([
      tx.candidateAccessToken.deleteMany({
        where: { groupId, normalizedEmail: candidate.normalizedEmail }
      }),
      tx.candidateSession.deleteMany({
        where: {
          groupId,
          OR: [{ candidateId }, { normalizedEmail: candidate.normalizedEmail }]
        }
      }),
      tx.candidateEmailDelivery.deleteMany({ where: { groupId, candidateId } }),
      tx.candidateAdminNote.deleteMany({ where: { groupId, candidateId } }),
      tx.adminNotification.deleteMany({ where: { groupId, candidateId } }),
      tx.appointment.updateMany({
        where: { groupId, candidateId },
        data: {
          candidateVisibleMessage: null,
          meetingLocation: null,
          internalNote: null
        }
      }),
      tx.candidateSubmission.updateMany({
        where: { groupId, candidateId },
        data: {
          candidateNameSnapshot: ANONYMIZED_CANDIDATE_NAME,
          candidateEmailSnapshot: erasedEmail,
          candidateNote: null,
          reviewComment: null
        }
      })
    ]);

    await tx.candidate.update({
      where: { id: candidateId },
      data: {
        name: ANONYMIZED_CANDIDATE_NAME,
        email: erasedEmail,
        normalizedEmail: erasedEmail
      }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        groupId,
        action: "admin.anonymize_candidate",
        entityType: "Candidate",
        entityId: candidateId,
        afterData: { anonymized: true }
      }
    });
  }, serializableTransactionOptions);

  revalidatePath(`/admin/groups/${groupId}/candidates`);
  revalidatePath(`/admin/groups/${groupId}/candidates/${candidateId}`);
  redirect(
    `/admin/groups/${groupId}/candidates/${candidateId}?section=overview&privacy=anonymized`
  );
}
