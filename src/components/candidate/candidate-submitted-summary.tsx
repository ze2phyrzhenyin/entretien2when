import Link from "next/link";
import { Clock } from "lucide-react";
import { ReviewNotice } from "@/components/design-system/review-notice";
import { Card } from "@/components/ui/card";
import { TimeRangePreview } from "@/components/scheduling/time-range-preview";

export function CandidateSubmittedSummary({
  slots,
  note,
  modifyHref,
  hasPendingSubmission
}: {
  slots: string[];
  note?: string | null;
  modifyHref: string;
  hasPendingSubmission: boolean;
}) {
  return (
    <Card className="p-6" variant="flat">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">当前有效可用时间</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            如需修改，需要提交申请并等待管理员审核。
          </p>
        </div>
        <Link
          href={modifyHref}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-subtle"
        >
          申请修改
        </Link>
      </div>
      <div className="mt-5">
        <TimeRangePreview items={slots} />
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium">候选人备注</p>
        <p className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm leading-6 text-muted-foreground">
          {note || "未填写"}
        </p>
      </div>
      {hasPendingSubmission ? (
        <div className="mt-5">
          <ReviewNotice mode="pending" />
        </div>
      ) : null}
    </Card>
  );
}
