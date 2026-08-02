import type { EmailTemplate } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  appointmentConfirmedEmailTemplate,
  candidateEmailTemplates,
  candidateEmailTemplatesFor,
  defaultCandidateEmailTemplate,
  type CandidateEmailTemplate
} from "@/lib/mail/email-templates";
import { isSupportedLocale, normalizeLocale, type AppLocale } from "@/i18n/config";

const templateDefaultsByKey = new Map(
  candidateEmailTemplates.map((template) => [template.key, template])
);

export const emailTemplateKeys = candidateEmailTemplates.map((template) => template.key);

export function isKnownEmailTemplateKey(key: string) {
  return templateDefaultsByKey.has(key);
}

export function resolveEmailTemplateContentLocale(value: unknown): AppLocale {
  return isSupportedLocale(value) ? value : "zh-CN";
}

export function getDefaultEmailTemplate(key: string, locale: AppLocale = "zh-CN") {
  return candidateEmailTemplatesFor(normalizeLocale(locale)).find(
    (template) => template.key === key
  );
}

function applyTemplateOverride(
  template: CandidateEmailTemplate,
  override: Pick<EmailTemplate, "key" | "locale" | "label" | "subject" | "body"> | undefined
) {
  if (!override) {
    return template;
  }

  return {
    key: template.key,
    label: override.label,
    subject: override.subject,
    body: override.body
  } satisfies CandidateEmailTemplate;
}

export async function getCandidateEmailTemplates(locale: AppLocale = "zh-CN") {
  const normalizedLocale = normalizeLocale(locale);
  const defaults = candidateEmailTemplatesFor(normalizedLocale);
  const overrides = await prisma.emailTemplate.findMany({
    where: {
      key: { in: emailTemplateKeys },
      locale: normalizedLocale
    },
    select: {
      key: true,
      locale: true,
      label: true,
      subject: true,
      body: true
    }
  });
  const overridesByKey = new Map(overrides.map((template) => [template.key, template]));

  return defaults.map((template) =>
    applyTemplateOverride(template, overridesByKey.get(template.key))
  );
}

export async function getEmailTemplateForKey(key: string, locale: AppLocale = "zh-CN") {
  const normalizedLocale = normalizeLocale(locale);
  const fallback =
    getDefaultEmailTemplate(key, normalizedLocale) ??
    candidateEmailTemplatesFor(normalizedLocale)[0] ??
    defaultCandidateEmailTemplate;
  const override = await prisma.emailTemplate.findUnique({
    where: {
      key_locale: {
        key: fallback.key,
        locale: normalizedLocale
      }
    },
    select: {
      key: true,
      locale: true,
      label: true,
      subject: true,
      body: true
    }
  });

  return applyTemplateOverride(fallback, override ?? undefined);
}

export async function getAppointmentConfirmedEmailTemplate(locale: AppLocale = "zh-CN") {
  return getEmailTemplateForKey(appointmentConfirmedEmailTemplate.key, locale);
}

export async function getEmailTemplateManagementItems(locale: AppLocale = "zh-CN") {
  const normalizedLocale = normalizeLocale(locale);
  const defaults = candidateEmailTemplatesFor(normalizedLocale);
  const overrides = await prisma.emailTemplate.findMany({
    where: {
      key: { in: emailTemplateKeys },
      locale: normalizedLocale
    },
    include: {
      updatedByAdmin: {
        select: {
          displayName: true,
          email: true
        }
      }
    }
  });
  const overridesByKey = new Map(overrides.map((template) => [template.key, template]));

  return defaults.map((templateDefaults) => {
    const override = overridesByKey.get(templateDefaults.key);
    const current = applyTemplateOverride(templateDefaults, override);

    return {
      ...current,
      locale: normalizedLocale,
      defaultLabel: templateDefaults.label,
      defaultSubject: templateDefaults.subject,
      defaultBody: templateDefaults.body,
      isCustomized: Boolean(override),
      updatedAt: override?.updatedAt ?? null,
      updatedByAdmin: override?.updatedByAdmin ?? null
    };
  });
}
