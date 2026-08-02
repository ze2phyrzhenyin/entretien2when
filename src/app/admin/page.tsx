import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { CalendarDays, ClipboardList, Plus, Search, Users } from "lucide-react";
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
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { accessibleGroupWhere, isSuperAdmin } from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
type AdminDashboardPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};
const groupsPageSize = 25;
export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const { t } = await getServerTranslator();
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const admin = await requireAdmin();
  const superAdmin = isSuperAdmin(admin);
  const accessWhere = accessibleGroupWhere(admin);
  const searchWhere: Prisma.InterviewGroupWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { groupCode: { contains: q, mode: "insensitive" } }
        ]
      }
    : {};
  const groupWhere: Prisma.InterviewGroupWhereInput = {
    AND: [accessWhere, searchWhere]
  };
  const totalGroupCount = await prisma.interviewGroup.count({ where: groupWhere });
  const pagination = createPagination({
    page: query.page,
    pageSize: groupsPageSize,
    totalCount: totalGroupCount
  });
  const groups = await prisma.interviewGroup.findMany({
    where: groupWhere,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      },
      round: {
        select: {
          name: true
        }
      },
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
        title={t("legacy.interview_groups.e677802f")}
        description={
          superAdmin
            ? t("legacy.super_administrators_can_view_and_manage_all_interview_groups.cfec5ba6")
            : t("legacy.only_show_interview_groups_you_are_authorized_to_access.e7da875a")
        }
        action={
          superAdmin ? (
            <Link
              href="/admin/groups/new"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-teal-800 sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("legacy.create_interview_group.b24fbbc5")}
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <MetricCard
          label={t("legacy.candidates.ea62aaa5")}
          value={candidateCount}
          description={t("legacy.the_current_list_covers_value0_interview_groups.006fc725", {
            value0: groups.length
          })}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("legacy.commit_version.36a9478e")}
          value={submissionCount}
          description={t("legacy.contains_currently_valid_and_historical_submissions.11ecb8bd")}
          icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("legacy.interviews.2e9d0020")}
          value={appointmentCount}
          description={t("legacy.the_number_of_interviews_scheduled_in_the_current_list.2e236293")}
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="groupSearch">
            {t("legacy.search_interview_group.dcff8f67")}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="groupSearch"
            name="q"
            defaultValue={q}
            placeholder={t("legacy.search_for_interview_group_name_or_number.f4b94c5d")}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-11">
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("legacy.search.44ce7ae9")}
        </Button>
        {q ? (
          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            {t("legacy.clear.bce23772")}
          </Link>
        ) : null}
      </form>

      {groups.length === 0 ? (
        <Card className="p-10 text-center">
          <h3 className="text-lg font-semibold">
            {q
              ? t("legacy.no_matching_interview_group.42c7dc49")
              : t("legacy.no_interview_group_yet.6ea683d5")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {q
              ? t(
                  "legacy.change_a_keyword_or_clear_the_search_criteria_to_view_the_accessible_int.f96866fc"
                )
              : superAdmin
                ? t(
                    "legacy.after_creating_an_interview_group_the_system_will_automatically_generate.48cd05d4"
                  )
                : t("legacy.there_are_currently_no_interview_groups_authorized_to_access.97376b5c")}
          </p>
          {q || !superAdmin ? null : (
            <Link
              href="/admin/groups/new"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-teal-800"
            >
              {t("legacy.create_your_first_interview_group.f15e5c62")}
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 md:hidden">
            {groups.map((group) => (
              <Card key={group.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{group.name}</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {group.groupCode}
                    </p>
                  </div>
                  <StatusBadge kind="group" status={group.status} />
                </div>
                {group.project ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {group.round
                      ? t("dashboard.projectRound", {
                          projectName: group.project.name,
                          roundName: group.round.name
                        })
                      : t("dashboard.projectWithoutRound", {
                          projectName: group.project.name
                        })}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("dashboard.groupCandidateCount", { count: group._count.candidates })}
                  </span>
                  <span>
                    {t("dashboard.groupAppointmentCount", {
                      count: group._count.appointments
                    })}
                  </span>
                  <span>
                    {t("dashboard.groupSubmissionCount", {
                      count: group._count.submissions
                    })}
                  </span>
                </div>
                <Link
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary-soft text-sm font-medium text-primary"
                  href={`/admin/groups/${group.id}/candidates`}
                >
                  {t("legacy.enter_the_interview_group.06dd45d6")}
                </Link>
              </Card>
            ))}
          </div>
          <div className="hidden md:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>{t("legacy.interview_group_name.6ac47fcf")}</TableHead>
                    <TableHead>{t("legacy.project_round.9d456441")}</TableHead>
                    <TableHead>{t("legacy.interview_group_number.56682195")}</TableHead>
                    <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
                    <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                    <TableHead>{t("legacy.interviews.2e9d0020")}</TableHead>
                    <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell className="min-w-48">
                        {group.project ? (
                          <div>
                            <Link
                              href={`/admin/projects/${group.project.id}`}
                              className="font-medium text-primary"
                            >
                              {group.project.name}
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {group.round?.name ?? t("legacy.unassociated_rounds.f21aa45d")}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {t("legacy.no_associated_projects.46062b1a")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{group.groupCode}</TableCell>
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
                          {t("legacy.check.db8db053")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
          <PaginationNav
            pathname="/admin"
            searchParams={{ q: q || undefined }}
            itemLabel={t("legacy.interview_group.f530fc0b")}
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
