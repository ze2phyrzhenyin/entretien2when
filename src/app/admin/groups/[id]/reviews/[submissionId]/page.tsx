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
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup, requireGroupPermission } from "@/lib/permissions/admin";
import { approveSubmissionAction, rejectSubmissionAction } from "@/server/actions/review";

type ReviewDetailPageProps = {
  params: Promise<{ id: string; submissionId: string }>;
};

export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const { id: groupId, submissionId } = await params;
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }
  await requireGroupPermission(admin, groupId);

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId }
  });
  const submission = await prisma.candidateSubmission.findFirstOrThrow({
    where: { id: submissionId, groupId },
    include: {
      candidate: {
        include: {
          activeSubmission: {
            include: {
              slots: {
                include: { slot: true }
              }
            }
          }
        }
      },
      slots: {
        include: {
          slot: {
            include: {
              activeLock: true
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
      const slot = newSlotById.get(slotId) ?? oldSlotById.get(slotId);
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
          isNew && (slot.status !== "OPEN" || Boolean("activeLock" in slot && slot.activeLock))
            ? "已关闭或已锁定，不能直接通过"
            : null
      };
    }
  );
  const invalidNewSlots = submission.slots.filter(
    ({ slot }) => slot.status !== "OPEN" || Boolean(slot.activeLock)
  );

  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="reviews" />
      <PageHeader
        title="审核修改申请"
        description={`${submission.candidate.name} · 版本 ${submission.versionNo}`}
        action={
          <Link
            className="text-sm font-medium text-primary"
            href={`/admin/groups/${groupId}/reviews`}
          >
            返回审核列表
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
          <h3 className="font-semibold">系统校验</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>审核状态</span>
              <StatusBadge kind="submission" status={submission.status} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>新时间是否可用</span>
              <Badge tone={invalidNewSlots.length === 0 ? "success" : "danger"}>
                {invalidNewSlots.length === 0 ? "可通过" : "不可通过"}
              </Badge>
            </div>
          </div>

          {invalidNewSlots.length > 0 ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-800">
              新版本包含已关闭或已锁定时间，默认不允许通过。请拒绝后让候选人重新提交。
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <form
              action={approveSubmissionAction.bind(null, groupId, submission.id)}
              className="space-y-3"
            >
              <Textarea name="reviewComment" placeholder="审核意见（可选）" />
              <SubmitButton
                disabled={invalidNewSlots.length > 0}
                className="w-full"
                pendingText="正在通过"
              >
                通过修改
              </SubmitButton>
            </form>
            <form
              action={rejectSubmissionAction.bind(null, groupId, submission.id)}
              className="space-y-3"
            >
              <Textarea name="reviewComment" placeholder="拒绝原因（可选）" />
              <Button type="submit" variant="danger" className="w-full">
                拒绝修改
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
