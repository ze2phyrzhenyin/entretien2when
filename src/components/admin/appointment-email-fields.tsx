import { getServerTranslator } from "@/i18n/server";
import { Bell } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { CandidateEmailTemplate } from "@/lib/mail/email-templates";
export async function AppointmentEmailFields({
  checkboxLabel,
  template
}: {
  checkboxLabel: string;
  template: CandidateEmailTemplate;
}) {
  const { t } = await getServerTranslator();
  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-4">
      <input type="hidden" name="emailSubject" value={template.subject} />
      <input type="hidden" name="emailBody" value={template.body} />
      <input type="hidden" name="ccEmails" value="" />

      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-md bg-primary-soft p-2 text-primary" aria-hidden="true">
          <Bell className="h-4 w-4" />
        </span>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm font-medium">
            <Checkbox name="sendEmail" value="yes" defaultChecked />
            <span>{checkboxLabel}</span>
          </label>
          <p className="text-sm leading-6 text-muted-foreground">
            {t(
              "legacy.send_using_the_standard_interview_schedule_notification_template_use_the.5733b6eb"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
