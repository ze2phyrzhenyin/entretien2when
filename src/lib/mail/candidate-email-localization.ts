import { normalizeLocale, type AppLocale } from "@/i18n/config";
import {
  buildAppointmentEmailContext,
  type AppointmentEmailContextInput
} from "@/lib/mail/appointment-email-context";

export type CandidateEmailLocalizedContent = Record<
  AppLocale,
  {
    subject: string;
    body: string;
  }
>;

export function selectCandidateEmailLocalizedContent(
  locale: AppLocale,
  content: CandidateEmailLocalizedContent
) {
  return content[locale];
}

export function buildLocalizedCandidateEmailRecipientPlan({
  preferredLocale,
  appointment,
  timezone,
  content
}: {
  preferredLocale: string;
  appointment?: AppointmentEmailContextInput | null;
  timezone: string;
  content: CandidateEmailLocalizedContent;
}) {
  const locale = normalizeLocale(preferredLocale);
  const localizedContent = selectCandidateEmailLocalizedContent(locale, content);
  return {
    locale,
    subject: localizedContent.subject,
    bodyTemplate: localizedContent.body,
    templateValues: buildAppointmentEmailContext(appointment, timezone, locale)
  };
}
