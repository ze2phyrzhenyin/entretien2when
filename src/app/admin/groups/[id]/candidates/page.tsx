import Link from "next/link";
import { CandidateStatus } from "@prisma/client";
import { CandidateEmailBatchSummary } from "@/components/admin/candidate-email-batch-summary";
import { CandidateEmailComposer } from "@/components/admin/candidate-email-composer";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
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
import { buildAppointmentEmailContext } from "@/lib/mail/appointment-email-context";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";

type CandidatesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    mail?: string;
    mailCount?: string;
    mailFailed?: string;
    mailDryRun?: string;
    mailBatch?: string;
  }>;
};

const filters = [
  ["", "全部"],
  [CandidateStatus.SUBMITTED, "已提交"],
  [CandidateStatus.PENDING_REVIEW, "修改待审"],
  [CandidateStatus.SCHEDULED, "已预约"]
] as const;

export default async function GroupCandidatesPage({ params, searchParams }: CandidatesPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId, "canViewCandidates");

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
          endAt: true,
          meetingLocation: true,
          candidateVisibleMessage: true
        }
      },
      adminNotes: {
        select: { id: true }
      },
      emailDeliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          subject: true,
          status: true,
          createdAt: true
        }
      }
    }
  });
  const batchDeliveries = query.mailBatch
    ? await prisma.candidateEmailDelivery.findMany({
        where: {
          groupId,
          batchId: query.mailBatch
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          candidateNameSnapshot: true,
          recipientEmailSnapshot: true,
          ccEmailSnapshots: true,
          subject: true,
          status: true,
          errorMessage: true
        }
      })
    : [];
  const returnTo = `/admin/groups/${groupId}/candidates`;
  const mailCount = Number(query.mailCount ?? 0);
  const mailFailed = Number(query.mailFailed ?? 0);

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="candidates" />
      <PageHeader
        title={`${group.name} · 候选人`}
        description="搜索候选人，查看备注状态、修改待审和预约状态。"
      />

      {query.mail === "sent" ? (
        <InlineNotice tone="success" className="mb-5">
          已发送 {mailCount} 封候选人邮件{query.mailDryRun ? "（dry-run 预览）" : ""}。
        </InlineNotice>
      ) : null}
      {query.mail === "partial" ? (
        <InlineNotice tone="warning" className="mb-5">
          已发送 {mailCount} 封，失败 {mailFailed} 封。请检查 mailato 配置或发送日志。
        </InlineNotice>
      ) : null}
      {query.mail === "error" ? (
        <InlineNotice tone="danger" className="mb-5">
          邮件发送失败。请检查服务器 mailato 配置和发送日志。
        </InlineNotice>
      ) : null}
      {query.mail === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请至少选择一位候选人，填写邮件主题和正文，并确认后再发送。
        </InlineNotice>
      ) : null}
      <CandidateEmailBatchSummary deliveries={batchDeliveries} />

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
          description="候选人通过组编号提交可用时间后，会出现在这里。"
        />
      ) : (
        <div className="space-y-5">
          <CandidateEmailComposer
            groupId={groupId}
            groupName={group.name}
            returnTo={returnTo}
            candidates={candidates.map((candidate) => ({
              id: candidate.id,
              name: candidate.name,
              email: candidate.email,
              status: candidate.status,
              ...buildAppointmentEmailContext(candidate.appointments[0])
            }))}
          />
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>候选人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>候选人备注</TableHead>
                  <TableHead>管理员私有备注</TableHead>
                  <TableHead>最近邮件</TableHead>
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
                          <Badge tone="primary">已预约</Badge>
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
                        <Badge tone="warning">有私有备注</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {candidate.emailDeliveries[0] ? (
                        <div className="space-y-1">
                          <Badge
                            tone={
                              candidate.emailDeliveries[0].status === "FAILED"
                                ? "danger"
                                : candidate.emailDeliveries[0].status === "PREVIEW"
                                  ? "info"
                                  : "success"
                            }
                          >
                            {candidate.emailDeliveries[0].status === "FAILED"
                              ? "失败"
                              : candidate.emailDeliveries[0].status === "PREVIEW"
                                ? "预览"
                                : "已发送"}
                          </Badge>
                          <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                            {candidate.emailDeliveries[0].subject}
                          </p>
                        </div>
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
