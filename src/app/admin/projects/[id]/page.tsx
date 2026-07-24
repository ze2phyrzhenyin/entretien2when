import Link from "next/link";
import { Mail, Plus, Users } from "lucide-react";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { MetricCard } from "@/components/design-system/metric-card";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
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
import {
  accessibleGroupWhere,
  accessibleProjectWhere,
  canAccessProject,
  groupSchedulingRoles,
  requireProjectPermission
} from "@/lib/permissions/admin";
import { createInterviewerAction } from "@/server/actions/interviewer";

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ interviewer?: string }>;
};

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const [{ id: projectId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireProjectPermission(admin, projectId);
  const groupAccessWhere = accessibleGroupWhere(admin);
  const canEditInterviewers = await canAccessProject(admin, projectId, groupSchedulingRoles);

  const project = await prisma.interviewProject.findFirstOrThrow({
    where: {
      AND: [{ id: projectId }, accessibleProjectWhere(admin)]
    },
    include: {
      rounds: {
        where: {
          groups: {
            some: groupAccessWhere
          }
        },
        orderBy: { orderIndex: "asc" }
      },
      groups: {
        where: groupAccessWhere,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          roundId: true,
          name: true,
          status: true,
          _count: {
            select: {
              candidates: true,
              appointments: true
            }
          }
        }
      }
    }
  });
  const interviewers = canEditInterviewers
    ? await prisma.interviewer.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" }
      })
    : [];

  const roundStats = new Map(
    project.rounds.map((round) => [round.id, { groupCount: 0, appointmentCount: 0 }])
  );
  for (const group of project.groups) {
    if (!group.roundId) {
      continue;
    }

    const stats = roundStats.get(group.roundId);
    if (stats) {
      stats.groupCount += 1;
      stats.appointmentCount += group._count.appointments;
    }
  }

  return (
    <AdminShell admin={admin} active="projects">
      <PageHeader
        title={project.name}
        description={
          project.publicDescription ??
          (canEditInterviewers
            ? "这个项目由历史面试组自动生成，可继续维护轮次和面试官池。"
            : "这个项目由历史面试组自动生成，仅显示你获授权访问的面试组和轮次。")
        }
        action={
          <Link className="text-sm font-medium text-primary" href="/admin/projects">
            返回项目列表
          </Link>
        }
      />

      {canEditInterviewers && query.interviewer === "created" ? (
        <InlineNotice tone="success" className="mb-5">
          面试官已保存。
        </InlineNotice>
      ) : null}
      {canEditInterviewers && query.interviewer === "invalid" ? (
        <InlineNotice tone="danger" className="mb-5">
          面试官姓名或邮箱格式不正确。
        </InlineNotice>
      ) : null}

      <div
        className={`mb-6 grid gap-3 ${canEditInterviewers ? "md:grid-cols-3" : "md:grid-cols-2"}`}
      >
        <MetricCard
          label="轮次"
          value={project.rounds.length}
          description="仅统计获授权面试组关联的流程层级"
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label="面试组"
          value={project.groups.length}
          description="仅统计你可以访问的面试组"
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        {canEditInterviewers ? (
          <MetricCard
            label="面试官"
            value={interviewers.length}
            description="后续排期冲突检测会使用该池"
            icon={<Mail className="h-4 w-4" aria-hidden="true" />}
          />
        ) : null}
      </div>

      <div
        className={
          canEditInterviewers ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" : "space-y-6"
        }
      >
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeader
              title="轮次"
              description="默认轮次会继承面试组时长，后续可扩展为多轮面试流程。"
            />
            <div className="mt-4 space-y-3">
              {project.rounds.map((round) => {
                const stats = roundStats.get(round.id) ?? {
                  groupCount: 0,
                  appointmentCount: 0
                };

                return (
                  <div
                    key={round.id}
                    className="rounded-lg border border-border bg-surface-subtle px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {round.orderIndex}. {round.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {round.interviewDurationMinutes
                            ? `面试时长 ${round.interviewDurationMinutes} 分钟`
                            : "未设置面试时长"}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {round.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      关联 {stats.groupCount} 个获授权面试组，{stats.appointmentCount} 个面试安排
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader
              title="关联面试组"
              description="面试组继续负责候选人入口和可用时间收集。"
            />
            <div className="mt-4">
              <TableContainer>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>面试组</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>候选人</TableHead>
                      <TableHead>安排</TableHead>
                      <TableHead>操作</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {project.groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          <StatusBadge kind="group" status={group.status} />
                        </TableCell>
                        <TableCell>{group._count.candidates}</TableCell>
                        <TableCell>{group._count.appointments}</TableCell>
                        <TableCell>
                          <Link
                            className="font-medium text-primary"
                            href={`/admin/groups/${group.id}/candidates`}
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
          </Card>
        </div>

        {canEditInterviewers ? (
          <div className="space-y-6">
            <Card className="p-5">
              <SectionHeader
                title="面试官池"
                description="同一项目下按邮箱去重，可反复更新姓名。"
              />
              {interviewers.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">还没有面试官。</p>
              ) : (
                <div className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {interviewers.map((interviewer) => (
                    <div key={interviewer.id} className="px-4 py-3">
                      <p className="font-medium">{interviewer.name}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {interviewer.email}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{interviewer.status}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader title="添加面试官" description="保存后会进入当前项目的面试官池。" />
              <form
                action={createInterviewerAction.bind(null, projectId)}
                className="mt-4 grid gap-4"
              >
                <div>
                  <Label htmlFor="interviewerName">姓名</Label>
                  <Input id="interviewerName" name="name" placeholder="例如：王经理" required />
                </div>
                <div>
                  <Label htmlFor="interviewerEmail">邮箱</Label>
                  <Input
                    id="interviewerEmail"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <SubmitButton className="w-full">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  保存面试官
                </SubmitButton>
              </form>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
