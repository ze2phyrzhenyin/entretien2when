import { getServerTranslator } from "@/i18n/server";
import { GroupTimeSlotStatus, type Prisma } from "@prisma/client";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { AdminSlotLegend } from "@/components/scheduling/slot-legend";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { SubmitButton } from "@/components/ui/submit-button";
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
  groupSchedulingRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
import type { SlotDeletionBlockReason } from "@/lib/business/slot-deletion";
import type { MessageKey } from "@/i18n/catalogs";
import {
  batchGenerateSlotsAction,
  deleteSlotsAction,
  updateSlotStatusAction
} from "@/server/actions/slot";
type SlotsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    slotGenerate?: string;
    slotGenerated?: string;
    slotSkippedGenerate?: string;
    slotDelete?: string;
    slotDeleted?: string;
    slotSkipped?: string;
    page?: string;
  }>;
};
const slotsPageSize = 100;
const slotDeletionReasonKey: Record<SlotDeletionBlockReason, MessageKey> = {
  "candidate-submission-reference": "slotDeletion.reason.candidateSubmission",
  "appointment-reference": "slotDeletion.reason.appointment",
  "active-lock": "slotDeletion.reason.activeLock",
  "lock-history": "slotDeletion.reason.lockHistory"
};
export default async function GroupSlotsPage({ params, searchParams }: SlotsPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const deletableSlotWhere: Prisma.GroupTimeSlotWhereInput = {
    groupId,
    activeLock: { is: null },
    submissionSlots: { none: {} },
    appointmentSlots: { none: {} },
    locks: { none: {} }
  };
  const [group, totalSlotCount, deletableSlotCount] = await Promise.all([
    prisma.interviewGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true, timezone: true }
    }),
    prisma.groupTimeSlot.count({ where: { groupId } }),
    prisma.groupTimeSlot.count({ where: deletableSlotWhere })
  ]);
  const pagination = createPagination({
    page: query.page,
    pageSize: slotsPageSize,
    totalCount: totalSlotCount
  });
  const timeSlots = await prisma.groupTimeSlot.findMany({
    where: { groupId },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      activeLock: {
        include: {
          appointment: {
            select: {
              candidate: { select: { name: true } }
            }
          }
        }
      },
      submissionSlots: {
        select: { id: true }
      },
      appointmentSlots: {
        select: { id: true }
      },
      locks: {
        select: { id: true }
      }
    }
  });
  const deletedCount = Number(query.slotDeleted ?? 0);
  const skippedCount = Number(query.slotSkipped ?? 0);
  const generatedCount = Number(query.slotGenerated ?? 0);
  const skippedGenerateCount = Number(query.slotSkippedGenerate ?? 0);
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="slots" capabilities={capabilities} />
      <PageHeader
        title={t("legacy.opening_hours_configuration.02bdc88b")}
        description={t(
          "legacy.generate_opening_hours_by_interview_group_time_zone_currently_showing_va.7fe36220",
          { value0: timeSlots.length, value1: totalSlotCount }
        )}
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>
      {query.slotGenerate === "generated" ? (
        <InlineNotice tone="success" className="mb-5">
          {t(skippedGenerateCount > 0 ? "slots.generatedWithSkipped" : "slots.generated", {
            generated: generatedCount,
            skipped: skippedGenerateCount
          })}
        </InlineNotice>
      ) : null}
      {query.slotGenerate === "empty" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.no_new_opening_hours_are_generated_please_confirm_that_the_start_and_end.6fca577c"
          )}
        </InlineNotice>
      ) : null}
      {query.slotGenerate === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t("legacy.please_check_the_start_date_end_date_and_start_and_end_times.82c9a91e")}
        </InlineNotice>
      ) : null}
      {query.slotGenerate === "dst" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.the_selected_period_spans_the_daylight_saving_time_switch_and_contains_n.6a86eb54"
          )}
        </InlineNotice>
      ) : null}
      {query.slotDelete === "deleted" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("slots.deleted", { deleted: deletedCount })}
        </InlineNotice>
      ) : null}
      {query.slotDelete === "partial" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t("slots.deletedWithSkipped", {
            deleted: deletedCount,
            skipped: skippedCount
          })}
        </InlineNotice>
      ) : null}
      {query.slotDelete === "blocked" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.there_are_no_opening_hours_to_delete_open_hours_that_have_been_submitted.e60ccc9b"
          )}
        </InlineNotice>
      ) : null}
      {query.slotDelete === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t("legacy.please_select_the_opening_time_first_and_check_delete_to_confirm.56244222")}
        </InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-5">
          <SectionHeader
            title={t("legacy.batch_generation_opening_hours.06539024")}
            description={t("legacy.current_time_zone_value0.f7768ce4", { value0: group.timezone })}
          />
          <form action={batchGenerateSlotsAction.bind(null, groupId)} className="mt-4 space-y-4">
            <FormField id="dateFrom" label={t("legacy.start_date.76050649")}>
              <Input id="dateFrom" name="dateFrom" type="date" required />
            </FormField>
            <FormField id="dateTo" label={t("legacy.end_date.895cd52f")}>
              <Input id="dateTo" name="dateTo" type="date" required />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="startTime" label={t("legacy.start_time.6a9906c7")}>
                <Input id="startTime" name="startTime" type="time" defaultValue="09:00" required />
              </FormField>
              <FormField id="endTime" label={t("legacy.end_time.f5027644")}>
                <Input id="endTime" name="endTime" type="time" defaultValue="18:00" required />
              </FormField>
            </div>
            <SubmitButton className="w-full" pendingText={t("legacy.generating.3424dd50")}>
              {t("legacy.generate_opening_hours.10fdd4fe")}
            </SubmitButton>
          </form>
        </Card>

        <div>
          <div className="mb-4">
            <AdminSlotLegend />
          </div>
          {timeSlots.length === 0 ? (
            <EmptyState
              title={t("legacy.no_opening_hours_yet.ba259fb0")}
              description={t(
                "legacy.please_use_the_form_on_the_left_to_generate_opening_hours_in_batches_fir.b3ebf69e"
              )}
            />
          ) : (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <form
                    id="deleteSlotsForm"
                    action={deleteSlotsAction.bind(null, groupId)}
                    className="space-y-3 rounded-lg border border-border bg-surface-subtle p-3"
                  >
                    <input type="hidden" name="deleteMode" value="selected" />
                    <p className="text-sm font-semibold">
                      {t("legacy.delete_selected_opening_hours.9b65b6b8")}
                    </p>
                    <label className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Checkbox name="confirmDelete" value="yes" />
                      <span>
                        {t(
                          "legacy.i_confirm_deletion_of_selected_and_unreferenced_opening_hours.83ec5f35"
                        )}
                      </span>
                    </label>
                    <Button type="submit" variant="danger" size="sm">
                      {t("legacy.remove_selected.469f67cf")}
                    </Button>
                  </form>
                  <form
                    action={deleteSlotsAction.bind(null, groupId)}
                    className="space-y-3 rounded-lg border border-red-200 bg-danger-soft p-3"
                  >
                    <input type="hidden" name="deleteMode" value="clearAll" />
                    <p className="text-sm font-semibold text-danger">
                      {t("legacy.clear_deletable_opening_hours.cad7f207")}
                    </p>
                    <p className="text-sm leading-6 text-red-800">
                      {t("slots.deletePreview", { count: deletableSlotCount })}
                    </p>
                    <label className="flex items-start gap-2 text-sm text-red-800">
                      <Checkbox name="confirmDelete" value="yes" />
                      <span>
                        {t("legacy.i_confirm_to_clear_all_deletable_opening_hours.2edaf5d5")}
                      </span>
                    </label>
                    <Button type="submit" variant="danger" size="sm">
                      {t("legacy.clear_to_delete.b2712510")}
                    </Button>
                  </form>
                </div>
              </Card>
              <TableContainer>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead className="w-12">{t("legacy.choose.c11330b8")}</TableHead>
                      <TableHead>{t("legacy.available_slots.73199769")}</TableHead>
                      <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
                      <TableHead>{t("legacy.locking.ff9872a0")}</TableHead>
                      <TableHead>{t("legacy.delete.2f9daa82")}</TableHead>
                      <TableHead>{t("legacy.internal_reasons.a0a0b532")}</TableHead>
                      <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {timeSlots.map((slot) => {
                      const blockedReasons = [
                        slot.submissionSlots.length > 0
                          ? ("candidate-submission-reference" as const)
                          : null,
                        slot.appointmentSlots.length > 0
                          ? ("appointment-reference" as const)
                          : null,
                        slot.activeLock ? ("active-lock" as const) : null,
                        slot.locks.length > 0 ? ("lock-history" as const) : null
                      ].filter((reason): reason is SlotDeletionBlockReason => reason !== null);
                      const canDelete = blockedReasons.length === 0;
                      return (
                        <TableRow key={slot.id}>
                          <TableCell>
                            <Checkbox
                              form="deleteSlotsForm"
                              name="slotIds"
                              value={slot.id}
                              disabled={!canDelete}
                              aria-label={t("legacy.select_opening_time_value0.6124224e", {
                                value0: slot.id
                              })}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <ZonedDateTimeRange
                              startAt={slot.startAt.toISOString()}
                              endAt={slot.endAt.toISOString()}
                              defaultTimezone={group.timezone}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge kind="slot" status={slot.status} />
                          </TableCell>
                          <TableCell>
                            {slot.activeLock ? (
                              <StatusBadge kind="slot" status="LOCKED" />
                            ) : (
                              <StatusBadge
                                kind="custom"
                                label={t("legacy.unlocked.8436399d")}
                                tone="neutral"
                              />
                            )}
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            {canDelete ? (
                              <StatusBadge
                                kind="custom"
                                label={t("legacy.can_be_deleted.65f3eb89")}
                                tone="success"
                              />
                            ) : (
                              <div className="space-y-1">
                                <StatusBadge
                                  kind="custom"
                                  label={t("legacy.reserve.670ec25a")}
                                  tone="warning"
                                />
                                <p className="text-xs leading-5 text-warning">
                                  {blockedReasons
                                    .map((reason) => t(slotDeletionReasonKey[reason]))
                                    .join(", ")}
                                </p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs text-muted-foreground">
                            {slot.activeLock?.appointment?.candidate.name
                              ? t("slotLock.appointment", {
                                  candidateName: slot.activeLock.appointment.candidate.name
                                })
                              : (slot.activeLock?.reasonInternal ?? slot.internalNote ?? "-")}
                          </TableCell>
                          <TableCell>
                            <form
                              action={updateSlotStatusAction.bind(
                                null,
                                groupId,
                                slot.id,
                                slot.status === "OPEN"
                                  ? GroupTimeSlotStatus.CLOSED
                                  : GroupTimeSlotStatus.OPEN
                              )}
                            >
                              <Button type="submit" variant="secondary" className="h-8 px-3">
                                {slot.status === "OPEN"
                                  ? t("legacy.close.3fd47edc")
                                  : t("legacy.open.c14c915d")}
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <PaginationNav
                pathname={`/admin/groups/${groupId}/slots`}
                searchParams={{}}
                itemLabel={t("legacy.opening_hours.7c2dd5e0")}
                {...pagination}
              />
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
