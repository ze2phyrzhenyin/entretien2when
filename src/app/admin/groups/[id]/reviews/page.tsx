import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { CandidateSubmissionStatus } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
  getGroupCapabilities,
  groupReviewRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
type ReviewsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};
const reviewsPageSize = 50;
export default async function ReviewsPage({ params, searchParams }: ReviewsPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupReviewRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true, timezone: true }
  });
  const submissionWhere = {
    groupId,
    status: CandidateSubmissionStatus.PENDING_REVIEW
  } as const;
  const totalSubmissionCount = await prisma.candidateSubmission.count({
    where: submissionWhere
  });
  const pagination = createPagination({
    page: query.page,
    pageSize: reviewsPageSize,
    totalCount: totalSubmissionCount
  });
  const submissions = await prisma.candidateSubmission.findMany({
    where: submissionWhere,
    orderBy: { submittedAt: "asc" },
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      versionNo: true,
      submittedAt: true,
      candidate: {
        select: {
          name: true,
          email: true
        }
      },
      slots: {
        select: { id: true }
      }
    }
  });
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="reviews" capabilities={capabilities} />
      <PageHeader
        title={t("legacy.value0_modification_review.c22bfcc1", { value0: group.name })}
        description={t(
          "legacy.only_after_the_review_is_passed_the_new_version_will_replace_the_candida.d4f01257"
        )}
        action={
          <Badge tone={submissions.length > 0 ? "warning" : "neutral"}>
            {t("review.pendingCount", { count: totalSubmissionCount })}
          </Badge>
        }
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title={t("legacy.no_changes_pending_review.2b175a5a")}
          description={t(
            "legacy.once_a_candidate_submits_a_revision_application_it_will_appear_here.d6471328"
          )}
        />
      ) : (
        <div>
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
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
                        defaultTimezone={group.timezone}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary"
                        href={`/admin/groups/${groupId}/reviews/${submission.id}`}
                      >
                        {t("legacy.review.948c5c16")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <div className="mt-4">
            <PaginationNav
              pathname={`/admin/groups/${groupId}/reviews`}
              searchParams={{}}
              itemLabel={t("legacy.modifications_pending_review.f3888394")}
              {...pagination}
            />
          </div>
        </div>
      )}
    </AdminShell>
  );
}
