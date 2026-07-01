import Link from "next/link";
import { CandidateStatus } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";

type CandidatesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
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
        select: { id: true }
      },
      adminNotes: {
        select: { id: true }
      }
    }
  });

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="candidates" />
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{group.name} · 候选人</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          搜索候选人，查看备注状态、修改待审和预约状态。
        </p>
      </div>

      <Card className="mb-5 p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <Input name="q" placeholder="搜索姓名或邮箱" defaultValue={q} />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-11 rounded-md border border-border bg-white px-3 text-sm"
          >
            {filters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            搜索
          </button>
        </form>
      </Card>

      {candidates.length === 0 ? (
        <EmptyState
          title="暂无候选人"
          description="候选人通过组编号提交可用时间后，会出现在这里。"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">候选人</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">候选人备注</th>
                <th className="px-4 py-3">管理员私有备注</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{candidate.name}</p>
                    <p className="text-muted-foreground">{candidate.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={candidate.status === "SCHEDULED" ? "success" : "neutral"}>
                        {candidate.status}
                      </Badge>
                      {candidate.submissions.length > 0 ? (
                        <Badge tone="warning">待审核</Badge>
                      ) : null}
                      {candidate.appointments.length > 0 ? (
                        <Badge tone="primary">已预约</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {candidate.activeSubmission?.candidateNote ? (
                      <Badge tone="primary">有备注</Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {candidate.adminNotes.length > 0 ? (
                      <Badge tone="warning">有私有备注</Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${groupId}/candidates/${candidate.id}`}
                    >
                      查看
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
