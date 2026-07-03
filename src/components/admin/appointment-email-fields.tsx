import { FormField } from "@/components/design-system/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { appointmentConfirmedEmailTemplate } from "@/lib/mail/email-templates";

export function AppointmentEmailFields({
  idPrefix,
  checkboxLabel,
  bodyRows = 8
}: {
  idPrefix: string;
  checkboxLabel: string;
  bodyRows?: number;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-subtle p-4">
      <label className="flex items-start gap-2 text-sm font-medium">
        <Checkbox name="sendEmail" value="yes" defaultChecked />
        <span>{checkboxLabel}</span>
      </label>
      <p className="text-sm leading-6 text-muted-foreground">
        可使用 {"{name}"}、{"{email}"}、{"{groupName}"}、{"{appointmentTime}"}、
        {"{meetingLocation}"}、{"{candidateMessage}"}。
      </p>
      <FormField id={`${idPrefix}Subject`} label="邮件主题">
        <Input
          id={`${idPrefix}Subject`}
          name="emailSubject"
          defaultValue={appointmentConfirmedEmailTemplate.subject}
          maxLength={160}
        />
      </FormField>
      <FormField
        id={`${idPrefix}Cc`}
        label="抄送（可选）"
        description="多个邮箱可用逗号、分号、空格或换行分隔。"
      >
        <Textarea
          id={`${idPrefix}Cc`}
          name="ccEmails"
          rows={2}
          placeholder="hr@example.com；manager@example.com"
        />
      </FormField>
      <FormField id={`${idPrefix}Body`} label="邮件正文">
        <Textarea
          id={`${idPrefix}Body`}
          name="emailBody"
          defaultValue={appointmentConfirmedEmailTemplate.body}
          rows={bodyRows}
        />
      </FormField>
    </div>
  );
}
