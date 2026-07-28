import { AuditActorType } from "@prisma/client";
import { getCurrentAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, groupCandidateCareRoles } from "@/lib/permissions/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  const [{ id: groupId, candidateId }, admin] = await Promise.all([params, getCurrentAdmin()]);
  if (!admin) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await canAccessGroup(admin, groupId, groupCandidateCareRoles))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, groupId },
    include: {
      submissions: {
        include: {
          slots: {
            include: {
              slot: {
                select: { startAt: true, endAt: true, status: true }
              }
            }
          }
        },
        orderBy: { versionNo: "asc" }
      },
      appointments: {
        include: {
          interviewers: {
            include: {
              interviewer: {
                select: { name: true, email: true }
              }
            }
          }
        },
        orderBy: { startAt: "asc" }
      },
      adminNotes: {
        include: {
          authorAdmin: { select: { displayName: true, email: true } }
        },
        orderBy: { createdAt: "asc" }
      },
      emailDeliveries: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!candidate) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      groupId,
      action: "admin.export_candidate_data",
      entityType: "Candidate",
      entityId: candidateId,
      afterData: { format: "json" }
    }
  });

  return new Response(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        groupId,
        candidate
      },
      null,
      2
    ),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="candidate-${candidateId}.json"`,
        "Content-Type": "application/json; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
