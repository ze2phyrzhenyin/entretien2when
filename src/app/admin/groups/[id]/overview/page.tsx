import { getServerTranslator } from "@/i18n/server";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { AdminTimeGrid } from "@/components/scheduling/admin-time-grid";
import { AdminSlotLegend } from "@/components/scheduling/slot-legend";
import type { AdminSlotView } from "@/components/scheduling/types";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getGroupCapabilities,
  groupSchedulingRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { candidateSlotWindowDays, resolveCandidateSlotWindow } from "@/lib/date/slot-window";
type OverviewPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};
export default async function OverviewPage({ params, searchParams }: OverviewPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const groupSummary = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { timezone: true }
  });
  const slotWindow = resolveCandidateSlotWindow({
    from: query.from,
    to: query.to,
    timezone: groupSummary.timezone
  });
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: {
      timezone: true,
      timeSlots: {
        where: {
          startAt: { gte: slotWindow.startAt, lt: slotWindow.endAt }
        },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          activeLock: {
            select: {
              reasonInternal: true,
              appointment: {
                select: { candidate: { select: { name: true } } }
              }
            }
          },
          submissionSlots: {
            where: {
              submission: { status: "ACTIVE" }
            },
            select: {
              candidate: {
                select: { id: true, name: true }
              }
            }
          }
        }
      }
    }
  });
  const slotViews: AdminSlotView[] = group.timeSlots.map((slot) => ({
    id: slot.id,
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
    status: slot.activeLock ? "LOCKED" : slot.status === "CLOSED" ? "CLOSED" : "OPEN",
    availableCandidateCount: slot.submissionSlots.length,
    lockReasonInternal: slot.activeLock?.appointment?.candidate.name
      ? t("slotLock.appointment", {
          candidateName: slot.activeLock.appointment.candidate.name
        })
      : slot.activeLock?.reasonInternal,
    candidates: slot.submissionSlots.map(({ candidate }) => candidate)
  }));
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="overview" capabilities={capabilities} />
      <PageHeader
        title={t("legacy.time_overview.f6298dd3")}
        description={t(
          "legacy.shows_the_number_of_candidates_closing_status_and_lock_reason_for_each_o.00b19355"
        )}
        action={<AdminSlotLegend />}
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>
      <Card className="mb-5 p-4">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            name="from"
            type="date"
            defaultValue={slotWindow.from}
            aria-label={t("legacy.start_date.76050649")}
          />
          <Input
            name="to"
            type="date"
            defaultValue={slotWindow.to}
            aria-label={t("legacy.end_date.895cd52f")}
          />
          <Button type="submit" variant="secondary">
            {t("legacy.check.db8db053")}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("availability.historyWindowLimit", { days: candidateSlotWindowDays })}
        </p>
      </Card>
      {slotWindow.wasAdjusted ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.the_date_range_is_invalid_or_too_long_the_default_window_has_been_restor.f591830c"
          )}
        </InlineNotice>
      ) : null}

      {group.timeSlots.length === 0 ? (
        <EmptyState
          title={t("legacy.no_opening_hours_yet.ba259fb0")}
          description={t(
            "legacy.please_go_to_the_opening_hours_page_to_generate_optional_times_in_batche.2e2b9df0"
          )}
        />
      ) : (
        <AdminTimeGrid slots={slotViews} defaultTimezone={group.timezone} />
      )}
    </AdminShell>
  );
}
