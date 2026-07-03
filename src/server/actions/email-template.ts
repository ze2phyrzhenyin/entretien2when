"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminRole, AuditActorType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDefaultEmailTemplate } from "@/lib/mail/email-template-store";
import { formValue } from "@/lib/validation/common";
import { emailTemplateResetSchema, emailTemplateUpdateSchema } from "@/lib/validation/email";

function redirectWithTemplateStatus(params: {
  result: "saved" | "reset" | "invalid";
  key?: string;
}): never {
  const url = new URL("http://local/admin/email-templates");
  url.searchParams.set("template", params.result);
  if (params.key) {
    url.searchParams.set("key", params.key);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function upsertEmailTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== AdminRole.SUPER_ADMIN) {
    throw new Error("只有超级管理员可以管理邮件模板。");
  }

  const parsed = emailTemplateUpdateSchema.safeParse({
    key: formValue(formData, "key"),
    label: formValue(formData, "label"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body")
  });

  if (!parsed.success) {
    redirectWithTemplateStatus({ result: "invalid" });
  }

  const input = parsed.data;
  const fallback = getDefaultEmailTemplate(input.key);
  if (!fallback) {
    redirectWithTemplateStatus({ result: "invalid" });
  }

  const existing = await prisma.emailTemplate.findUnique({
    where: { key: input.key }
  });
  const saved = await prisma.emailTemplate.upsert({
    where: { key: input.key },
    update: {
      label: input.label,
      subject: input.subject,
      body: input.body,
      updatedByAdminId: admin.id
    },
    create: {
      key: input.key,
      label: input.label,
      subject: input.subject,
      body: input.body,
      updatedByAdminId: admin.id
    }
  });

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      action: "admin.update_email_template",
      entityType: "EmailTemplate",
      entityId: saved.id,
      beforeData: existing
        ? {
            key: existing.key,
            label: existing.label,
            subject: existing.subject,
            body: existing.body
          }
        : {
            key: fallback.key,
            label: fallback.label,
            subject: fallback.subject,
            body: fallback.body
          },
      afterData: {
        key: saved.key,
        label: saved.label,
        subject: saved.subject,
        body: saved.body
      }
    }
  });

  revalidatePath("/admin/email-templates");
  redirectWithTemplateStatus({ result: "saved", key: input.key });
}

export async function resetEmailTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== AdminRole.SUPER_ADMIN) {
    throw new Error("只有超级管理员可以管理邮件模板。");
  }

  const parsed = emailTemplateResetSchema.safeParse({
    key: formValue(formData, "key")
  });

  if (!parsed.success) {
    redirectWithTemplateStatus({ result: "invalid" });
  }

  const input = parsed.data;
  const fallback = getDefaultEmailTemplate(input.key);
  if (!fallback) {
    redirectWithTemplateStatus({ result: "invalid" });
  }

  const existing = await prisma.emailTemplate.findUnique({
    where: { key: input.key }
  });
  if (existing) {
    await prisma.emailTemplate.delete({
      where: { key: input.key }
    });
  }

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorAdminId: admin.id,
      action: "admin.reset_email_template",
      entityType: "EmailTemplate",
      entityId: existing?.id ?? input.key,
      beforeData: existing
        ? {
            key: existing.key,
            label: existing.label,
            subject: existing.subject,
            body: existing.body
          }
        : undefined,
      afterData: {
        key: fallback.key,
        label: fallback.label,
        subject: fallback.subject,
        body: fallback.body
      }
    }
  });

  revalidatePath("/admin/email-templates");
  redirectWithTemplateStatus({ result: "reset", key: input.key });
}
