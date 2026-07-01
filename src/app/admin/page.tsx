import Link from "next/link";
import { CalendarDays, ClipboardList, Plus, Search, Users } from "lucide-react";
import { AdminRole, type Prisma } from "@prisma/client";
import { MetricCard } from "@/components/design-system/metric-card";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";

type AdminDashboardPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const admin = await requireAdmin();
  const accessWhere: Prisma.InterviewGroupWhereInput =
    admin.role === AdminRole.SUPER_ADMIN
      ? {}
      : {
          groupAdmins: {
            some: {
              adminId: admin.id
            }
          }
        };
  const searchWhere: Prisma.InterviewGroupWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { groupCode: { contains: q, mode: "insensitive" } }
        ]
      }
    : {};
  const groups = await prisma.interviewGroup.findMany({
    where: {
      ...accessWhere,
      ...searchWhere
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20,
    include: {
      _count: {
        select: {
          candidates: true,
          appointments: true,
          submissions: true
        }
      }
    }
  });
  const candidateCount = groups.reduce((total, group) => total + group._count.candidates, 0);
  const appointmentCount = groups.reduce((total, group) => total + group._count.appointments, 0);
  const submissionCount = groups.reduce((total, group) => total + group._count.submissions, 0);

  return (
    <AdminShell admin={admin}>
      <PageHeader
        title="面试组"
        description="超级管理员可查看全部组；普通管理员只会看到被授权的面试组。"
        action={
          <Link
            href="/admin/groups/new"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-teal-800 sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            创建面试组
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <MetricCard
          label="候选人"
          value={candidateCount}
          description={`当前列表覆盖 ${groups.length} 个面试组`}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label="提交版本"
          value={submissionCount}
          description="包含当前有效和历史提交"
          icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label="预约"
          value={appointmentCount}
          description="当前可见面试组中的预约数量"
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="groupSearch">
            搜索面试组
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="groupSearch"
            name="q"
            defaultValue={q}
            placeholder="搜索组名称或组编号"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-11">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          搜索
        </Button>
        {q ? (
          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            清除
          </Link>
        ) : null}
      </form>

      {groups.length === 0 ? (
        <Card className="p-10 text-center">
          <h3 className="text-lg font-semibold">{q ? "没有匹配的面试组" : "还没有面试组"}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {q
              ? "换一个关键词，或清除搜索条件后查看全部面试组。"
              : "创建面试组后，系统会自动生成复杂随机组编号并提供候选人链接。"}
          </p>
          {q ? null : (
            <Link
              href="/admin/groups/new"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-teal-800"
            >
              创建第一个面试组
            </Link>
          )}
        </Card>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>组名称</TableHead>
                <TableHead>组编号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>候选人</TableHead>
                <TableHead>预约</TableHead>
                <TableHead>操作</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="font-mono text-xs">{group.groupCode}</TableCell>
                  <TableCell>
                    <StatusBadge kind="group" status={group.status} />
                  </TableCell>
                  <TableCell>{group._count.candidates}</TableCell>
                  <TableCell>{group._count.appointments}</TableCell>
                  <TableCell>
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${group.id}/settings`}
                    >
                      查看
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
