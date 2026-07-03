import Link from "next/link";
import { CandidateStatus } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";

type CandidatesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

const filters = [
  ["", "全部"],
  [CandidateStatus.SUBMITTED, "已提交"],
  [CandidateStatus.PENDING_REVIEW, "修改待审"],
  [CandidateStatus.SCHEDULED, "已安排面试"]
] as const;

export default async function GroupCandidatesPage({ params, searchParams }: CandidatesPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId);

  const q = query.q?.trim() ?? "";
  const status =
    query.status && query.status in CandidateStatus ? (query.status as CandidateStatus) : undefined;
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true }
  });
  const candidates = await prisma.candidate.findMany({
    where: {
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
    },
    orderBy: { updatedAt: "desc" },
    include: {
      activeSubmission: true,
      submissions: {
        where: { status: "PENDING_REVIEW" },
        select: { id: true }
      },
      appointments: {
        where: { status: "SCHEDULED" },
        orderBy: { startAt: "desc" },
        take: 1,
        select: {
          id: true,
          startAt: true,
          endAt: true
        }
      },
      adminNotes: {
        select: { id: true }
      }
    }
  });

  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="candidates" />
      <PageHeader
        title={`${group.name} · 候选人`}
        description="搜索候选人，查看备注、修改审核和面试安排状态。"
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
                  <TableHead>候选人备注</TableHead>
                  <TableHead>管理员跟进备注</TableHead>
                  <TableHead>操作</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell>
                      <p className="font-medium">{candidate.name}</p>
                      <p className="text-muted-foreground">{candidate.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge kind="candidate" status={candidate.status} />
                        {candidate.submissions.length > 0 ? (
                          <Badge tone="warning">待审核</Badge>
                        ) : null}
                        {candidate.appointments.length > 0 ? (
                          <Badge tone="primary">已安排</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {candidate.activeSubmission?.candidateNote ? (
                        <Badge tone="primary">有备注</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {candidate.adminNotes.length > 0 ? (
                        <Badge tone="warning">有跟进备注</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${groupId}/candidates/${candidate.id}`}
                      >
                        查看
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}
    </AdminShell>
  );
}
