"use client";

import { Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { CandidateStatus } from "@prisma/client";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import {
  appointmentConfirmedEmailTemplate,
  candidateEmailTemplates,
  defaultCandidateEmailTemplate
} from "@/lib/mail/email-templates";
import { renderCandidateEmailTemplate } from "@/lib/mail/render-template";
import { sendCandidateEmailAction } from "@/server/actions/email";

type CandidateEmailTarget = {
  id: string;
  name: string;
  email: string;
  status?: CandidateStatus;
  appointmentTime?: string;
  meetingLocation?: string;
  candidateMessage?: string;
};

type CandidateEmailComposerProps = {
  groupId: string;
  groupName: string;
  candidates: CandidateEmailTarget[];
  returnTo: string;
  mode?: "table" | "single";
};

export function CandidateEmailComposer({
  groupId,
  groupName,
  candidates,
  returnTo,
  mode = "table"
}: CandidateEmailComposerProps) {
  const isSingle = mode === "single";
  const hasConfirmedAppointment = candidates.some(
    (candidate) => candidate.appointmentTime && candidate.appointmentTime !== "尚未安排"
  );
  const initialTemplate =
    isSingle && hasConfirmedAppointment
      ? appointmentConfirmedEmailTemplate
      : defaultCandidateEmailTemplate;
  const [templateKey, setTemplateKey] = useState(initialTemplate.key);
  const [subject, setSubject] = useState(initialTemplate.subject);
  const [body, setBody] = useState(initialTemplate.body);
  const [ccEmails, setCcEmails] = useState("");
  const [selectedIds, setSelectedIds] = useState(() =>
    isSingle ? candidates.map((candidate) => candidate.id) : []
  );
  const [confirmed, setConfirmed] = useState(false);
  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedIds.includes(candidate.id)),
    [candidates, selectedIds]
  );
  const previewCandidate = selectedCandidates[0] ?? candidates[0];
  const previewValues = {
    candidateName: previewCandidate?.name ?? "候选人",
    candidateEmail: previewCandidate?.email ?? "candidate@example.com",
    groupName,
    appointmentTime: previewCandidate?.appointmentTime ?? "尚未安排",
    meetingLocation: previewCandidate?.meetingLocation ?? "未填写",
    candidateMessage: previewCandidate?.candidateMessage ?? ""
  };
  const previewSubject = renderCandidateEmailTemplate(subject, previewValues);
  const previewBody = renderCandidateEmailTemplate(body, previewValues);
  const allSelected =
    !isSingle && candidates.length > 0 && selectedIds.length === candidates.length;

  function applyTemplate(nextKey: string) {
    const template =
      candidateEmailTemplates.find((item) => item.key === nextKey) ?? defaultCandidateEmailTemplate;
    setTemplateKey(template.key);
    setSubject(template.subject);
    setBody(template.body);
    setConfirmed(false);
  }

  function toggleCandidate(candidateId: string, checked: boolean) {
    setConfirmed(false);
    setSelectedIds((current) =>
      checked ? [...new Set([...current, candidateId])] : current.filter((id) => id !== candidateId)
    );
  }

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
        可在主题和正文中使用 {"{name}"}、{"{email}"}、{"{groupName}"}、{"{appointmentTime}"}、
        {"{meetingLocation}"}、{"{candidateMessage}"} 自动替换候选人信息。
      </InlineNotice>
      <form action={sendCandidateEmailAction.bind(null, groupId)} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="templateKey" value={templateKey} />
        {isSingle
          ? candidates.map((candidate) => (
              <input key={candidate.id} type="hidden" name="candidateIds" value={candidate.id} />
            ))
          : null}
        <FormField id={isSingle ? "singleEmailTemplate" : "bulkEmailTemplate"} label="邮件模板">
          <Select
            id={isSingle ? "singleEmailTemplate" : "bulkEmailTemplate"}
            value={templateKey}
            onChange={(event) => applyTemplate(event.target.value)}
          >
            {candidateEmailTemplates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id={isSingle ? "singleEmailSubject" : "bulkEmailSubject"} label="邮件主题">
          <Input
            id={isSingle ? "singleEmailSubject" : "bulkEmailSubject"}
            name="subject"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setConfirmed(false);
            }}
            maxLength={160}
            required
          />
        </FormField>
        <FormField
          id={isSingle ? "singleEmailCc" : "bulkEmailCc"}
          label="抄送（可选）"
          description="多个邮箱可用逗号、分号、空格或换行分隔。"
        >
          <Textarea
            id={isSingle ? "singleEmailCc" : "bulkEmailCc"}
            name="ccEmails"
            value={ccEmails}
            onChange={(event) => {
              setCcEmails(event.target.value);
              setConfirmed(false);
            }}
            rows={2}
            placeholder="hr@example.com；manager@example.com"
          />
        </FormField>
        <FormField id={isSingle ? "singleEmailBody" : "bulkEmailBody"} label="邮件正文">
          <Textarea
            id={isSingle ? "singleEmailBody" : "bulkEmailBody"}
            name="body"
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setConfirmed(false);
            }}
            rows={8}
            required
          />
        </FormField>

        <div className="rounded-lg border border-border bg-surface-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">发送前预览</p>
            <p className="text-xs text-muted-foreground">
              {isSingle ? "单独发送" : `已选择 ${selectedIds.length} 位候选人`}
            </p>
          </div>
          <div className="mt-3 rounded-md border border-border bg-white p-3 text-sm">
            <p className="font-medium">{previewSubject}</p>
            {ccEmails.trim() ? (
              <p className="mt-1 text-xs text-muted-foreground">抄送：{ccEmails.trim()}</p>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground">
              {previewBody}
            </p>
          </div>
        </div>

        {!isSingle ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">选择收件人</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedIds(allSelected ? [] : candidates.map((candidate) => candidate.id));
                  setConfirmed(false);
                }}
              >
                {allSelected ? "取消全选" : "全选"}
              </Button>
            </div>
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
                          checked={selectedIds.includes(candidate.id)}
                          onChange={(event) => toggleCandidate(candidate.id, event.target.checked)}
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
            {hasConfirmedAppointment ? (
              <p className="mt-2 text-muted-foreground">
                面试时间：{candidates[0]?.appointmentTime}
              </p>
            ) : null}
          </div>
        )}

        <label className="flex items-start gap-2 rounded-lg border border-border bg-white p-3 text-sm">
          <Checkbox
            name="confirmSend"
            value="yes"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>
            我已确认收件人、主题和正文无误。批量发送会逐位候选人单独发送，不会互相暴露邮箱。
          </span>
        </label>

        <div className="flex justify-end">
          <SubmitButton disabled={!confirmed || selectedIds.length === 0}>
            {isSingle ? "发送邮件" : "发送给选中候选人"}
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
