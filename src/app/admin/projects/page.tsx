import { getServerTranslator } from "@/i18n/server";
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
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};
const projectsPageSize = 25;
export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const { t } = await getServerTranslator();
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
            where: superAdmin
              ? {}
              : {
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
        title={t("legacy.recruitment_projects.3e10026b")}
        description={
          superAdmin
            ? t(
                "legacy.organize_rounds_interview_groups_and_interviewer_pools_by_recruitment_pr.5c04dbea"
              )
            : t(
                "legacy.view_the_corresponding_rounds_and_arrangements_of_your_authorized_interv.5644a915"
              )
        }
        action={
          superAdmin ? (
            <Link
              href="/admin/groups/new"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-teal-800"
            >
              {t("legacy.create_interview_group.b24fbbc5")}
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <MetricCard
          label={t("legacy.project_related_interview_group.77bc1574")}
          value={groupCount}
          description={t("legacy.the_current_list_covers_value0_items.f40633e8", {
            value0: projects.length
          })}
          icon={<BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("legacy.round.4890584b")}
          value={roundCount}
          description={t(
            "legacy.only_rounds_associated_with_authorized_interview_groups_are_counted.1cbdfef6"
          )}
          icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="projectSearch">
            {t("legacy.search_recruitment_projects.be0a3219")}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="projectSearch"
            name="q"
            defaultValue={q}
            placeholder={t(
              "legacy.search_for_a_project_description_interview_group_or_number.92678f6b"
            )}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-11">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("legacy.search.44ce7ae9")}
        </Button>
        {q ? (
          <Link
            href="/admin/projects"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            {t("legacy.clear.bce23772")}
          </Link>
        ) : null}
      </form>

      {projects.length === 0 ? (
        <Card className="p-10 text-center">
          <h3 className="text-lg font-semibold">
            {q
              ? t("legacy.no_matching_items.3cc529ee")
              : t("legacy.there_are_no_recruitment_projects_yet.991fb70e")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {q
              ? t(
                  "legacy.change_a_keyword_or_clear_the_search_criteria_to_view_accessible_items.8b055256"
                )
              : superAdmin
                ? t(
                    "legacy.when_you_create_an_interview_group_the_recruitment_items_and_default_rou.89760ca5"
                  )
                : t(
                    "legacy.there_are_currently_no_recruitment_projects_authorized_to_access.4825a1c7"
                  )}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>{t("legacy.project.79f326be")}</TableHead>
                  <TableHead>{t("legacy.interview_groups.e677802f")}</TableHead>
                  <TableHead>{t("legacy.round.4890584b")}</TableHead>
                  <TableHead>{t("legacy.last_3_interview_groups.fc1f04ba")}</TableHead>
                  <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
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
                        {t("legacy.check.db8db053")}
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
            itemLabel={t("legacy.recruitment_projects.6b9465ff")}
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
