"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminRole, AuditActorType } from "@prisma/client";
import { isSupportedLocale, type AppLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDefaultEmailTemplate } from "@/lib/mail/email-template-store";
import { formValue } from "@/lib/validation/common";
import { emailTemplateResetSchema, emailTemplateUpdateSchema } from "@/lib/validation/email";

function redirectWithTemplateStatus(params: {
  result: "saved" | "reset" | "invalid";
  key?: string;
  locale?: AppLocale;
}): never {
  const url = new URL("http://local/admin/email-templates");
  url.searchParams.set("template", params.result);
  if (params.key) {
    url.searchParams.set("key", params.key);
  }
  if (params.locale) {
    url.searchParams.set("templateLocale", params.locale);
  }
  redirect(`${url.pathname}${url.search}`);
}

export async function upsertEmailTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== AdminRole.SUPER_ADMIN) {
    throw new Error("只有超级管理员可以管理邮件模板。");
  }

  const requestedLocale = formValue(formData, "locale");
  const parsed = emailTemplateUpdateSchema.safeParse({
    key: formValue(formData, "key"),
    locale: requestedLocale,
    label: formValue(formData, "label"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body")
  });

  if (!parsed.success) {
    redirectWithTemplateStatus({
      result: "invalid",
      locale: isSupportedLocale(requestedLocale) ? requestedLocale : undefined
    });
  }

  const input = parsed.data;
  const fallback = getDefaultEmailTemplate(input.key, input.locale);
  if (!fallback) {
    redirectWithTemplateStatus({ result: "invalid", locale: input.locale });
  }

  const existing = await prisma.emailTemplate.findUnique({
    where: {
      key_locale: {
        key: input.key,
        locale: input.locale
      }
    }
  });
  const saved = await prisma.emailTemplate.upsert({
    where: {
      key_locale: {
        key: input.key,
        locale: input.locale
      }
    },
    update: {
      label: input.label,
      subject: input.subject,
      body: input.body,
      updatedByAdminId: admin.id
    },
    create: {
      key: input.key,
      locale: input.locale,
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
            locale: existing.locale,
            label: existing.label,
            subject: existing.subject,
            body: existing.body
          }
        : {
            key: fallback.key,
            locale: input.locale,
            label: fallback.label,
            subject: fallback.subject,
            body: fallback.body
          },
      afterData: {
        key: saved.key,
        locale: saved.locale,
        label: saved.label,
        subject: saved.subject,
        body: saved.body
      }
    }
  });

  revalidatePath("/admin/email-templates");
  redirectWithTemplateStatus({ result: "saved", key: input.key, locale: input.locale });
}

export async function resetEmailTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== AdminRole.SUPER_ADMIN) {
    throw new Error("只有超级管理员可以管理邮件模板。");
  }

  const requestedLocale = formValue(formData, "locale");
  const parsed = emailTemplateResetSchema.safeParse({
    key: formValue(formData, "key"),
    locale: requestedLocale
  });

  if (!parsed.success) {
    redirectWithTemplateStatus({
      result: "invalid",
      locale: isSupportedLocale(requestedLocale) ? requestedLocale : undefined
    });
  }

  const input = parsed.data;
  const fallback = getDefaultEmailTemplate(input.key, input.locale);
  if (!fallback) {
    redirectWithTemplateStatus({ result: "invalid", locale: input.locale });
  }

  const existing = await prisma.emailTemplate.findUnique({
    where: {
      key_locale: {
        key: input.key,
        locale: input.locale
      }
    }
  });
  if (existing) {
    await prisma.emailTemplate.delete({
      where: {
        key_locale: {
          key: input.key,
          locale: input.locale
        }
      }
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
            locale: existing.locale,
            label: existing.label,
            subject: existing.subject,
            body: existing.body
          }
        : undefined,
      afterData: {
        key: fallback.key,
        locale: input.locale,
        label: fallback.label,
        subject: fallback.subject,
        body: fallback.body
      }
    }
  });

  revalidatePath("/admin/email-templates");
  redirectWithTemplateStatus({ result: "reset", key: input.key, locale: input.locale });
}
