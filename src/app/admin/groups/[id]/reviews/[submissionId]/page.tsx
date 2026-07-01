import Link from "next/link";
import { CandidateSubmissionStatus } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/date/timezone";
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
  await requireGroupPermission(admin, groupId, "canReviewModifications");

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
  const invalidNewSlots = submission.slots.filter(
    ({ slot }) => slot.status !== "OPEN" || Boolean(slot.activeLock)
  );

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="reviews" />
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">审核修改申请</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {submission.candidate.name} · 版本 {submission.versionNo}
          </p>
        </div>
        <Link
          className="text-sm font-medium text-primary"
          href={`/admin/groups/${groupId}/reviews`}
        >
          返回审核列表
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold">旧版本</h3>
            <p className="mt-1 text-sm text-muted-foreground">当前仍然有效</p>
            <div className="mt-4 space-y-2">
              {submission.candidate.activeSubmission?.slots.map(({ slot }) => (
                <div
                  key={slot.id}
                  className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm"
                >
                  {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                </div>
              )) ?? <p className="text-sm text-muted-foreground">无旧版本</p>}
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium">旧备注</p>
              <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm">
                {submission.candidate.activeSubmission?.candidateNote || "未填写"}
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold">新版本</h3>
            <p className="mt-1 text-sm text-muted-foreground">审核通过后才会生效</p>
            <div className="mt-4 space-y-2">
              {submission.slots.map(({ slot }) => {
                const added = !oldSlotIds.has(slot.id);
                const removed = !newSlotIds.has(slot.id);
                return (
                  <div
                    key={slot.id}
                    className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}</span>
                      {added ? (
                        <Badge tone="primary">新增</Badge>
                      ) : removed ? (
                        <Badge>移除</Badge>
                      ) : null}
                    </div>
                    {slot.activeLock ? (
                      <p className="mt-1 text-xs text-red-700">
                        已锁定：{slot.activeLock.reasonInternal ?? "无公开原因"}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium">新备注</p>
              <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm">
                {submission.candidateNote || "未填写"}
              </p>
            </div>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h3 className="font-semibold">系统校验</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>审核状态</span>
              <Badge
                tone={
                  submission.status === CandidateSubmissionStatus.PENDING_REVIEW
                    ? "warning"
                    : "neutral"
                }
              >
                {submission.status}
              </Badge>
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
              <Button type="submit" disabled={invalidNewSlots.length > 0} className="w-full">
                通过修改
              </Button>
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
