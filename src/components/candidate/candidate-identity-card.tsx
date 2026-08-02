import { getServerTranslator } from "@/i18n/server";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Card } from "@/components/ui/card";
import type { CandidateStatus } from "@prisma/client";
export async function CandidateIdentityCard({
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
  const { t } = await getServerTranslator();
  return (
    <Card className="h-fit p-5" variant="flat">
      <p className="text-sm text-muted-foreground">{t("legacy.candidates.ea62aaa5")}</p>
      <p className="mt-1 text-lg font-semibold">{name}</p>
      <p className="mt-1 break-all text-sm text-muted-foreground">{email}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {status ? (
          <StatusBadge kind="candidate" status={status} />
        ) : (
          <StatusBadge
            kind="custom"
            label={
              hasActiveSubmission
                ? t("legacy.submitted.bc37a611")
                : t("legacy.not_submitted.8032af4a")
            }
            tone={hasActiveSubmission ? "success" : "warning"}
          />
        )}
        {hasPendingSubmission ? (
          <StatusBadge
            kind="custom"
            label={t("legacy.modification_under_review.036f8cd1")}
            tone="warning"
          />
        ) : null}
      </div>
    </Card>
  );
}
