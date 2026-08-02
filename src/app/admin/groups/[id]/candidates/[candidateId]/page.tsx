import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { AppointmentStatus, InterviewerStatus } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import { AppointmentEmailFields } from "@/components/admin/appointment-email-fields";
import { AppointmentInterviewerPicker } from "@/components/admin/appointment-interviewer-picker";
import { AppointmentSlotPicker } from "@/components/admin/appointment-slot-picker";
import { CandidateAdminNoteEditor } from "@/components/admin/candidate-admin-note-editor";
import { CandidateEmailBatchSummary } from "@/components/admin/candidate-email-batch-summary";
import { CandidateEmailComposer } from "@/components/admin/candidate-email-composer";
import { CandidateEmailHistory } from "@/components/admin/candidate-email-history";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { TabLink, Tabs, TabsList } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildAppointmentEmailContext } from "@/lib/mail/appointment-email-context";
import { appointmentConfirmedEmailTemplate } from "@/lib/mail/email-templates";
import {
  getCandidateEmailTemplates,
  getDefaultEmailTemplate
} from "@/lib/mail/email-template-store";
import { normalizeLocale } from "@/i18n/config";
import {
  getGroupCapabilities,
  groupCandidateCareRoles,
  isSuperAdmin,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { candidateSubmissionStatusLabel, candidateSubmissionTypeLabel } from "@/lib/status-labels";
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
  scheduleAppointmentAction
} from "@/server/actions/appointment";
import { upsertCandidateAdminNoteAction } from "@/server/actions/admin-note";
import { anonymizeCandidateAction } from "@/server/actions/candidate-data";
type CandidateDetailPageProps = {
  params: Promise<{
    id: string;
    candidateId: string;
  }>;
  searchParams: Promise<{
    review?: string;
    mail?: string;
    mailCount?: string;
    mailFailed?: string;
    mailDryRun?: string;
    mailBatch?: string;
    appointment?: string;
    privacy?: string;
    section?: string;
  }>;
};
export default async function CandidateDetailPage({
  params,
  searchParams
}: CandidateDetailPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId, candidateId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupCandidateCareRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const requestedSection = query.section;
  const section =
    requestedSection === "scheduling" && capabilities.canSchedule
      ? "scheduling"
      : requestedSection === "email" && capabilities.canSchedule
        ? "email"
        : requestedSection === "history"
          ? "history"
          : "overview";
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      timezone: true,
      projectId: true
    }
  });
  const projectInterviewers =
    capabilities.canSchedule && group.projectId
      ? await prisma.interviewer.findMany({
          where: {
            projectId: group.projectId,
            status: InterviewerStatus.ACTIVE
          },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: {
            id: true,
            name: true,
            email: true
          }
        })
      : [];
  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { id: candidateId, groupId },
    select: {
      id: true,
      name: true,
      email: true,
      preferredLocale: true,
      status: true,
      activeSubmission: {
        select: {
          candidateNote: true,
          slots: {
            select: {
              slot: {
                select: {
                  id: true,
                  startAt: true,
                  endAt: true,
                  status: true,
                  activeLock: {
                    select: { id: true }
                  }
                }
              }
            }
          }
        }
      },
      submissions: {
        orderBy: { versionNo: "desc" },
        take: 20,
        select: {
          id: true,
          versionNo: true,
          status: true,
          submissionType: true,
          slots: {
            select: {
              slot: {
                select: {
                  id: true,
                  startAt: true,
                  endAt: true
                }
              }
            }
          }
        }
      },
      adminNotes: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          body: true,
          authorAdminId: true,
          authorAdmin: {
            select: { displayName: true }
          }
        }
      }
    }
  });
  const schedulingData = capabilities.canSchedule
    ? await prisma.candidate.findFirstOrThrow({
        where: { id: candidateId, groupId },
        select: {
          appointments: {
            where: { status: AppointmentStatus.SCHEDULED },
            orderBy: { startAt: "desc" },
            take: 1,
            select: {
              id: true,
              startAt: true,
              endAt: true,
              meetingLocation: true,
              candidateVisibleMessage: true,
              internalNote: true,
              slots: {
                select: { slotId: true }
              },
              interviewers: {
                include: {
                  interviewer: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          },
          emailDeliveries: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              subject: true,
              ccEmailSnapshots: true,
              status: true,
              idempotencyKey: true,
              providerMessageId: true,
              errorMessage: true,
              createdAt: true,
              retriedFromId: true,
              locale: true,
              sentByAdmin: {
                select: { displayName: true, email: true }
              }
            }
          }
        }
      })
    : null;
  const batchDeliveries =
    capabilities.canSchedule && query.mailBatch
      ? await prisma.candidateEmailDelivery.findMany({
          where: {
            groupId,
            candidateId,
            batchId: query.mailBatch
          },
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
  const candidateLocale = normalizeLocale(candidate.preferredLocale);
  const emailTemplates = capabilities.canSchedule
    ? await getCandidateEmailTemplates(candidateLocale)
    : [];
  const appointmentEmailTemplate =
    emailTemplates.find((template) => template.key === appointmentConfirmedEmailTemplate.key) ??
    getDefaultEmailTemplate(appointmentConfirmedEmailTemplate.key, candidateLocale) ??
    appointmentConfirmedEmailTemplate;
  const scheduledAppointment = schedulingData?.appointments[0] ?? null;
  const scheduledAppointmentEmailContext = buildAppointmentEmailContext(
    scheduledAppointment,
    group.timezone,
    candidateLocale
  );
  const scheduledAppointmentSlotIds = new Set(
    scheduledAppointment?.slots.map((slot) => slot.slotId) ?? []
  );
  const relevantSchedulingSlotIds = [
    ...new Set([
      ...(candidate.activeSubmission?.slots.map(({ slot }) => slot.id) ?? []),
      ...scheduledAppointmentSlotIds
    ])
  ];
  const scheduledAppointmentInterviewerIds =
    scheduledAppointment?.interviewers.map((assignment) => assignment.interviewerId) ?? [];
  const groupTimeSlots = scheduledAppointment
    ? await prisma.groupTimeSlot.findMany({
        where: { groupId, id: { in: relevantSchedulingSlotIds } },
        orderBy: { startAt: "asc" },
        include: {
          activeLock: {
            select: { id: true, appointmentId: true }
          }
        }
      })
    : [];
  const schedulableSlots =
    candidate.activeSubmission?.slots.filter(
      ({ slot }) => slot.status === "OPEN" && !slot.activeLock
    ) ?? [];
  const ownNote = candidate.adminNotes.find((note) => note.authorAdminId === admin.id);
  const returnTo = `/admin/groups/${groupId}/candidates/${candidateId}?section=email`;
  const mailCount = Number(query.mailCount ?? 0);
  const mailFailed = Number(query.mailFailed ?? 0);
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="candidates" capabilities={capabilities} />
      <PageHeader
        title={candidate.name}
        description={candidate.email}
        action={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/admin/groups/${groupId}/candidates/${candidateId}/export`} download>
                {t("legacy.export_candidate_data.e743f7c5")}
              </Link>
            </Button>
            <Link
              className="text-sm font-medium text-primary"
              href={`/admin/groups/${groupId}/candidates`}
            >
              {t("legacy.return_to_candidate_list.a4fa9630")}
            </Link>
          </>
        }
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      {query.review ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.the_review_operation_has_been_completed.bb184ce5")}
        </InlineNotice>
      ) : null}
      {query.privacy === "anonymized" ? (
        <InlineNotice tone="success" className="mb-5">
          {t(
            "legacy.candidate_identities_free_text_conversations_and_email_content_are_anony.7e04b647"
          )}
        </InlineNotice>
      ) : null}
      {query.privacy === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.the_anonymization_confirmation_text_is_invalid_and_no_data_has_been_modi.31eaf13e"
          )}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "scheduled" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.interview_arrangements_have_been_confirmed.4103ff0d")}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "rescheduled" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.interview_arrangements_have_been_adjusted.8b443663")}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.please_select_consecutive_opening_times_within_the_candidate_s_currently.280bab91"
          )}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.appointment === "conflict" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.the_selected_interviewer_has_an_interview_schedule_at_this_time_please_a.4469a0fc"
          )}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "sent" ? (
        <InlineNotice tone="success" className="mb-5">
          {t(query.mailDryRun ? "mail.sentPreviewSummary" : "mail.sentSummary", {
            count: mailCount
          })}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "queued" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("mail.queuedSummary", { count: mailCount })}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "partial" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t("mail.partialSummary", { sent: mailCount, failed: mailFailed })}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "error" ? (
        <InlineNotice tone="danger" className="mb-5">
          {t(
            "legacy.notification_delivery_failed_please_check_your_server_mailato_configurat.74ea2dc8"
          )}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && query.mail === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.please_fill_in_the_subject_and_body_of_the_email_and_confirm_before_send.484b1d72"
          )}
        </InlineNotice>
      ) : null}
      {capabilities.canSchedule && section === "email" ? (
        <CandidateEmailBatchSummary deliveries={batchDeliveries} />
      ) : null}

      <Tabs className="mb-6">
        <TabsList aria-label={t("legacy.candidate_details_section.6ec5a2a9")}>
          <TabLink
            href={`/admin/groups/${groupId}/candidates/${candidateId}?section=overview`}
            active={section === "overview"}
          >
            {t("legacy.overview_and_notes.fd7e1037")}
          </TabLink>
          {capabilities.canSchedule ? (
            <TabLink
              href={`/admin/groups/${groupId}/candidates/${candidateId}?section=scheduling`}
              active={section === "scheduling"}
            >
              {t("legacy.interview_scheduling.251f5aa5")}
            </TabLink>
          ) : null}
          {capabilities.canSchedule ? (
            <TabLink
              href={`/admin/groups/${groupId}/candidates/${candidateId}?section=email`}
              active={section === "email"}
            >
              {t("legacy.email_notification.2fb23b01")}
            </TabLink>
          ) : null}
          <TabLink
            href={`/admin/groups/${groupId}/candidates/${candidateId}?section=history`}
            active={section === "history"}
          >
            {t("legacy.commit_history.1c8c023b")}
          </TabLink>
        </TabsList>
      </Tabs>

      <div
        className={
          section === "overview"
            ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
            : "max-w-4xl space-y-6"
        }
      >
        <div className="space-y-6">
          {section === "overview" ? (
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">
                  {t("legacy.current_available_time.ad871025")}
                </h3>
                <StatusBadge kind="candidate" status={candidate.status} />
              </div>
              {candidate.activeSubmission ? (
                <>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {candidate.activeSubmission.slots.map(({ slot }) => (
                      <div
                        key={slot.id}
                        className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm"
                      >
                        <p className="font-medium">
                          <ZonedDateTimeRange
                            startAt={slot.startAt.toISOString()}
                            endAt={slot.endAt.toISOString()}
                            defaultTimezone={group.timezone}
                          />
                        </p>
                        {slot.activeLock ? (
                          <p className="mt-1 text-xs text-amber-700">
                            {t("legacy.locked.56cee909")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5">
                    <p className="text-sm font-medium">{t("legacy.candidate_notes.23fc9983")}</p>
                    <p className="mt-2 rounded-md border border-border bg-white p-3 text-sm leading-6 text-muted-foreground">
                      {candidate.activeSubmission.candidateNote ||
                        t("legacy.not_filled_in.7f051905")}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("legacy.there_are_no_valid_submissions_yet.0b58a9c6")}
                </p>
              )}
            </Card>
          ) : null}

          {capabilities.canSchedule && section === "scheduling" ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold">{t("legacy.arrange_an_interview.184593bf")}</h3>
              {scheduledAppointment ? (
                <div className="mt-4 space-y-5">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <ZonedDateTimeRange
                      startAt={scheduledAppointment.startAt.toISOString()}
                      endAt={scheduledAppointment.endAt.toISOString()}
                      defaultTimezone={group.timezone}
                      messageKey="appointment.scheduledAt"
                    />
                    <p className="mt-2 text-xs">
                      {scheduledAppointment.interviewers.length > 0
                        ? t("appointment.interviewers", {
                            names: scheduledAppointment.interviewers
                              .map((assignment) => assignment.interviewer.name)
                              .join(", ")
                          })
                        : t("appointment.interviewersNone")}
                    </p>
                  </div>
                  <details className="group rounded-lg border border-border bg-surface-subtle">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-fast hover:bg-muted [&::-webkit-details-marker]:hidden">
                      <span>{t("legacy.adjust_interview_time.e034863a")}</span>
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="group-open:hidden">
                          {t("legacy.expand_adjustments.383d7c22")}
                        </span>
                        <span className="hidden group-open:inline">
                          {t("legacy.close.afd4b783")}
                        </span>
                        <ChevronDown
                          className="h-4 w-4 transition-transform duration-fast group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </span>
                    </summary>
                    <form
                      action={rescheduleAppointmentAction.bind(
                        null,
                        groupId,
                        candidateId,
                        scheduledAppointment.id
                      )}
                      className="space-y-4 border-t border-border p-4"
                    >
                      <div>
                        <AppointmentSlotPicker
                          defaultTimezone={group.timezone}
                          initiallySelectedSlotIds={[...scheduledAppointmentSlotIds]}
                          slots={groupTimeSlots.map((slot) => {
                            const isCurrentAppointmentSlot = scheduledAppointmentSlotIds.has(
                              slot.id
                            );
                            const lockedByOther = Boolean(
                              slot.activeLock &&
                              slot.activeLock.appointmentId !== scheduledAppointment.id
                            );
                            return {
                              id: slot.id,
                              startAt: slot.startAt.toISOString(),
                              endAt: slot.endAt.toISOString(),
                              status: slot.status,
                              isCurrent: isCurrentAppointmentSlot,
                              lockedByOther
                            };
                          })}
                        />
                      </div>
                      <AppointmentInterviewerPicker
                        projectId={group.projectId}
                        interviewers={projectInterviewers}
                        defaultSelectedInterviewerIds={scheduledAppointmentInterviewerIds}
                      />
                      <FormField
                        id="rescheduleMeetingLocation"
                        label={t("legacy.meeting_location_or_link.fe727e39")}
                      >
                        <Input
                          id="rescheduleMeetingLocation"
                          name="meetingLocation"
                          defaultValue={scheduledAppointment.meetingLocation ?? ""}
                          placeholder={t("legacy.conference_room_tencent_meeting_link.3c4034c7")}
                        />
                      </FormField>
                      <FormField
                        id="rescheduleCandidateVisibleMessage"
                        label={t("legacy.instructions_to_candidates.3768407d")}
                      >
                        <Textarea
                          id="rescheduleCandidateVisibleMessage"
                          name="candidateVisibleMessage"
                          defaultValue={scheduledAppointment.candidateVisibleMessage ?? ""}
                        />
                      </FormField>
                      <FormField
                        id="rescheduleInternalNote"
                        label={t("legacy.internal_notes_visible_only_to_administrators.00bef15d")}
                      >
                        <Textarea
                          id="rescheduleInternalNote"
                          name="internalNote"
                          defaultValue={scheduledAppointment.internalNote ?? ""}
                        />
                      </FormField>
                      <AppointmentEmailFields
                        checkboxLabel={t(
                          "legacy.send_standard_interview_arrangement_notification_after_saving.da65c948"
                        )}
                        template={appointmentEmailTemplate}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <SubmitButton pendingText={t("legacy.saving.570d6020")}>
                          {t("legacy.save_adjustments_and_lock_time.c06c9e67")}
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                  <ConfirmForm
                    action={cancelAppointmentAction.bind(null, groupId, scheduledAppointment.id)}
                    confirmMessage={t(
                      "legacy.are_you_sure_to_cancel_this_interview_and_release_the_corresponding_time.cc501a5f"
                    )}
                  >
                    <SubmitButton variant="danger" pendingText={t("legacy.deleting.16a73a8b")}>
                      {t("legacy.unschedule_and_free_up_time.32c042f6")}
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              ) : schedulableSlots.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t(
                    "legacy.there_are_currently_no_unlocked_times_available_to_schedule_interviews.5db3de6c"
                  )}
                </p>
              ) : (
                <form
                  action={scheduleAppointmentAction.bind(null, groupId, candidateId)}
                  className="mt-4 space-y-4"
                >
                  <AppointmentSlotPicker
                    defaultTimezone={group.timezone}
                    slots={schedulableSlots.map(({ slot }) => ({
                      id: slot.id,
                      startAt: slot.startAt.toISOString(),
                      endAt: slot.endAt.toISOString(),
                      status: slot.status
                    }))}
                  />
                  <AppointmentInterviewerPicker
                    projectId={group.projectId}
                    interviewers={projectInterviewers}
                  />
                  <FormField
                    id="meetingLocation"
                    label={t("legacy.meeting_location_or_link.fe727e39")}
                  >
                    <Input
                      id="meetingLocation"
                      name="meetingLocation"
                      placeholder={t("legacy.conference_room_tencent_meeting_link.3c4034c7")}
                    />
                  </FormField>
                  <FormField
                    id="candidateVisibleMessage"
                    label={t("legacy.instructions_to_candidates.3768407d")}
                  >
                    <Textarea id="candidateVisibleMessage" name="candidateVisibleMessage" />
                  </FormField>
                  <FormField
                    id="internalNote"
                    label={t("legacy.internal_notes_visible_only_to_administrators.00bef15d")}
                  >
                    <Textarea id="internalNote" name="internalNote" />
                  </FormField>
                  <AppointmentEmailFields
                    checkboxLabel={t(
                      "legacy.a_standard_interview_arrangement_notification_will_be_sent_after_the_arr.8c793de0"
                    )}
                    template={appointmentEmailTemplate}
                  />
                  <SubmitButton>
                    {t("legacy.confirm_arrangement_and_lock_in_time.bc989803")}
                  </SubmitButton>
                </form>
              )}
            </Card>
          ) : null}

          {section === "history" ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold">{t("legacy.commit_history.1c8c023b")}</h3>
              <div className="mt-4 space-y-3">
                {candidate.submissions.map((submission) => (
                  <div key={submission.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {t("submission.versionLabel", { version: submission.versionNo })}
                      </span>
                      <Badge tone={submission.status === "ACTIVE" ? "success" : "neutral"}>
                        {t(candidateSubmissionStatusLabel[submission.status])}
                      </Badge>
                      <span className="text-muted-foreground">
                        {t(candidateSubmissionTypeLabel[submission.submissionType])}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {submission.slots.map(({ slot }) => (
                        <span key={slot.id} className="rounded-md bg-slate-50 px-2 py-1">
                          <ZonedDateTimeRange
                            startAt={slot.startAt.toISOString()}
                            endAt={slot.endAt.toISOString()}
                            defaultTimezone={group.timezone}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {section === "overview" ? (
            <>
              <CandidateAdminNoteEditor
                defaultValue={ownNote?.body}
                action={upsertCandidateAdminNoteAction.bind(null, groupId, candidateId)}
                notes={candidate.adminNotes.map((note) => ({
                  id: note.id,
                  body: note.body,
                  authorName: note.authorAdmin.displayName
                }))}
              />
              {isSuperAdmin(admin) ? (
                <Card className="border-red-200 p-6">
                  <h3 className="text-lg font-semibold text-red-800">
                    {t("legacy.privacy_data_processing.310b400c")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t(
                      "legacy.anonymization_removes_candidate_conversations_and_links_deletes_emails_n.7be88753"
                    )}
                  </p>
                  <ConfirmForm
                    className="mt-4 space-y-3"
                    action={anonymizeCandidateAction.bind(null, groupId, candidateId)}
                    confirmMessage={t(
                      "legacy.are_you_sure_you_want_to_permanently_anonymize_this_candidate_s_personal.365fc88e"
                    )}
                  >
                    <FormField
                      id="anonymizeConfirmation"
                      label={t("legacy.enter_anonymize_to_confirm.604594cd")}
                    >
                      <Input
                        id="anonymizeConfirmation"
                        name="confirmation"
                        autoComplete="off"
                        required
                      />
                    </FormField>
                    <SubmitButton variant="danger" pendingText={t("legacy.anonymizing.ca3da616")}>
                      {t("legacy.permanently_anonymize_candidates.7560a96e")}
                    </SubmitButton>
                  </ConfirmForm>
                </Card>
              ) : null}
            </>
          ) : null}
          {capabilities.canSchedule && section === "email" ? (
            <>
              <CandidateEmailComposer
                groupId={groupId}
                groupName={group.name}
                returnTo={returnTo}
                templates={emailTemplates}
                mode="single"
                candidates={[
                  {
                    id: candidate.id,
                    name: candidate.name,
                    email: candidate.email,
                    status: candidate.status,
                    hasScheduledAppointment: Boolean(scheduledAppointment),
                    appointmentTime: scheduledAppointmentEmailContext.appointmentTime,
                    meetingLocation: scheduledAppointmentEmailContext.meetingLocation,
                    candidateMessage: scheduledAppointmentEmailContext.candidateMessage,
                    preferredLocale: candidateLocale
                  }
                ]}
              />
              <CandidateEmailHistory
                groupId={groupId}
                returnTo={returnTo}
                defaultTimezone={group.timezone}
                historyLimit={10}
                deliveries={(schedulingData?.emailDeliveries ?? []).map((delivery) => ({
                  id: delivery.id,
                  subject: delivery.subject,
                  ccEmailSnapshots: delivery.ccEmailSnapshots,
                  status: delivery.status,
                  idempotencyKey: delivery.idempotencyKey,
                  providerMessageId: delivery.providerMessageId,
                  errorMessage: delivery.errorMessage,
                  createdAt: delivery.createdAt,
                  sentByAdminName: delivery.sentByAdmin.displayName,
                  sentByAdminEmail: delivery.sentByAdmin.email,
                  retriedFromId: delivery.retriedFromId,
                  locale: delivery.locale
                }))}
              />
            </>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
