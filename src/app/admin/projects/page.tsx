import Link from "next/link";
import { BriefcaseBusiness, Layers3, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { MetricCard } from "@/components/design-system/metric-card";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  accessibleGroupWhere,
  accessibleProjectWhere,
  isSuperAdmin
} from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";

type ProjectsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

const projectsPageSize = 25;

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const admin = await requireAdmin();
  const superAdmin = isSuperAdmin(admin);
  const groupAccessWhere = accessibleGroupWhere(admin);
  const accessWhere = accessibleProjectWhere(admin);
  const matchingGroupWhere: Prisma.InterviewGroupWhereInput = {
    AND: [
      groupAccessWhere,
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { groupCode: { contains: q, mode: "insensitive" } }
        ]
      }
    ]
  };
  const searchWhere: Prisma.InterviewProjectWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { publicDescription: { contains: q, mode: "insensitive" } },
          {
            groups: {
              some: matchingGroupWhere
            }
          }
        ]
      }
    : {};

  const projectWhere: Prisma.InterviewProjectWhereInput = {
    AND: [accessWhere, searchWhere]
  };
  const totalProjectCount = await prisma.interviewProject.count({ where: projectWhere });
  const pagination = createPagination({
    page: query.page,
    pageSize: projectsPageSize,
    totalCount: totalProjectCount
  });
  const projects = await prisma.interviewProject.findMany({
    where: projectWhere,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      groups: {
        where: groupAccessWhere,
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          status: true
        }
      },
      _count: {
        select: {
          rounds: {
            where: {
              groups: {
                some: groupAccessWhere
              }
            }
          },
          groups: {
            where: groupAccessWhere
          }
        }
      }
    }
  });

  const groupCount = projects.reduce((total, project) => total + project._count.groups, 0);
  const roundCount = projects.reduce((total, project) => total + project._count.rounds, 0);

  return (
    <AdminShell admin={admin} active="projects">
      <PageHeader
        title="招聘项目"
        description={
          superAdmin
            ? "按招聘项目组织轮次、面试组和面试官池。历史面试组已自动归入兼容项目。"
            : "按招聘项目查看你获授权面试组对应的轮次和安排。"
        }
        action={
          superAdmin ? (
            <Link
              href="/admin/groups/new"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-teal-800"
            >
              创建面试组
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <MetricCard
          label="项目关联面试组"
          value={groupCount}
          description={`当前列表覆盖 ${projects.length} 个项目`}
          icon={<BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label="轮次"
          value={roundCount}
          description="仅统计获授权面试组关联的轮次"
          icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="projectSearch">
            搜索招聘项目
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="projectSearch"
            name="q"
            defaultValue={q}
            placeholder="搜索项目、说明、面试组或编号"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-11">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          搜索
        </Button>
        {q ? (
          <Link
            href="/admin/projects"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            清除
          </Link>
        ) : null}
      </form>

      {projects.length === 0 ? (
        <Card className="p-10 text-center">
          <h3 className="text-lg font-semibold">{q ? "没有匹配的项目" : "还没有招聘项目"}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {q
              ? "换一个关键词，或清除搜索条件后查看可访问项目。"
              : superAdmin
                ? "创建面试组时会同步创建招聘项目和默认轮次。"
                : "暂时没有获授权访问的招聘项目。"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>项目</TableHead>
                  <TableHead>面试组</TableHead>
                  <TableHead>轮次</TableHead>
                  <TableHead>最近 3 个面试组</TableHead>
                  <TableHead>操作</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="min-w-56">
                      <p className="font-medium">{project.name}</p>
                      {project.publicDescription ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {project.publicDescription}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{project._count.groups}</TableCell>
                    <TableCell>{project._count.rounds}</TableCell>
                    <TableCell className="min-w-64">
                      <div className="space-y-2">
                        {project.groups.map((group) => (
                          <div key={group.id} className="flex items-center gap-2">
                            <StatusBadge kind="group" status={group.status} />
                            <Link
                              href={`/admin/groups/${group.id}/candidates`}
                              className="truncate text-sm font-medium text-primary"
                            >
                              {group.name}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/projects/${project.id}`}
                      >
                        查看
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationNav
            pathname="/admin/projects"
            searchParams={{ q: q || undefined }}
            itemLabel="个招聘项目"
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
