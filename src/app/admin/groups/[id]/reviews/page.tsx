import Link from "next/link";
import { CandidateSubmissionStatus } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";

type ReviewsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReviewsPage({ params }: ReviewsPageProps) {
  const { id: groupId } = await params;
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId, "canReviewModifications");

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true }
  });
  const submissions = await prisma.candidateSubmission.findMany({
    where: {
      groupId,
      status: CandidateSubmissionStatus.PENDING_REVIEW
    },
    orderBy: { submittedAt: "asc" },
    include: {
      candidate: true,
      slots: true
    }
  });

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="reviews" />
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">{group.name} · 修改审核</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            审核通过后，新版本才会替换候选人当前有效版本。
          </p>
        </div>
        <Badge tone={submissions.length > 0 ? "warning" : "neutral"}>
          {submissions.length} 个待审核
        </Badge>
      </div>

      {submissions.length === 0 ? (
        <EmptyState title="没有待审核修改" description="候选人提交修改申请后，会出现在这里。" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">候选人</th>
                <th className="px-4 py-3">版本</th>
                <th className="px-4 py-3">选择数量</th>
                <th className="px-4 py-3">提交时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{submission.candidate.name}</p>
                    <p className="text-muted-foreground">{submission.candidate.email}</p>
                  </td>
                  <td className="px-4 py-3">版本 {submission.versionNo}</td>
                  <td className="px-4 py-3">{submission.slots.length}</td>
                  <td className="px-4 py-3">{submission.submittedAt.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${groupId}/reviews/${submission.id}`}
                    >
                      审核
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
