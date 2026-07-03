import { AdminRole } from "@prisma/client";
import { FileText } from "lucide-react";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { getEmailTemplateManagementItems } from "@/lib/mail/email-template-store";
import {
  resetEmailTemplateAction,
  upsertEmailTemplateAction
} from "@/server/actions/email-template";

type AdminEmailTemplatesPageProps = {
  searchParams: Promise<{ template?: string; key?: string }>;
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
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const isSuperAdmin = admin.role === AdminRole.SUPER_ADMIN;
  const templates = isSuperAdmin ? await getEmailTemplateManagementItems() : [];

  return (
    <AdminShell admin={admin} active="emailTemplates">
      <PageHeader title="邮件模板" description="全局管理候选人通知和面试安排通知模板。" />

      {query.template === "saved" ? (
        <InlineNotice tone="success" className="mb-5">
          邮件模板已保存。
        </InlineNotice>
      ) : null}
      {query.template === "reset" ? (
        <InlineNotice tone="success" className="mb-5">
          邮件模板已恢复默认。
        </InlineNotice>
      ) : null}
      {query.template === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请填写有效的模板名称、邮件主题和邮件正文。
        </InlineNotice>
      ) : null}

      {!isSuperAdmin ? (
        <EmptyState
          title="暂无模板管理权限"
          description="该功能仅限超级管理员使用。"
          icon={<FileText className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-sm font-semibold">可用变量</p>
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
              key={template.key}
              className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
            >
              <form action={upsertEmailTemplateAction} className="space-y-4">
                <input type="hidden" name="key" value={template.key} />
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{template.label}</h3>
                  <Badge tone={template.isCustomized ? "primary" : "neutral"}>
                    {template.isCustomized ? "已自定义" : "默认模板"}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{template.key}</span>
                </div>
                <FormField id={`emailTemplateLabel-${template.key}`} label="模板名称">
                  <Input
                    id={`emailTemplateLabel-${template.key}`}
                    name="label"
                    defaultValue={template.label}
                    maxLength={80}
                    required
                  />
                </FormField>
                <FormField id={`emailTemplateSubject-${template.key}`} label="邮件主题">
                  <Input
                    id={`emailTemplateSubject-${template.key}`}
                    name="subject"
                    defaultValue={template.subject}
                    maxLength={160}
                    required
                  />
                </FormField>
                <FormField id={`emailTemplateBody-${template.key}`} label="邮件正文">
                  <Textarea
                    id={`emailTemplateBody-${template.key}`}
                    name="body"
                    defaultValue={template.body}
                    rows={10}
                    required
                  />
                </FormField>
                <div className="flex flex-wrap items-center gap-3">
                  <SubmitButton pendingText="正在保存">保存模板</SubmitButton>
                </div>
              </form>

              <div className="space-y-4 rounded-lg border border-border bg-surface-subtle p-4">
                <div>
                  <p className="text-sm font-semibold">默认内容</p>
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
                      最近修改：
                      <ZonedDateTime
                        value={template.updatedAt.toISOString()}
                        defaultTimezone="Asia/Shanghai"
                        showTimezone
                      />
                    </p>
                  ) : (
                    <p>最近修改：未自定义</p>
                  )}
                  {template.updatedByAdmin ? (
                    <p className="mt-1">
                      修改人：
                      {`${template.updatedByAdmin.displayName}（${template.updatedByAdmin.email}）`}
                    </p>
                  ) : null}
                </div>
                <form action={resetEmailTemplateAction}>
                  <input type="hidden" name="key" value={template.key} />
                  <SubmitButton
                    variant="secondary"
                    pendingText="正在恢复"
                    disabled={!template.isCustomized}
                  >
                    恢复默认
                  </SubmitButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
