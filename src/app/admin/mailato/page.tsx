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
  searchParams: Promise<{ mailato?: string; dryRun?: string }>;
};

export default async function AdminMailatoPage({ searchParams }: AdminMailatoPageProps) {
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const isSuperAdmin = admin.role === AdminRole.SUPER_ADMIN;

  return (
    <AdminShell admin={admin} active="mailato">
      <PageHeader
        title="邮件发送"
        description="通过服务器 Mailato 发送邮件，支持收件人、抄送（CC）和密送（BCC）。"
      />

      {query.mailato === "sent" ? (
        <InlineNotice tone="success" className="mb-5">
          邮件已提交给 Mailato{query.dryRun ? "（测试发送预览）" : ""}。
        </InlineNotice>
      ) : null}
      {query.mailato === "error" ? (
        <InlineNotice tone="danger" className="mb-5">
          Mailato 发送失败。请检查服务器 Mailato 配置和审计日志。
        </InlineNotice>
      ) : null}
      {query.mailato === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请填写有效的收件人、主题和正文，并勾选发送确认。
        </InlineNotice>
      ) : null}

      {!isSuperAdmin ? (
        <EmptyState
          title="暂无邮件发送权限"
          description="该功能仅限超级管理员使用。"
          icon={<Mail className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <Card className="p-6">
          <form action={sendMailatoAdminEmailAction} className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <FormField
                id="mailatoToEmails"
                label="收件人"
                description="多个邮箱可用逗号、分号、空格或换行分隔。"
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
                  label="抄送（CC，可选）"
                  description="抄送收件人会在邮件抄送列表中互相可见。"
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
                  label="密送（BCC，可选）"
                  description="密送收件人不会显示在收件人或抄送列表中。"
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
            <FormField id="mailatoSubject" label="邮件主题">
              <Input id="mailatoSubject" name="subject" maxLength={160} required />
            </FormField>
            <FormField id="mailatoBody" label="邮件正文">
              <Textarea id="mailatoBody" name="body" rows={14} required />
            </FormField>
            <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle p-4 text-sm">
              <Checkbox name="confirmSend" value="yes" />
              <span>我确认收件人、抄送、密送、主题和正文无误，并立即发送。</span>
            </label>
            <SubmitButton pendingText="正在发送">发送邮件</SubmitButton>
          </form>
        </Card>
      )}
    </AdminShell>
  );
}
