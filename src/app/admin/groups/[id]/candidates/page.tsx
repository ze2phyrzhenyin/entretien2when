import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { CandidateStatus, type Prisma } from "@prisma/client";
import { CandidateEmailComposer } from "@/components/admin/candidate-email-composer";
import { CandidateEmailBatchSummary } from "@/components/admin/candidate-email-batch-summary";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/pagination-nav";
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
import { getCandidateEmailTemplates } from "@/lib/mail/email-template-store";
import { getGroupCapabilities, requireGroupPermission } from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
import type { MessageKey } from "@/i18n/catalogs";
import { normalizeLocale } from "@/i18n/config";
type CandidatesPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    mail?: string;
    mailCount?: string;
    mailBatch?: string;
  }>;
};
const candidatesPageSize = 50;
const filters: ReadonlyArray<readonly ["" | CandidateStatus, MessageKey]> = [
  ["", "legacy.all.5c55a679"],
  [CandidateStatus.SUBMITTED, "legacy.submitted.bc37a611"],
  [CandidateStatus.PENDING_REVIEW, "legacy.modification_pending_review.cc12a4bf"],
  [CandidateStatus.SCHEDULED, "legacy.interview_arranged.c7cf9fba"]
];
export default async function GroupCandidatesPage({ params, searchParams }: CandidatesPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const q = query.q?.trim() ?? "";
  const status =
    query.status && query.status in CandidateStatus ? (query.status as CandidateStatus) : undefined;
  const candidateWhere: Prisma.CandidateWhereInput = {
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
  };
  const [group, totalCandidateCount] = await Promise.all([
    prisma.interviewGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true, timezone: true }
    }),
    prisma.candidate.count({ where: candidateWhere })
  ]);
  const pagination = createPagination({
    page: query.page,
    pageSize: candidatesPageSize,
    totalCount: totalCandidateCount
  });
  const candidates = await prisma.candidate.findMany({
    where: candidateWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      preferredLocale: true
    }
  });
  const candidateIds = candidates.map((candidate) => candidate.id);
  const candidateCareRecords = capabilities.canManageCandidates
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds }, groupId },
        select: {
          id: true,
          activeSubmission: {
            select: { candidateNote: true }
          },
          adminNotes: {
            select: { id: true }
          }
        }
      })
    : [];
  const candidateReviewRecords = capabilities.canReview
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds }, groupId },
        select: {
          id: true,
          submissions: {
            where: { status: "PENDING_REVIEW" },
            select: { id: true }
          }
        }
      })
    : [];
  const candidateSchedulingRecords = capabilities.canSchedule
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds }, groupId },
        select: {
          id: true,
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
          }
        }
      })
    : [];
  const candidateCareById = new Map(
    candidateCareRecords.map((candidate) => [candidate.id, candidate])
  );
  const candidateReviewById = new Map(
    candidateReviewRecords.map((candidate) => [candidate.id, candidate])
  );
  const candidateSchedulingById = new Map(
    candidateSchedulingRecords.map((candidate) => [candidate.id, candidate])
  );
  const localizedEmailTemplates = capabilities.canSchedule
    ? await Promise.all([
        getCandidateEmailTemplates("zh-CN"),
        getCandidateEmailTemplates("en")
      ]).then(([zh, en]) => ({ "zh-CN": zh, en }))
    : null;
  const batchDeliveries =
    capabilities.canSchedule && query.mailBatch
      ? await prisma.candidateEmailDelivery.findMany({
          where: { groupId, batchId: query.mailBatch },
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
  const mailCount = Number(query.mailCount ?? 0);
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="candidates" capabilities={capabilities} />
      <PageHeader
        title={t("legacy.value0_candidate.4b66b32d", { value0: group.name })}
        description={
          capabilities.canManageCandidates
            ? t(
                "legacy.search_for_candidates_view_notes_modify_review_and_interview_scheduling_.5cd257af",
                { value0: candidates.length, value1: totalCandidateCount }
              )
            : t(
                "legacy.only_view_candidate_basic_information_and_status_currently_displaying_va.39aeeeb5",
                { value0: candidates.length, value1: totalCandidateCount }
              )
        }
      />

      <Card className="mb-5 p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <Input
            name="q"
            placeholder={t("legacy.search_name_or_email.b0caa065")}
            defaultValue={q}
          />
          <Select name="status" defaultValue={status ?? ""}>
            {filters.map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </Select>
          <Button type="submit" size="lg">
            {t("legacy.search.44ce7ae9")}
          </Button>
        </form>
      </Card>

      {capabilities.canSchedule && query.mail === "queued" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("mail.queuedSummary", { count: mailCount })}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.please_fill_in_the_subject_and_body_of_the_email_and_confirm_before_send.484b1d72"
          )}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule ? (
        <CandidateEmailBatchSummary deliveries={batchDeliveries} />
      ) : null}

      {candidates.length === 0 ? (
        <EmptyState
          title={t("legacy.no_candidates_yet.14fa20ab")}
          description={t(
            "legacy.candidates_will_appear_here_after_submitting_their_availability_via_inte.597bbbcf"
          )}
        />
      ) : (
        <div className="space-y-5">
          {capabilities.canSchedule && localizedEmailTemplates ? (
            <CandidateEmailComposer
              groupId={groupId}
              groupName={group.name}
              returnTo={`/admin/groups/${groupId}/candidates`}
              templates={localizedEmailTemplates["zh-CN"]}
              localizedTemplates={localizedEmailTemplates}
              mode="table"
              candidates={candidates.map((candidate) => {
                const locale = normalizeLocale(candidate.preferredLocale);
                const appointment = candidateSchedulingById.get(candidate.id)?.appointments[0];
                const context = buildAppointmentEmailContext(appointment, group.timezone, locale);
                return {
                  id: candidate.id,
                  name: candidate.name,
                  email: candidate.email,
                  status: candidate.status,
                  hasScheduledAppointment: Boolean(appointment),
                  appointmentTime: context.appointmentTime,
                  meetingLocation: context.meetingLocation,
                  candidateMessage: context.candidateMessage,
                  preferredLocale: locale
                };
              })}
            />
          ) : null}
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                  <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
                  {capabilities.canManageCandidates ? (
                    <TableHead>{t("legacy.candidate_notes.23fc9983")}</TableHead>
                  ) : null}
                  {capabilities.canManageCandidates ? (
                    <TableHead>{t("legacy.administrator_follow_up_notes.a49ca10e")}</TableHead>
                  ) : null}
                  {capabilities.canManageCandidates ? (
                    <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
                  ) : null}
                </tr>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const candidateCare = candidateCareById.get(candidate.id);
                  const candidateReview = candidateReviewById.get(candidate.id);
                  const candidateScheduling = candidateSchedulingById.get(candidate.id);
                  return (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-muted-foreground">{candidate.email}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge kind="candidate" status={candidate.status} />
                          {candidateReview?.submissions.length ? (
                            <Badge tone="warning">{t("legacy.pending_review.7bf25421")}</Badge>
                          ) : null}
                          {candidateScheduling?.appointments.length ? (
                            <Badge tone="primary">{t("legacy.scheduled.2fcab8f6")}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      {capabilities.canManageCandidates ? (
                        <TableCell>
                          {candidateCare?.activeSubmission?.candidateNote ? (
                            <Badge tone="primary">{t("legacy.there_are_notes.814998cd")}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      ) : null}
                      {capabilities.canManageCandidates ? (
                        <TableCell>
                          {candidateCare?.adminNotes.length ? (
                            <Badge tone="warning">
                              {t("legacy.there_are_follow_up_notes.d9c8bb0a")}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      ) : null}
                      {capabilities.canManageCandidates ? (
                        <TableCell>
                          <Link
                            className="font-medium text-primary"
                            href={`/admin/groups/${groupId}/candidates/${candidate.id}`}
                          >
                            {t("legacy.check.db8db053")}
                          </Link>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationNav
            pathname={`/admin/groups/${groupId}/candidates`}
            searchParams={{ q: q || undefined, status: status ?? undefined }}
            itemLabel={t("legacy.candidates.ff2a04ff")}
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
