import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { ReviewComparison, type ReviewSlotChange } from "@/components/admin/review-comparison";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getGroupCapabilities,
  groupReviewRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { approveSubmissionAction, rejectSubmissionAction } from "@/server/actions/review";
type ReviewDetailPageProps = {
  params: Promise<{
    id: string;
    submissionId: string;
  }>;
};
export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const { t } = await getServerTranslator();
  const { id: groupId, submissionId } = await params;
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupReviewRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { timezone: true }
  });
  const submission = await prisma.candidateSubmission.findFirstOrThrow({
    where: { id: submissionId, groupId },
    select: {
      id: true,
      status: true,
      versionNo: true,
      candidateNote: true,
      candidate: {
        select: {
          name: true,
          activeSubmission: {
            select: {
              candidateNote: true,
              slots: {
                select: {
                  slotId: true,
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
          }
        }
      },
      slots: {
        select: {
          slotId: true,
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
  });
  const oldSlotIds = new Set(
    submission.candidate.activeSubmission?.slots.map((item) => item.slotId) ?? []
  );
  const newSlotIds = new Set(submission.slots.map((item) => item.slotId));
  const oldSlotItems =
    submission.candidate.activeSubmission?.slots.map(({ slot }) => ({
      id: slot.id,
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString()
    })) ?? [];
  const oldSlotById = new Map(
    submission.candidate.activeSubmission?.slots.map(({ slot }) => [slot.id, slot]) ?? []
  );
  const newSlotById = new Map(submission.slots.map(({ slot }) => [slot.id, slot]));
  const slotChanges: ReviewSlotChange[] = [...new Set([...oldSlotIds, ...newSlotIds])].map(
    (slotId) => {
      const changedSlot = newSlotById.get(slotId);
      const slot = changedSlot ?? oldSlotById.get(slotId);
      if (!slot) {
        return {
          id: slotId,
          startAt: new Date(0).toISOString(),
          endAt: new Date(0).toISOString(),
          change: "unchanged"
        };
      }
      const isNew = newSlotIds.has(slotId);
      const isOld = oldSlotIds.has(slotId);
      return {
        id: slotId,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        change: isNew && !isOld ? "added" : !isNew && isOld ? "removed" : "unchanged",
        blockedReason:
          isNew && changedSlot && (changedSlot.status !== "OPEN" || Boolean(changedSlot.activeLock))
            ? t("legacy.closed_or_locked_and_cannot_be_passed_directly.055620f7")
            : null
      };
    }
  );
  const invalidNewSlots = submission.slots.filter(
    ({ slot }) => slot.status !== "OPEN" || Boolean(slot.activeLock)
  );
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="reviews" capabilities={capabilities} />
      <PageHeader
        title={t("legacy.review_modification_application.d07fde8d")}
        description={t("legacy.value0_version_value1.3f96ffa2", {
          value0: submission.candidate.name,
          value1: submission.versionNo
        })}
        action={
          <Link
            className="text-sm font-medium text-primary"
            href={`/admin/groups/${groupId}/reviews`}
          >
            {t("legacy.return_to_review_list.8b4410ba")}
          </Link>
        }
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ReviewComparison
          oldSlots={oldSlotItems}
          changes={slotChanges}
          defaultTimezone={group.timezone}
          oldNote={submission.candidate.activeSubmission?.candidateNote}
          newNote={submission.candidateNote}
        />

        <Card className="h-fit p-5">
          <h3 className="font-semibold">{t("legacy.system_check.2e80009b")}</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>{t("legacy.review_status.e3552146")}</span>
              <StatusBadge kind="submission" status={submission.status} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{t("legacy.is_the_new_time_available.574ae0f4")}</span>
              <Badge tone={invalidNewSlots.length === 0 ? "success" : "danger"}>
                {invalidNewSlots.length === 0
                  ? t("legacy.passable.741dfe1f")
                  : t("legacy.not_passable.f841af49")}
              </Badge>
            </div>
          </div>

          {invalidNewSlots.length > 0 ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-800">
              {t(
                "legacy.the_new_version_contains_closed_or_locked_time_and_is_not_allowed_to_pas.5930976c"
              )}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <form
              action={approveSubmissionAction.bind(null, groupId, submission.id)}
              className="space-y-3"
            >
              <Textarea
                name="reviewComment"
                placeholder={t("legacy.review_comments_optional.784aa314")}
              />
              <SubmitButton
                disabled={invalidNewSlots.length > 0}
                className="w-full"
                pendingText={t("legacy.passing.be8fbacc")}
              >
                {t("legacy.by_modifying.2dfaf42e")}
              </SubmitButton>
            </form>
            <ConfirmForm
              action={rejectSubmissionAction.bind(null, groupId, submission.id)}
              className="space-y-3"
              confirmMessage={t(
                "legacy.are_you_sure_to_reject_this_modification_application_candidates_need_to_.aa5091bf"
              )}
            >
              <Textarea
                name="reviewComment"
                placeholder={t("legacy.reason_for_rejection_optional.b4053f9a")}
              />
              <Button type="submit" variant="danger" className="w-full">
                {t("legacy.reject_modification.3fb2a4b9")}
              </Button>
            </ConfirmForm>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
