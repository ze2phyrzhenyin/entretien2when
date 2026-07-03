import { Bell } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { appointmentConfirmedEmailTemplate } from "@/lib/mail/email-templates";

export function AppointmentEmailFields({ checkboxLabel }: { checkboxLabel: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-4">
      <input type="hidden" name="emailSubject" value={appointmentConfirmedEmailTemplate.subject} />
      <input type="hidden" name="emailBody" value={appointmentConfirmedEmailTemplate.body} />
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
            使用标准面试安排通知模板发送。需要自定义主题、正文、抄送或密送时，请使用“发送候选人通知”模块。
          </p>
        </div>
      </div>
    </div>
  );
}
