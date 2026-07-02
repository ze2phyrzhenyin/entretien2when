import type { CandidateEmailDeliveryStatus } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

const statusLabel: Record<CandidateEmailDeliveryStatus, string> = {
  SENT: "已发送",
  PREVIEW: "预览",
  FAILED: "失败"
};

const statusTone: Record<CandidateEmailDeliveryStatus, BadgeTone> = {
  SENT: "success",
  PREVIEW: "info",
  FAILED: "danger"
};

export function CandidateEmailBatchSummary({ deliveries }: CandidateEmailBatchSummaryProps) {
  if (deliveries.length === 0) {
    return null;
  }

  return (
    <Card className="mb-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">本次邮件发送结果</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            结果仅管理员可见。邮件正文不写入审计日志，失败原因只用于排查。
          </p>
        </div>
        <Badge tone="neutral">{deliveries.length} 封</Badge>
      </div>
      <TableContainer>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>候选人</TableHead>
              <TableHead>主题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>失败原因</TableHead>
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
                      抄送：{delivery.ccEmailSnapshots.join("，")}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>{delivery.subject}</TableCell>
                <TableCell>
                  <Badge tone={statusTone[delivery.status]}>{statusLabel[delivery.status]}</Badge>
                </TableCell>
                <TableCell className="max-w-[320px]">
                  <span className="line-clamp-2 text-muted-foreground">
                    {delivery.errorMessage || "-"}
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
