import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { AdminRole, type Prisma } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { interviewGroupStatusLabel } from "@/lib/status-labels";

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

  return (
    <AdminShell admin={admin}>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">面试组</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            超级管理员可查看全部组；普通管理员只会看到被授权的面试组。
          </p>
        </div>
        <Link
          href="/admin/groups/new"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-teal-800 sm:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          创建面试组
        </Link>
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
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">组名称</th>
                <th className="px-4 py-3">组编号</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">候选人</th>
                <th className="px-4 py-3">预约</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{group.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{group.groupCode}</td>
                  <td className="px-4 py-3">{interviewGroupStatusLabel[group.status]}</td>
                  <td className="px-4 py-3">{group._count.candidates}</td>
                  <td className="px-4 py-3">{group._count.appointments}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${group.id}/settings`}
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
