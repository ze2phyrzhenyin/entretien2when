import { getServerTranslator } from "@/i18n/server";
import { LockKeyhole } from "lucide-react";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PrivacyNotice } from "@/components/design-system/privacy-notice";
import { CenteredCardLayout } from "@/components/layout/centered-card-layout";
import { JoinForm } from "./join-form";
import type { MessageKey } from "@/i18n/catalogs";
type JoinPageProps = {
  searchParams: Promise<{
    access?: string;
  }>;
};
function accessNotice(access?: string): MessageKey | null {
  if (access === "invalid") {
    return "legacy.the_access_link_is_invalid_or_expired_please_resend_the_access_link.d3b22faa";
  }
  if (access === "required") {
    return "legacy.please_first_access_the_candidate_page_by_accessing_the_link_via_email.fea8cf4b";
  }
  if (access === "group-not-open") {
    return "legacy.the_interview_group_does_not_exist_or_is_not_open_yet.f4b905c5";
  }
  return null;
}
export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { t } = await getServerTranslator();
  const query = await searchParams;
  const notice = accessNotice(query.access);
  return (
    <CenteredCardLayout>
      <div className="mb-6">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">{t("legacy.submit_availability.112035c7")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(
            "legacy.please_enter_your_name_email_address_and_interview_group_number_to_enter.400f483d"
          )}
        </p>
      </div>

      {notice ? (
        <InlineNotice tone="warning" className="mb-5">
          {t(notice)}
        </InlineNotice>
      ) : null}

      <JoinForm />

      <div className="mt-5">
        <PrivacyNotice />
      </div>
    </CenteredCardLayout>
  );
}
