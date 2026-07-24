import type { CandidateEmailDeliveryStatus } from "@prisma/client";
import { RotateCcw } from "lucide-react";
import { AdminOnlyNotice } from "@/components/design-system/admin-only-notice";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { retryCandidateEmailDeliveryAction } from "@/server/actions/email";

type CandidateEmailHistoryItem = {
  id: string;
  subject: string;
  ccEmailSnapshots: string[];
  status: CandidateEmailDeliveryStatus;
  idempotencyKey?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  sentByAdminName: string;
  sentByAdminEmail: string;
  retriedFromId?: string | null;
};

type CandidateEmailHistoryProps = {
  groupId: string;
  returnTo: string;
  defaultTimezone: string;
  deliveries: CandidateEmailHistoryItem[];
  historyLimit?: number;
};

const statusLabel: Record<CandidateEmailDeliveryStatus, string> = {
  PROCESSING: "投递处理中",
  SENT: "已发送",
  PREVIEW: "测试发送预览",
  FAILED: "失败"
};

const statusTone: Record<CandidateEmailDeliveryStatus, BadgeTone> = {
  PROCESSING: "warning",
  SENT: "success",
  PREVIEW: "info",
  FAILED: "danger"
};

export function CandidateEmailHistory({
  groupId,
  returnTo,
  defaultTimezone,
  deliveries,
  historyLimit
}: CandidateEmailHistoryProps) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <div>
          <h3 className="font-semibold">通知发送历史</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {historyLimit
              ? `按发送时间显示最近 ${historyLimit} 条；`
              : "记录该候选人的通知发送结果；"}
            只有带幂等键的失败记录可安全重试。
          </p>
        </div>
      </div>
      <AdminOnlyNotice />
      {deliveries.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="暂无发送记录" description="发送候选人通知后，记录会显示在这里。" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="rounded-lg border border-border bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{delivery.subject}</p>
                    <Badge tone={statusTone[delivery.status]}>{statusLabel[delivery.status]}</Badge>
                    {delivery.retriedFromId ? <Badge tone="neutral">重试发送</Badge> : null}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    <ZonedDateTime
                      value={delivery.createdAt.toISOString()}
                      defaultTimezone={defaultTimezone}
                    />{" "}
                    · {delivery.sentByAdminName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {delivery.providerMessageId
                      ? `服务商消息 ID：${delivery.providerMessageId}`
                      : delivery.sentByAdminEmail}
                  </p>
                  {delivery.ccEmailSnapshots.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      抄送：{delivery.ccEmailSnapshots.join("，")}
                    </p>
                  ) : null}
                </div>
                {delivery.status === "FAILED" && delivery.idempotencyKey ? (
                  <form action={retryCandidateEmailDeliveryAction.bind(null, groupId, delivery.id)}>
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SubmitButton size="sm" variant="secondary" pendingText="重试中">
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      重试
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
              {delivery.errorMessage ? (
                <p className="mt-3 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-danger">
                  {delivery.errorMessage}
                </p>
              ) : null}
              {delivery.status === "PROCESSING" ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-warning">
                  邮件发送结果尚未确认。请先通过服务商日志按该记录核查，避免重复发送。
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
