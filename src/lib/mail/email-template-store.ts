import type { EmailTemplate } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  appointmentConfirmedEmailTemplate,
  candidateEmailTemplates,
  defaultCandidateEmailTemplate,
  type CandidateEmailTemplate
} from "@/lib/mail/email-templates";

const templateDefaultsByKey = new Map(
  candidateEmailTemplates.map((template) => [template.key, template])
);

export const emailTemplateKeys = candidateEmailTemplates.map((template) => template.key);

export function isKnownEmailTemplateKey(key: string) {
  return templateDefaultsByKey.has(key);
}

export function getDefaultEmailTemplate(key: string) {
  return templateDefaultsByKey.get(key);
}

function applyTemplateOverride(
  template: CandidateEmailTemplate,
  override: Pick<EmailTemplate, "key" | "label" | "subject" | "body"> | undefined
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

export async function getCandidateEmailTemplates() {
  const overrides = await prisma.emailTemplate.findMany({
    where: {
      key: { in: emailTemplateKeys }
    },
    select: {
      key: true,
      label: true,
      subject: true,
      body: true
    }
  });
  const overridesByKey = new Map(overrides.map((template) => [template.key, template]));

  return candidateEmailTemplates.map((template) =>
    applyTemplateOverride(template, overridesByKey.get(template.key))
  );
}

export async function getEmailTemplateForKey(key: string) {
  const fallback = getDefaultEmailTemplate(key) ?? defaultCandidateEmailTemplate;
  const override = await prisma.emailTemplate.findUnique({
    where: { key: fallback.key },
    select: {
      key: true,
      label: true,
      subject: true,
      body: true
    }
  });

  return applyTemplateOverride(fallback, override ?? undefined);
}

export async function getAppointmentConfirmedEmailTemplate() {
  return getEmailTemplateForKey(appointmentConfirmedEmailTemplate.key);
}

export async function getEmailTemplateManagementItems() {
  const overrides = await prisma.emailTemplate.findMany({
    where: {
      key: { in: emailTemplateKeys }
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

  return candidateEmailTemplates.map((defaults) => {
    const override = overridesByKey.get(defaults.key);
    const current = applyTemplateOverride(defaults, override);

    return {
      ...current,
      defaultLabel: defaults.label,
      defaultSubject: defaults.subject,
      defaultBody: defaults.body,
      isCustomized: Boolean(override),
      updatedAt: override?.updatedAt ?? null,
      updatedByAdmin: override?.updatedByAdmin ?? null
    };
  });
}
