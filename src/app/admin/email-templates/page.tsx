import { getServerTranslator } from "@/i18n/server";
import { AdminRole } from "@prisma/client";
import { FileText } from "lucide-react";
import Link from "next/link";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import {
  getEmailTemplateManagementItems,
  resolveEmailTemplateContentLocale
} from "@/lib/mail/email-template-store";
import {
  resetEmailTemplateAction,
  upsertEmailTemplateAction
} from "@/server/actions/email-template";
type AdminEmailTemplatesPageProps = {
  searchParams: Promise<{
    template?: string;
    key?: string;
    templateLocale?: string;
  }>;
};
const templateVariables = [
  "{name}",
  "{email}",
  "{groupName}",
  "{appointmentTime}",
  "{meetingLocation}",
  "{candidateMessage}"
];
export default async function AdminEmailTemplatesPage({
  searchParams
}: AdminEmailTemplatesPageProps) {
  const { t } = await getServerTranslator();
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const isSuperAdmin = admin.role === AdminRole.SUPER_ADMIN;
  // Content locale is an explicit editor choice. It must not follow the UI
  // locale, so an interface-language refresh keeps the same uncontrolled form.
  const templateLocale = resolveEmailTemplateContentLocale(query.templateLocale);
  const templates = isSuperAdmin ? await getEmailTemplateManagementItems(templateLocale) : [];
  return (
    <AdminShell admin={admin} active="emailTemplates">
      <PageHeader
        title={t("legacy.email_templates.3e24ad26")}
        description={t(
          "legacy.globally_manage_candidate_notifications_and_interview_schedule_notificat.2f4a1287"
        )}
      />

      {query.template === "saved" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.email_template_saved.daf41de6")}
        </InlineNotice>
      ) : null}
      {query.template === "reset" ? (
        <InlineNotice tone="success" className="mb-5">
          {t("legacy.the_email_template_has_been_restored_to_default.0843f3ea")}
        </InlineNotice>
      ) : null}
      {query.template === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t("legacy.please_fill_in_a_valid_template_name_email_subject_and_email_body.404c3592")}
        </InlineNotice>
      ) : null}

      {!isSuperAdmin ? (
        <EmptyState
          title={t("legacy.no_template_management_rights_yet.823ecc2b")}
          description={t("legacy.this_feature_is_only_available_to_super_administrators.1adaecaf")}
          icon={<FileText className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-5">
          <Card className="p-5">
            <div
              className="mb-5 flex flex-wrap items-center gap-3"
              role="group"
              aria-label={t("emailTemplate.contentLanguage")}
            >
              <p className="text-sm font-semibold">{t("emailTemplate.contentLanguage")}</p>
              {(["zh-CN", "en"] as const).map((option) => {
                const selected = templateLocale === option;
                return (
                  <Button
                    key={option}
                    asChild
                    size="sm"
                    variant={selected ? "primary" : "secondary"}
                  >
                    <Link
                      href={`/admin/email-templates?templateLocale=${encodeURIComponent(option)}`}
                      aria-current={selected ? "page" : undefined}
                    >
                      {t(
                        option === "zh-CN"
                          ? "emailTemplate.contentLanguage.zh"
                          : "emailTemplate.contentLanguage.en"
                      )}
                    </Link>
                  </Button>
                );
              })}
            </div>
            <p className="text-sm font-semibold">{t("legacy.available_variables.37274630")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {templateVariables.map((variable) => (
                <Badge key={variable} tone="info">
                  {variable}
                </Badge>
              ))}
            </div>
          </Card>

          {templates.map((template) => (
            <Card
              key={`${template.locale}:${template.key}`}
              className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
            >
              <form action={upsertEmailTemplateAction} className="space-y-4">
                <input type="hidden" name="key" value={template.key} />
                <input type="hidden" name="locale" value={template.locale} />
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{template.label}</h3>
                  <Badge tone={template.isCustomized ? "primary" : "neutral"}>
                    {template.isCustomized
                      ? t("legacy.customized.07e1829e")
                      : t("legacy.default_template.6ad2cb08")}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{template.key}</span>
                </div>
                <FormField
                  id={`emailTemplateLabel-${template.key}`}
                  label={t("legacy.template_name.f7816a35")}
                >
                  <Input
                    id={`emailTemplateLabel-${template.key}`}
                    name="label"
                    defaultValue={template.label}
                    maxLength={80}
                    required
                  />
                </FormField>
                <FormField
                  id={`emailTemplateSubject-${template.key}`}
                  label={t("legacy.email_subject.d626dbe6")}
                >
                  <Input
                    id={`emailTemplateSubject-${template.key}`}
                    name="subject"
                    defaultValue={template.subject}
                    maxLength={160}
                    required
                  />
                </FormField>
                <FormField
                  id={`emailTemplateBody-${template.key}`}
                  label={t("legacy.email_text.9aa24002")}
                >
                  <Textarea
                    id={`emailTemplateBody-${template.key}`}
                    name="body"
                    defaultValue={template.body}
                    rows={10}
                    required
                  />
                </FormField>
                <div className="flex flex-wrap items-center gap-3">
                  <SubmitButton pendingText={t("legacy.saving.570d6020")}>
                    {t("legacy.save_template.87080fe7")}
                  </SubmitButton>
                </div>
              </form>

              <div className="space-y-4 rounded-lg border border-border bg-surface-subtle p-4">
                <div>
                  <p className="text-sm font-semibold">{t("legacy.default_content.d477ae35")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.defaultLabel} · {template.defaultSubject}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap rounded-md border border-border bg-white p-3 text-sm leading-6 text-muted-foreground">
                    {template.defaultBody}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {template.updatedAt ? (
                    <p>
                      <ZonedDateTime
                        value={template.updatedAt.toISOString()}
                        defaultTimezone="Asia/Shanghai"
                        showTimezone
                        messageKey="emailTemplate.lastModified"
                      />
                    </p>
                  ) : (
                    <p>{t("legacy.last_modified_not_customized.d674c4e6")}</p>
                  )}
                  {template.updatedByAdmin ? (
                    <p className="mt-1">
                      {t("emailTemplate.modifiedBy", {
                        name: template.updatedByAdmin.displayName,
                        email: template.updatedByAdmin.email
                      })}
                    </p>
                  ) : null}
                </div>
                <ConfirmForm
                  action={resetEmailTemplateAction}
                  confirmMessage={t(
                    "legacy.are_you_sure_to_restore_the_default_template_the_current_custom_content_.96c50aee"
                  )}
                >
                  <input type="hidden" name="key" value={template.key} />
                  <input type="hidden" name="locale" value={template.locale} />
                  <SubmitButton
                    variant="secondary"
                    pendingText={t("legacy.recovering.7266e439")}
                    disabled={!template.isCustomized}
                  >
                    {t("legacy.restore_default.ba2e93e7")}
                  </SubmitButton>
                </ConfirmForm>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
