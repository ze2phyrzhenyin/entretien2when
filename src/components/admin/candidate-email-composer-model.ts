import type { CandidateStatus } from "@prisma/client";
import type { AppLocale } from "@/i18n/config";
import {
  appointmentConfirmedEmailTemplate,
  candidateEmailTemplatesFor,
  defaultCandidateEmailTemplate,
  type CandidateEmailTemplate
} from "@/lib/mail/email-templates";

export type CandidateEmailTarget = {
  id: string;
  name: string;
  email: string;
  status?: CandidateStatus;
  appointmentTime?: string;
  hasScheduledAppointment: boolean;
  meetingLocation?: string;
  candidateMessage?: string;
  preferredLocale?: AppLocale;
};

export function hasConfirmedAppointment(candidates: CandidateEmailTarget[]) {
  return candidates.some((candidate) => candidate.hasScheduledAppointment);
}

export function resolveComposerTemplates(
  locale: AppLocale,
  templates: CandidateEmailTemplate[],
  confirmed: boolean
) {
  const localeDefaults = candidateEmailTemplatesFor(locale);
  const defaultTemplate =
    localeDefaults.find((template) => template.key === defaultCandidateEmailTemplate.key) ??
    localeDefaults[0]!;
  const confirmedTemplate =
    localeDefaults.find((template) => template.key === appointmentConfirmedEmailTemplate.key) ??
    defaultTemplate;
  const availableTemplates = templates.length > 0 ? templates : localeDefaults;
  const initialTemplate =
    availableTemplates.find(
      (template) => template.key === (confirmed ? confirmedTemplate.key : defaultTemplate.key)
    ) ?? (confirmed ? confirmedTemplate : defaultTemplate);

  return { availableTemplates, defaultTemplate, initialTemplate };
}
