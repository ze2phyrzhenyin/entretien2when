import Link from "next/link";
import { ClipboardCheck, Search } from "lucide-react";
import { CandidateSubmissionStatus, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/pagination-nav";
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
import { accessibleGroupWhere, groupReviewRoles, isSuperAdmin } from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";

type AdminReviewsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

const reviewsPageSize = 50;

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const superAdmin = isSuperAdmin(admin);
  const q = query.q?.trim() ?? "";

  const searchWhere: Prisma.CandidateSubmissionWhereInput = q
    ? {
        OR: [
          { candidateNameSnapshot: { contains: q, mode: "insensitive" } },
          { candidateEmailSnapshot: { contains: q, mode: "insensitive" } },
          { group: { name: { contains: q, mode: "insensitive" } } },
          { group: { groupCode: { contains: q, mode: "insensitive" } } }
        ]
      }
    : {};

  const submissionWhere: Prisma.CandidateSubmissionWhereInput = {
    AND: [
      { status: CandidateSubmissionStatus.PENDING_REVIEW },
      { group: accessibleGroupWhere(admin, groupReviewRoles) },
      searchWhere
    ]
  };
  const totalSubmissionCount = await prisma.candidateSubmission.count({ where: submissionWhere });
  const pagination = createPagination({
    page: query.page,
    pageSize: reviewsPageSize,
    totalCount: totalSubmissionCount
  });
  const submissions = await prisma.candidateSubmission.findMany({
    where: submissionWhere,
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    include: {
      group: {
        select: {
          id: true,
          name: true,
          groupCode: true,
          timezone: true
        }
      },
      candidate: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      slots: {
        select: {
          id: true
        }
      }
    },
    skip: pagination.skip,
    take: pagination.pageSize
  });

  return (
    <AdminShell admin={admin} active="reviews">
      <PageHeader
        title="修改审核"
        description={
          superAdmin
            ? "集中处理全部面试组的候选人可用时间修改申请。"
            : "集中处理你有审核权限的面试组候选人可用时间修改申请。"
        }
        action={
          <Badge tone={totalSubmissionCount > 0 ? "warning" : "neutral"}>
            {totalSubmissionCount} 个待审核
          </Badge>
        }
      />

      <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="reviewSearch">
            搜索审核申请
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reviewSearch"
            name="q"
            defaultValue={q}
            placeholder="搜索候选人、邮箱、面试组或编号"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-11">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          搜索
        </Button>
        {q ? (
          <Link
            href="/admin/reviews"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            清除
          </Link>
        ) : null}
      </form>

      {submissions.length === 0 ? (
        <EmptyState
          title={q ? "没有匹配的修改申请" : "暂无待审核修改"}
          description={
            q
              ? "换一个关键词，或清除搜索条件后查看全部待审核修改。"
              : "候选人提交修改申请后，会集中显示在这里。"
          }
          icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table className="min-w-[980px]">
              <TableHeader>
                <tr>
                  <TableHead>面试组</TableHead>
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
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${submission.group.id}/settings`}
                      >
                        {submission.group.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {submission.group.groupCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{submission.candidate.name}</p>
                      <p className="text-muted-foreground">{submission.candidate.email}</p>
                    </TableCell>
                    <TableCell>版本 {submission.versionNo}</TableCell>
                    <TableCell>{submission.slots.length}</TableCell>
                    <TableCell>
                      <ZonedDateTime
                        value={submission.submittedAt.toISOString()}
                        defaultTimezone={submission.group.timezone}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${submission.group.id}/reviews/${submission.id}`}
                      >
                        审核
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationNav
            pathname="/admin/reviews"
            searchParams={{ q: q || undefined }}
            itemLabel="个待审核申请"
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
