import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { ClipboardCheck, Search } from "lucide-react";
import { CandidateSubmissionStatus, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { accessibleGroupWhere, groupReviewRoles, isSuperAdmin } from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
type AdminReviewsPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};
const reviewsPageSize = 50;
export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const { t } = await getServerTranslator();
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const superAdmin = isSuperAdmin(admin);
  const q = query.q?.trim() ?? "";
  const searchWhere: Prisma.CandidateSubmissionWhereInput = q
    ? {
        OR: [
          { candidateNameSnapshot: { contains: q, mode: "insensitive" } },
          { candidateEmailSnapshot: { contains: q, mode: "insensitive" } },
          { group: { name: { contains: q, mode: "insensitive" } } },
          { group: { groupCode: { contains: q, mode: "insensitive" } } }
        ]
      }
    : {};
  const submissionWhere: Prisma.CandidateSubmissionWhereInput = {
    AND: [
      { status: CandidateSubmissionStatus.PENDING_REVIEW },
      { group: accessibleGroupWhere(admin, groupReviewRoles) },
      searchWhere
    ]
  };
  const totalSubmissionCount = await prisma.candidateSubmission.count({ where: submissionWhere });
  const pagination = createPagination({
    page: query.page,
    pageSize: reviewsPageSize,
    totalCount: totalSubmissionCount
  });
  const submissions = await prisma.candidateSubmission.findMany({
    where: submissionWhere,
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    include: {
      group: {
        select: {
          id: true,
          name: true,
          groupCode: true,
          timezone: true
        }
      },
      candidate: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      slots: {
        select: {
          id: true
        }
      }
    },
    skip: pagination.skip,
    take: pagination.pageSize
  });
  return (
    <AdminShell admin={admin} active="reviews">
      <PageHeader
        title={t("legacy.change_reviews.00df3dfb")}
        description={
          superAdmin
            ? t(
                "legacy.candidates_from_all_interview_groups_will_be_given_time_to_revise_their_.f1efa28d"
              )
            : t(
                "legacy.focus_on_processing_the_available_time_of_candidates_in_the_interview_gr.dbffa9ad"
              )
        }
        action={
          <Badge tone={totalSubmissionCount > 0 ? "warning" : "neutral"}>
            {t("review.pendingCount", { count: totalSubmissionCount })}
          </Badge>
        }
      />

      <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <label className="sr-only" htmlFor="reviewSearch">
            {t("legacy.search_review_application.0503422d")}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reviewSearch"
            name="q"
            defaultValue={q}
            placeholder={t(
              "legacy.search_candidates_email_addresses_interview_groups_or_numbers.2c8fec3f"
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
            href="/admin/reviews"
            className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            {t("legacy.clear.bce23772")}
          </Link>
        ) : null}
      </form>

      {submissions.length === 0 ? (
        <EmptyState
          title={
            q
              ? t("legacy.no_matching_modification_request.9e63eef1")
              : t("legacy.no_changes_pending_review.31fb17be")
          }
          description={
            q
              ? t(
                  "legacy.change_a_keyword_or_clear_the_search_criteria_to_view_all_pending_modifi.dcd6e42a"
                )
              : t(
                  "legacy.after_the_candidate_submits_the_modification_application_it_will_be_disp.83e6899c"
                )
          }
          icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table className="min-w-[980px]">
              <TableHeader>
                <tr>
                  <TableHead>{t("legacy.interview_groups.e677802f")}</TableHead>
                  <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                  <TableHead>{t("legacy.version.5f76b2bf")}</TableHead>
                  <TableHead>{t("legacy.select_quantity.da4c9867")}</TableHead>
                  <TableHead>{t("legacy.submission_time.6bc352ca")}</TableHead>
                  <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${submission.group.id}/settings`}
                      >
                        {submission.group.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {submission.group.groupCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{submission.candidate.name}</p>
                      <p className="text-muted-foreground">{submission.candidate.email}</p>
                    </TableCell>
                    <TableCell>
                      {t("submission.versionLabel", { version: submission.versionNo })}
                    </TableCell>
                    <TableCell>{submission.slots.length}</TableCell>
                    <TableCell>
                      <ZonedDateTime
                        value={submission.submittedAt.toISOString()}
                        defaultTimezone={submission.group.timezone}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${submission.group.id}/reviews/${submission.id}`}
                      >
                        {t("legacy.review.948c5c16")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationNav
            pathname="/admin/reviews"
            searchParams={{ q: q || undefined }}
            itemLabel={t("legacy.pending_applications.6bfb7af9")}
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
