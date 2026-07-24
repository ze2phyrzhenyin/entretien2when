import Link from "next/link";
import { CandidateStatus, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
import { getGroupCapabilities, requireGroupPermission } from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";

type CandidatesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

const candidatesPageSize = 50;

const filters = [
  ["", "全部"],
  [CandidateStatus.SUBMITTED, "已提交"],
  [CandidateStatus.PENDING_REVIEW, "修改待审"],
  [CandidateStatus.SCHEDULED, "已安排面试"]
] as const;

export default async function GroupCandidatesPage({ params, searchParams }: CandidatesPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);
  const capabilities = await getGroupCapabilities(admin, groupId);

  const q = query.q?.trim() ?? "";
  const status =
    query.status && query.status in CandidateStatus ? (query.status as CandidateStatus) : undefined;
  const candidateWhere: Prisma.CandidateWhereInput = {
    groupId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const [group, totalCandidateCount] = await Promise.all([
    prisma.interviewGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true }
    }),
    prisma.candidate.count({ where: candidateWhere })
  ]);
  const pagination = createPagination({
    page: query.page,
    pageSize: candidatesPageSize,
    totalCount: totalCandidateCount
  });
  const candidates = await prisma.candidate.findMany({
    where: candidateWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      name: true,
      email: true,
      status: true
    }
  });
  const candidateIds = candidates.map((candidate) => candidate.id);
  const candidateCareRecords = capabilities.canManageCandidates
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds }, groupId },
        select: {
          id: true,
          activeSubmission: {
            select: { candidateNote: true }
          },
          adminNotes: {
            select: { id: true }
          }
        }
      })
    : [];
  const candidateReviewRecords = capabilities.canReview
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds }, groupId },
        select: {
          id: true,
          submissions: {
            where: { status: "PENDING_REVIEW" },
            select: { id: true }
          }
        }
      })
    : [];
  const candidateSchedulingRecords = capabilities.canSchedule
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds }, groupId },
        select: {
          id: true,
          appointments: {
            where: { status: "SCHEDULED" },
            orderBy: { startAt: "desc" },
            take: 1,
            select: { id: true }
          }
        }
      })
    : [];
  const candidateCareById = new Map(
    candidateCareRecords.map((candidate) => [candidate.id, candidate])
  );
  const candidateReviewById = new Map(
    candidateReviewRecords.map((candidate) => [candidate.id, candidate])
  );
  const candidateSchedulingById = new Map(
    candidateSchedulingRecords.map((candidate) => [candidate.id, candidate])
  );

  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="candidates" capabilities={capabilities} />
      <PageHeader
        title={`${group.name} · 候选人`}
        description={
          capabilities.canManageCandidates
            ? `搜索候选人，查看备注、修改审核和面试安排状态。当前显示 ${candidates.length} / ${totalCandidateCount} 位。`
            : `仅查看候选人基本资料和状态。当前显示 ${candidates.length} / ${totalCandidateCount} 位。`
        }
      />

      <Card className="mb-5 p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <Input name="q" placeholder="搜索姓名或邮箱" defaultValue={q} />
          <Select name="status" defaultValue={status ?? ""}>
            {filters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button type="submit" size="lg">
            搜索
          </Button>
        </form>
      </Card>

      {candidates.length === 0 ? (
        <EmptyState
          title="暂无候选人"
          description="候选人通过面试组编号提交可用时间后，会出现在这里。"
        />
      ) : (
        <div className="space-y-5">
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>候选人</TableHead>
                  <TableHead>状态</TableHead>
                  {capabilities.canManageCandidates ? <TableHead>候选人备注</TableHead> : null}
                  {capabilities.canManageCandidates ? <TableHead>管理员跟进备注</TableHead> : null}
                  {capabilities.canManageCandidates ? <TableHead>操作</TableHead> : null}
                </tr>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const candidateCare = candidateCareById.get(candidate.id);
                  const candidateReview = candidateReviewById.get(candidate.id);
                  const candidateScheduling = candidateSchedulingById.get(candidate.id);

                  return (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-muted-foreground">{candidate.email}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge kind="candidate" status={candidate.status} />
                          {candidateReview?.submissions.length ? (
                            <Badge tone="warning">待审核</Badge>
                          ) : null}
                          {candidateScheduling?.appointments.length ? (
                            <Badge tone="primary">已安排</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      {capabilities.canManageCandidates ? (
                        <TableCell>
                          {candidateCare?.activeSubmission?.candidateNote ? (
                            <Badge tone="primary">有备注</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      ) : null}
                      {capabilities.canManageCandidates ? (
                        <TableCell>
                          {candidateCare?.adminNotes.length ? (
                            <Badge tone="warning">有跟进备注</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      ) : null}
                      {capabilities.canManageCandidates ? (
                        <TableCell>
                          <Link
                            className="font-medium text-primary"
                            href={`/admin/groups/${groupId}/candidates/${candidate.id}`}
                          >
                            查看
                          </Link>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationNav
            pathname={`/admin/groups/${groupId}/candidates`}
            searchParams={{ q: q || undefined, status: status ?? undefined }}
            itemLabel="位候选人"
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
