import { Send } from "lucide-react";
import type { CandidateStatus } from "@prisma/client";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { sendCandidateEmailAction } from "@/server/actions/email";

type CandidateEmailTarget = {
  id: string;
  name: string;
  email: string;
  status?: CandidateStatus;
};

type CandidateEmailComposerProps = {
  groupId: string;
  candidates: CandidateEmailTarget[];
  returnTo: string;
  mode?: "table" | "single";
};

const defaultBody =
  "你好 {name}，\n\n这里是 {groupName} 面试安排通知。\n\n请查看你的面试时间或按要求回复。\n\n谢谢。";

export function CandidateEmailComposer({
  groupId,
  candidates,
  returnTo,
  mode = "table"
}: CandidateEmailComposerProps) {
  const isSingle = mode === "single";

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Send className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold">发送候选人邮件</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            系统会逐位候选人单独发送，批量发送时收件人之间互不可见。
          </p>
        </div>
      </div>
      <InlineNotice tone="info" className="mb-4">
        可在正文中使用 {"{name}"}、{"{email}"}、{"{groupName}"} 自动替换候选人信息。
      </InlineNotice>
      <form action={sendCandidateEmailAction.bind(null, groupId)} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        {isSingle
          ? candidates.map((candidate) => (
              <input key={candidate.id} type="hidden" name="candidateIds" value={candidate.id} />
            ))
          : null}
        <FormField id={isSingle ? "singleEmailSubject" : "bulkEmailSubject"} label="邮件主题">
          <Input
            id={isSingle ? "singleEmailSubject" : "bulkEmailSubject"}
            name="subject"
            placeholder="例如：面试安排通知"
            maxLength={160}
            required
          />
        </FormField>
        <FormField id={isSingle ? "singleEmailBody" : "bulkEmailBody"} label="邮件正文">
          <Textarea
            id={isSingle ? "singleEmailBody" : "bulkEmailBody"}
            name="body"
            defaultValue={defaultBody}
            rows={8}
            required
          />
        </FormField>

        {!isSingle ? (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">选择收件人</p>
            <TableContainer>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead className="w-12">选择</TableHead>
                    <TableHead>候选人</TableHead>
                    <TableHead>状态</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <Checkbox
                          name="candidateIds"
                          value={candidate.id}
                          aria-label={`选择 ${candidate.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-muted-foreground">{candidate.email}</p>
                      </TableCell>
                      <TableCell>
                        {candidate.status ? (
                          <StatusBadge kind="candidate" status={candidate.status} />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm">
            <p className="font-medium">{candidates[0]?.name}</p>
            <p className="text-muted-foreground">{candidates[0]?.email}</p>
          </div>
        )}

        <div className="flex justify-end">
          <SubmitButton>{isSingle ? "发送邮件" : "发送给选中候选人"}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
