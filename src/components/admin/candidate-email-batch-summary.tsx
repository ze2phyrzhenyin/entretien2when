import { getServerTranslator } from "@/i18n/server";
import type { CandidateEmailDeliveryStatus } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { translateKnownSource, type MessageKey } from "@/i18n/catalogs";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
type CandidateEmailBatchSummaryItem = {
  id: string;
  candidateNameSnapshot: string;
  recipientEmailSnapshot: string;
  ccEmailSnapshots: string[];
  subject: string;
  status: CandidateEmailDeliveryStatus;
  errorMessage?: string | null;
};
type CandidateEmailBatchSummaryProps = {
  deliveries: CandidateEmailBatchSummaryItem[];
};
const statusLabel: Record<CandidateEmailDeliveryStatus, MessageKey> = {
  PENDING: "legacy.entered_the_sending_queue.5f9a343e",
  PROCESSING: "legacy.delivery_in_progress.e4e31751",
  SENT: "legacy.sent.60823aae",
  PREVIEW: "legacy.test_sending_preview.70cea6b9",
  FAILED: "legacy.fail.28384d7a"
};
const statusTone: Record<CandidateEmailDeliveryStatus, BadgeTone> = {
  PENDING: "info",
  PROCESSING: "warning",
  SENT: "success",
  PREVIEW: "info",
  FAILED: "danger"
};
export async function CandidateEmailBatchSummary({ deliveries }: CandidateEmailBatchSummaryProps) {
  const { locale, t } = await getServerTranslator();
  if (deliveries.length === 0) {
    return null;
  }
  return (
    <Card className="mb-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {t("legacy.the_result_of_this_notification_is_sent.a833d986")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "legacy.results_are_only_visible_to_administrators_the_email_body_is_not_written.fa0c5e03"
            )}
          </p>
        </div>
        <Badge tone="neutral">{t("mail.batchCount", { count: deliveries.length })}</Badge>
      </div>
      <TableContainer>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
              <TableHead>{t("legacy.theme.788db1cf")}</TableHead>
              <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
              <TableHead>{t("legacy.reason_for_failure.bb8c4e55")}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {deliveries.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell>
                  <p className="font-medium">{delivery.candidateNameSnapshot}</p>
                  <p className="text-muted-foreground">{delivery.recipientEmailSnapshot}</p>
                  {delivery.ccEmailSnapshots.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("mail.ccList", { emails: delivery.ccEmailSnapshots.join(", ") })}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>{delivery.subject}</TableCell>
                <TableCell>
                  <Badge tone={statusTone[delivery.status]}>
                    {t(statusLabel[delivery.status])}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[320px]">
                  <span className="line-clamp-2 text-muted-foreground">
                    {delivery.errorMessage
                      ? translateKnownSource(locale, delivery.errorMessage)
                      : "-"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
