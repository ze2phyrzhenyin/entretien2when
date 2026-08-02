import { getServerTranslator } from "@/i18n/server";
import { AdminRole } from "@prisma/client";
import { Mail } from "lucide-react";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { sendMailatoAdminEmailAction } from "@/server/actions/mailato";
type AdminMailatoPageProps = {
  searchParams: Promise<{
    mailato?: string;
    dryRun?: string;
  }>;
};
export default async function AdminMailatoPage({ searchParams }: AdminMailatoPageProps) {
  const { t } = await getServerTranslator();
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const isSuperAdmin = admin.role === AdminRole.SUPER_ADMIN;
  return (
    <AdminShell admin={admin} active="mailato">
      <PageHeader
        title={t("legacy.send_email.1579f7b4")}
        description={t(
          "legacy.send_emails_through_the_server_mailato_supporting_recipients_carbon_copy.475db0d0"
        )}
      />

      {query.mailato === "sent" ? (
        <InlineNotice tone="success" className="mb-5">
          {t(query.dryRun ? "mailato.previewSubmitted" : "mailato.sent")}
        </InlineNotice>
      ) : null}
      {query.mailato === "error" ? (
        <InlineNotice tone="danger" className="mb-5">
          {t(
            "legacy.mailato_failed_to_send_please_check_the_server_mailato_configuration_and.f9c08e29"
          )}
        </InlineNotice>
      ) : null}
      {query.mailato === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(
            "legacy.please_fill_in_the_valid_recipient_subject_and_body_and_check_the_box_to.0d623fa2"
          )}
        </InlineNotice>
      ) : null}

      {!isSuperAdmin ? (
        <EmptyState
          title={t("legacy.no_permission_to_send_emails_yet.f852e961")}
          description={t("legacy.this_feature_is_only_available_to_super_administrators.1adaecaf")}
          icon={<Mail className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <Card className="p-6">
          <form action={sendMailatoAdminEmailAction} className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <FormField
                id="mailatoToEmails"
                label={t("legacy.recipient.c237b665")}
                description={t(
                  "legacy.multiple_mailboxes_can_be_separated_by_commas_semicolons_spaces_or_newli.431edb70"
                )}
              >
                <Textarea
                  id="mailatoToEmails"
                  name="toEmails"
                  rows={4}
                  placeholder="candidate@example.com"
                  required
                />
              </FormField>
              <div className="grid gap-5">
                <FormField
                  id="mailatoCcEmails"
                  label={t("legacy.cc_optional.94a348d3")}
                  description={t(
                    "legacy.cc_recipients_will_be_visible_to_each_other_in_the_mail_cc_list.30dc3400"
                  )}
                >
                  <Textarea
                    id="mailatoCcEmails"
                    name="ccEmails"
                    rows={2}
                    placeholder="hr@example.com"
                  />
                </FormField>
                <FormField
                  id="mailatoBccEmails"
                  label={t("legacy.blind_copy_bcc_optional.9804bfd3")}
                  description={t(
                    "legacy.bcc_recipients_will_not_appear_in_the_to_or_cc_lists.e21dfa7e"
                  )}
                >
                  <Textarea
                    id="mailatoBccEmails"
                    name="bccEmails"
                    rows={2}
                    placeholder="owner@example.com"
                  />
                </FormField>
              </div>
            </div>
            <FormField id="mailatoSubject" label={t("legacy.email_subject.d626dbe6")}>
              <Input id="mailatoSubject" name="subject" maxLength={160} required />
            </FormField>
            <FormField id="mailatoBody" label={t("legacy.email_text.9aa24002")}>
              <Textarea id="mailatoBody" name="body" rows={14} required />
            </FormField>
            <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle p-4 text-sm">
              <Checkbox name="confirmSend" value="yes" />
              <span>
                {t(
                  "legacy.i_confirm_that_the_recipients_cc_bcc_subject_and_body_are_correct_and_se.5bb051a0"
                )}
              </span>
            </label>
            <SubmitButton pendingText={t("legacy.sending.2d88d503")}>
              {t("legacy.send_email.c268c1b1")}
            </SubmitButton>
          </form>
        </Card>
      )}
    </AdminShell>
  );
}
