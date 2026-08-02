"use client";
import { Send } from "lucide-react";
import { useMemo, useState } from "react";
import {
  hasConfirmedAppointment,
  resolveComposerTemplates,
  type CandidateEmailTarget
} from "@/components/admin/candidate-email-composer-model";
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
import type { CandidateEmailTemplate } from "@/lib/mail/email-templates";
import { renderCandidateEmailTemplate } from "@/lib/mail/render-template";
import { sendCandidateEmailAction } from "@/server/actions/email";
import { normalizeLocale, type AppLocale } from "@/i18n/config";
import { translateMessage } from "@/i18n/catalogs";
import { useLocale } from "@/i18n/locale-provider";
type CandidateEmailComposerProps = {
  groupId: string;
  groupName: string;
  candidates: CandidateEmailTarget[];
  templates: CandidateEmailTemplate[];
  localizedTemplates?: Partial<Record<AppLocale, CandidateEmailTemplate[]>>;
  returnTo: string;
  mode?: "table" | "single";
};
export function CandidateEmailComposer({
  groupId,
  groupName,
  candidates,
  templates,
  localizedTemplates,
  returnTo,
  mode = "table"
}: CandidateEmailComposerProps) {
  const { locale: uiLocale, t } = useLocale();
  const isSingle = mode === "single";
  const initialContentLocale = normalizeLocale(
    isSingle ? candidates[0]?.preferredLocale : uiLocale
  );
  const hasConfirmedAppointmentValue = hasConfirmedAppointment(candidates);
  const templateSets = useMemo(
    () => ({
      "zh-CN": localizedTemplates?.["zh-CN"] ?? (initialContentLocale === "zh-CN" ? templates : []),
      en: localizedTemplates?.en ?? (initialContentLocale === "en" ? templates : [])
    }),
    [initialContentLocale, localizedTemplates, templates]
  );
  const initialTemplate = resolveComposerTemplates(
    initialContentLocale,
    templateSets[initialContentLocale],
    isSingle && hasConfirmedAppointmentValue
  ).initialTemplate;
  const [templateKey, setTemplateKey] = useState(initialTemplate.key);
  const [editingLocale, setEditingLocale] = useState(initialContentLocale);
  const [localizedDrafts, setLocalizedDrafts] = useState(() => {
    const draftFor = (locale: AppLocale) => {
      const resolved = resolveComposerTemplates(
        locale,
        templateSets[locale],
        isSingle && hasConfirmedAppointmentValue
      );
      return (
        resolved.availableTemplates.find((template) => template.key === initialTemplate.key) ??
        resolved.initialTemplate
      );
    };
    const zh = draftFor("zh-CN");
    const en = draftFor("en");
    return {
      "zh-CN": { subject: zh.subject, body: zh.body },
      en: { subject: en.subject, body: en.body }
    };
  });
  const { availableTemplates, defaultTemplate } = resolveComposerTemplates(
    editingLocale,
    templateSets[editingLocale],
    isSingle && hasConfirmedAppointmentValue
  );
  const activeDraft = localizedDrafts[editingLocale];
  const [ccEmails, setCcEmails] = useState("");
  const [selectedIds, setSelectedIds] = useState(() =>
    isSingle ? candidates.map((candidate) => candidate.id) : []
  );
  const [confirmed, setConfirmed] = useState(false);
  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedIds.includes(candidate.id)),
    [candidates, selectedIds]
  );
  const previewCandidate = isSingle
    ? (selectedCandidates[0] ?? candidates[0])
    : (selectedCandidates.find(
        (candidate) => normalizeLocale(candidate.preferredLocale) === editingLocale
      ) ??
      candidates.find((candidate) => normalizeLocale(candidate.preferredLocale) === editingLocale));
  const previewValues = {
    candidateName:
      previewCandidate?.name ?? translateMessage(editingLocale, "emailComposer.previewCandidate"),
    candidateEmail: previewCandidate?.email ?? "candidate@example.com",
    groupName,
    appointmentTime:
      previewCandidate?.appointmentTime ??
      translateMessage(editingLocale, "emailComposer.previewNotScheduled"),
    meetingLocation:
      previewCandidate?.meetingLocation ??
      translateMessage(editingLocale, "emailComposer.previewNotProvided"),
    candidateMessage: previewCandidate?.candidateMessage ?? ""
  };
  const previewSubject = renderCandidateEmailTemplate(activeDraft.subject, previewValues);
  const previewBody = renderCandidateEmailTemplate(activeDraft.body, previewValues);
  const allSelected =
    !isSingle && candidates.length > 0 && selectedIds.length === candidates.length;
  function applyTemplate(nextKey: string) {
    const templateKeyToApply =
      availableTemplates.find((item) => item.key === nextKey)?.key ?? defaultTemplate.key;
    const draftFor = (locale: AppLocale) => {
      const resolved = resolveComposerTemplates(
        locale,
        templateSets[locale],
        isSingle && hasConfirmedAppointmentValue
      );
      return (
        resolved.availableTemplates.find((item) => item.key === templateKeyToApply) ??
        resolved.defaultTemplate
      );
    };
    const zh = draftFor("zh-CN");
    const en = draftFor("en");
    setTemplateKey(templateKeyToApply);
    setLocalizedDrafts({
      "zh-CN": { subject: zh.subject, body: zh.body },
      en: { subject: en.subject, body: en.body }
    });
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
          <h3 className="font-semibold">{t("legacy.send_candidate_notification.ffe8f9df")}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t(
              "legacy.the_system_will_send_each_candidate_individually_when_sending_in_batches.30f72801"
            )}
          </p>
        </div>
      </div>
      <InlineNotice tone="info" className="mb-4">
        {t("emailComposer.placeholders", {
          placeholders:
            "{name}, {email}, {groupName}, {appointmentTime}, {meetingLocation}, {candidateMessage}"
        })}
      </InlineNotice>
      <p className="mb-4 text-xs font-medium text-muted-foreground" data-i18n-preserve>
        {t(
          editingLocale === "en"
            ? "mail.contentLanguage.selectedEn"
            : "mail.contentLanguage.selectedZh"
        )}
      </p>
      <form action={sendCandidateEmailAction.bind(null, groupId)} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="templateKey" value={templateKey} />
        <input type="hidden" name="contentMode" value={isSingle ? "single" : "localizedBatch"} />
        <input type="hidden" name="locale" value={editingLocale} />
        {!isSingle ? (
          <>
            <input type="hidden" name="subjectZhCn" value={localizedDrafts["zh-CN"].subject} />
            <input type="hidden" name="bodyZhCn" value={localizedDrafts["zh-CN"].body} />
            <input type="hidden" name="subjectEn" value={localizedDrafts.en.subject} />
            <input type="hidden" name="bodyEn" value={localizedDrafts.en.body} />
          </>
        ) : null}
        {isSingle
          ? candidates.map((candidate) => (
              <input key={candidate.id} type="hidden" name="candidateIds" value={candidate.id} />
            ))
          : null}
        {!isSingle ? (
          <>
            <InlineNotice tone="info">{t("emailComposer.localizedBatchNotice")}</InlineNotice>
            <FormField id="bulkEmailContentLocale" label={t("emailTemplate.contentLanguage")}>
              <Select
                id="bulkEmailContentLocale"
                value={editingLocale}
                onChange={(event) => {
                  setEditingLocale(normalizeLocale(event.target.value));
                  setConfirmed(false);
                }}
              >
                <option value="zh-CN">{t("mail.contentLanguage.zh")}</option>
                <option value="en">{t("mail.contentLanguage.en")}</option>
              </Select>
            </FormField>
          </>
        ) : null}
        <FormField
          id={isSingle ? "singleEmailTemplate" : "bulkEmailTemplate"}
          label={t("legacy.email_templates.3e24ad26")}
        >
          <Select
            id={isSingle ? "singleEmailTemplate" : "bulkEmailTemplate"}
            value={templateKey}
            onChange={(event) => applyTemplate(event.target.value)}
          >
            {availableTemplates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id={isSingle ? "singleEmailSubject" : "bulkEmailSubject"}
          label={t("legacy.email_subject.d626dbe6")}
        >
          <Input
            id={isSingle ? "singleEmailSubject" : "bulkEmailSubject"}
            name={isSingle ? "subject" : undefined}
            value={activeDraft.subject}
            onChange={(event) => {
              setLocalizedDrafts((current) => ({
                ...current,
                [editingLocale]: { ...current[editingLocale], subject: event.target.value }
              }));
              setConfirmed(false);
            }}
            maxLength={160}
            required
          />
        </FormField>
        <FormField
          id={isSingle ? "singleEmailCc" : "bulkEmailCc"}
          label={t("legacy.cc_optional.94a348d3")}
          description={t(
            "legacy.multiple_mailboxes_can_be_separated_by_commas_semicolons_spaces_or_newli.431edb70"
          )}
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
            placeholder="hr@example.com; manager@example.com"
          />
        </FormField>
        <FormField
          id={isSingle ? "singleEmailBody" : "bulkEmailBody"}
          label={t("legacy.email_text.9aa24002")}
        >
          <Textarea
            id={isSingle ? "singleEmailBody" : "bulkEmailBody"}
            name={isSingle ? "body" : undefined}
            value={activeDraft.body}
            onChange={(event) => {
              setLocalizedDrafts((current) => ({
                ...current,
                [editingLocale]: { ...current[editingLocale], body: event.target.value }
              }));
              setConfirmed(false);
            }}
            rows={8}
            required
          />
        </FormField>

        <div className="rounded-lg border border-border bg-surface-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t("legacy.send_preview.df3cc4b4")}</p>
            <p className="text-xs text-muted-foreground">
              {isSingle
                ? t("legacy.send_separately.37a63f84")
                : t("legacy.value0_candidates_selected.ac5ebf84", { value0: selectedIds.length })}
            </p>
          </div>
          <div className="mt-3 rounded-md border border-border bg-white p-3 text-sm">
            <p className="font-medium" data-i18n-preserve>
              {previewSubject}
            </p>
            {ccEmails.trim() ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("mail.ccList", { emails: ccEmails.trim() })}
              </p>
            ) : null}
            <p
              className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground"
              data-i18n-preserve
            >
              {previewBody}
            </p>
          </div>
        </div>

        {!isSingle ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {t("legacy.select_recipient.3da6a62d")}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedIds(allSelected ? [] : candidates.map((candidate) => candidate.id));
                  setConfirmed(false);
                }}
              >
                {allSelected ? t("legacy.deselect_all.f4d4bae5") : t("legacy.select_all.3a5040b6")}
              </Button>
            </div>
            <TableContainer>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead className="w-12">{t("legacy.choose.c11330b8")}</TableHead>
                    <TableHead>{t("legacy.candidates.ea62aaa5")}</TableHead>
                    <TableHead>{t("legacy.status.6320b4a8")}</TableHead>
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
                          aria-label={t("legacy.select_value0.8ddfacf9", {
                            value0: candidate.name
                          })}
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
            {hasConfirmedAppointmentValue ? (
              <p className="mt-2 text-muted-foreground">
                {t("emailComposer.appointmentTime", {
                  appointmentTime: candidates[0]?.appointmentTime ?? ""
                })}
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
            {t(
              "legacy.i_have_confirmed_that_the_recipient_cc_subject_and_text_are_correct_batc.956a3490"
            )}
          </span>
        </label>

        <div className="flex justify-end">
          <SubmitButton disabled={!confirmed || selectedIds.length === 0}>
            {isSingle
              ? t("legacy.send_notification.fd099700")
              : t("legacy.send_to_selected_candidates.f0fe2cb2")}
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
