import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { CalendarRange, Mail, Plus, Users } from "lucide-react";
import { AdminRole, InterviewRoundStatus, InterviewerStatus } from "@prisma/client";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import {
  createInterviewerAction,
  updateInterviewerStatusAction
} from "@/server/actions/interviewer";
import { createRoundAction, updateRoundAction } from "@/server/actions/project";
import { interviewerStatusLabel, interviewRoundStatusLabel } from "@/lib/status-labels";
type ProjectDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    interviewer?: string;
    round?: string;
  }>;
};
export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: projectId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireProjectPermission(admin, projectId);
  const groupAccessWhere = accessibleGroupWhere(admin);
  const canEditInterviewers = await canAccessProject(admin, projectId, groupSchedulingRoles);
  const canEditRounds = admin.role === AdminRole.SUPER_ADMIN;
  const project = await prisma.interviewProject.findFirstOrThrow({
    where: {
      AND: [{ id: projectId }, accessibleProjectWhere(admin)]
    },
    include: {
      rounds: {
        where: canEditRounds
          ? {}
          : {
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
            ? t(
                "legacy.this_project_is_automatically_generated_from_historical_interview_groups.2325de5b"
              )
            : t(
                "legacy.this_item_is_automatically_generated_from_historical_interview_groups_an.d9d49845"
              ))
        }
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
              href={`/admin/projects/${projectId}/schedule`}
            >
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              {t("legacy.project_schedule.65b44efd")}
            </Link>
            <Link className="text-sm font-medium text-primary" href="/admin/projects">
              {t("legacy.return_to_project_list.bb14d7c4")}
            </Link>
          </div>
        }
      />

      {canEditInterviewers && query.interviewer === "created" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.interviewer_saved.48e99e7d")}
        </InlineNotice>
      ) : null}
      {canEditInterviewers && query.interviewer === "invalid" ? (
        <InlineNotice tone="danger" className="mb-5">
          {t("legacy.the_format_of_the_interviewer_s_name_or_email_is_incorrect.97cb3896")}
        </InlineNotice>
      ) : null}
      {canEditInterviewers && query.interviewer === "activated" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.interviewer_is_enabled.d3e26c8a")}
        </InlineNotice>
      ) : null}
      {canEditInterviewers && query.interviewer === "deactivated" ? (
        <InlineNotice tone="success" className="mb-5">
          {t(
            "legacy.the_interviewer_has_been_deactivated_and_historical_arrangements_are_not.1cbdc32a"
          )}
        </InlineNotice>
      ) : null}
      {query.round === "created" || query.round === "updated" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.the_round_is_saved_and_written_to_the_audit_log.e453d0a2")}
        </InlineNotice>
      ) : null}
      {query.round === "invalid" || query.round === "order-conflict" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.the_round_information_is_invalid_or_the_sorting_number_conflicts_with_ot.ad72dd23"
          )}
        </InlineNotice>
      ) : null}

      <div
        className={`mb-6 grid gap-3 ${canEditInterviewers ? "md:grid-cols-3" : "md:grid-cols-2"}`}
      >
        <MetricCard
          label={t("legacy.round.4890584b")}
          value={project.rounds.length}
          description={t(
            "legacy.only_process_levels_associated_with_authorized_interview_groups_are_coun.a60fd3fc"
          )}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("legacy.interview_groups.e677802f")}
          value={project.groups.length}
          description={t("legacy.only_count_interview_groups_you_have_access_to.7da41e20")}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        {canEditInterviewers ? (
          <MetricCard
            label={t("legacy.interviewers.5e6ecb10")}
            value={interviewers.length}
            description={t(
              "legacy.subsequent_scheduling_conflict_detection_will_use_this_pool.6fcb3a46"
            )}
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
              title={t("legacy.round.4890584b")}
              description={t(
                "legacy.maintain_the_round_sequence_status_and_interview_duration_within_the_pro.4d2608bc"
              )}
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
                    className="rounded-lg border border-border bg-surface-subtle p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {round.orderIndex}. {round.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {round.interviewDurationMinutes
                            ? t("legacy.interview_duration_value0_minutes.8baf6b1c", {
                                value0: round.interviewDurationMinutes
                              })
                            : t("legacy.no_interview_duration_set.47392ccc")}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {t(interviewRoundStatusLabel[round.status])}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("project.roundStats", {
                        groupCount: stats.groupCount,
                        appointmentCount: stats.appointmentCount
                      })}
                    </p>
                    {canEditRounds ? (
                      <details className="mt-3 rounded-md border border-border bg-white p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          {t("legacy.edit_rounds.25cf3c26")}
                        </summary>
                        <form
                          action={updateRoundAction.bind(null, projectId)}
                          className="mt-3 grid gap-3 md:grid-cols-2"
                        >
                          <input type="hidden" name="roundId" value={round.id} />
                          <Input name="name" defaultValue={round.name} required />
                          <Input
                            name="orderIndex"
                            type="number"
                            min={1}
                            defaultValue={round.orderIndex}
                            required
                          />
                          <Input
                            name="interviewDurationMinutes"
                            type="number"
                            min={5}
                            max={480}
                            defaultValue={round.interviewDurationMinutes ?? 30}
                            required
                          />
                          <Select name="status" defaultValue={round.status}>
                            {Object.values(InterviewRoundStatus).map((status) => (
                              <option key={status} value={status}>
                                {t(interviewRoundStatusLabel[status])}
                              </option>
                            ))}
                          </Select>
                          <Textarea
                            name="description"
                            defaultValue={round.description ?? ""}
                            placeholder={t("legacy.round_description.6f455b84")}
                            className="md:col-span-2"
                          />
                          <SubmitButton variant="secondary" className="md:col-span-2">
                            {t("legacy.save_rounds.79f335c1")}
                          </SubmitButton>
                        </form>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {canEditRounds ? (
              <details className="mt-4 rounded-lg border border-dashed border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("legacy.add_new_round.45b908e1")}
                </summary>
                <form
                  action={createRoundAction.bind(null, projectId)}
                  className="mt-4 grid gap-3 md:grid-cols-2"
                >
                  <Input
                    name="name"
                    placeholder={t("legacy.for_example_second_round.5635a7f7")}
                    required
                  />
                  <Input
                    name="orderIndex"
                    type="number"
                    min={1}
                    defaultValue={project.rounds.length + 1}
                    required
                  />
                  <Input
                    name="interviewDurationMinutes"
                    type="number"
                    min={5}
                    max={480}
                    defaultValue={30}
                    required
                  />
                  <Select name="status" defaultValue={InterviewRoundStatus.ACTIVE}>
                    {Object.values(InterviewRoundStatus).map((status) => (
                      <option key={status} value={status}>
                        {t(interviewRoundStatusLabel[status])}
                      </option>
                    ))}
                  </Select>
                  <Textarea
                    name="description"
                    placeholder={t("legacy.round_description.6f455b84")}
                    className="md:col-span-2"
                  />
                  <SubmitButton className="md:col-span-2">
                    {t("legacy.add_new_round.45b908e1")}
                  </SubmitButton>
                </form>
              </details>
            ) : null}
          </Card>

          <Card className="p-5">
            <SectionHeader
              title={t("legacy.associated_interview_groups.07cf1d34")}
              description={t(
                "legacy.the_interview_team_continues_to_be_responsible_for_candidate_entry_and_a.c172efea"
              )}
            />
            <div className="mt-4">
              <TableContainer>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>{t("legacy.interview_groups.e677802f")}</TableHead>
                      <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
                      <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                      <TableHead>{t("legacy.arrange.7ad924a1")}</TableHead>
                      <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
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
                            {t("legacy.check.db8db053")}
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
                title={t("legacy.interviewer_pool.db0d866c")}
                description={t(
                  "legacy.under_the_same_project_you_can_delete_duplicates_by_email_and_update_the.60cf191e"
                )}
              />
              {interviewers.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("legacy.no_interviewer_yet.8ca02825")}
                </p>
              ) : (
                <div className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {interviewers.map((interviewer) => (
                    <div key={interviewer.id} className="px-4 py-3">
                      <p className="font-medium">{interviewer.name}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {interviewer.email}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(interviewerStatusLabel[interviewer.status])}
                      </p>
                      <form
                        action={updateInterviewerStatusAction.bind(null, projectId, interviewer.id)}
                        className="mt-2"
                      >
                        <input
                          type="hidden"
                          name="status"
                          value={
                            interviewer.status === InterviewerStatus.ACTIVE
                              ? InterviewerStatus.INACTIVE
                              : InterviewerStatus.ACTIVE
                          }
                        />
                        <SubmitButton size="sm" variant="secondary">
                          {interviewer.status === InterviewerStatus.ACTIVE
                            ? t("legacy.deactivate.4e6fd0e2")
                            : t("legacy.enable.f4f0ead1")}
                        </SubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader
                title={t("legacy.add_interviewer.214bb9e8")}
                description={t(
                  "legacy.after_saving_you_will_enter_the_interviewer_pool_of_the_current_project.cfaf4173"
                )}
              />
              <form
                action={createInterviewerAction.bind(null, projectId)}
                className="mt-4 grid gap-4"
              >
                <div>
                  <Label htmlFor="interviewerName">{t("legacy.name.50b5b1d2")}</Label>
                  <Input
                    id="interviewerName"
                    name="name"
                    placeholder={t("legacy.for_example_manager_wang.e06d3ce6")}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="interviewerEmail">{t("legacy.email.73075237")}</Label>
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
                  {t("legacy.save_interviewer.bd3cf209")}
                </SubmitButton>
              </form>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
