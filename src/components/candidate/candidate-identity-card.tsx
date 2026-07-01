import { StatusBadge } from "@/components/design-system/status-badge";
import { Card } from "@/components/ui/card";
import type { CandidateStatus } from "@prisma/client";

export function CandidateIdentityCard({
  name,
  email,
  status,
  hasActiveSubmission,
  hasPendingSubmission
}: {
  name: string;
  email: string;
  status?: CandidateStatus;
  hasActiveSubmission: boolean;
  hasPendingSubmission: boolean;
}) {
  return (
    <Card className="h-fit p-5" variant="flat">
      <p className="text-sm text-muted-foreground">候选人</p>
      <p className="mt-1 text-lg font-semibold">{name}</p>
      <p className="mt-1 break-all text-sm text-muted-foreground">{email}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {status ? (
          <StatusBadge kind="candidate" status={status} />
        ) : (
          <StatusBadge
            kind="custom"
            label={hasActiveSubmission ? "已提交" : "未提交"}
            tone={hasActiveSubmission ? "success" : "warning"}
          />
        )}
        {hasPendingSubmission ? (
          <StatusBadge kind="custom" label="修改审核中" tone="warning" />
        ) : null}
      </div>
    </Card>
  );
}
