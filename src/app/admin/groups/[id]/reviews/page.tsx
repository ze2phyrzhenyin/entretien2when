import Link from "next/link";
import { CandidateSubmissionStatus } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
  await requireGroupPermission(admin, groupId);

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true, timezone: true }
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
      <GroupNav groupId={groupId} active="reviews" />
      <PageHeader
        title={`${group.name} · 修改审核`}
        description="审核通过后，新版本才会替换候选人当前有效版本。"
        action={
          <Badge tone={submissions.length > 0 ? "warning" : "neutral"}>
            {submissions.length} 个待审核
          </Badge>
        }
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      {submissions.length === 0 ? (
        <EmptyState title="没有待审核修改" description="候选人提交修改申请后，会出现在这里。" />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>候选人</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>选择数量</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead>操作</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <p className="font-medium">{submission.candidate.name}</p>
                    <p className="text-muted-foreground">{submission.candidate.email}</p>
                  </TableCell>
                  <TableCell>版本 {submission.versionNo}</TableCell>
                  <TableCell>{submission.slots.length}</TableCell>
                  <TableCell>
                    <ZonedDateTime
                      value={submission.submittedAt.toISOString()}
                      defaultTimezone={group.timezone}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${groupId}/reviews/${submission.id}`}
                    >
                      审核
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AdminShell>
  );
}
