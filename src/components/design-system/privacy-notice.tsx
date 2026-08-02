import { getServerTranslator } from "@/i18n/server";
import { InlineNotice } from "@/components/design-system/inline-notice";
export async function PrivacyNotice({ children }: { children?: React.ReactNode }) {
  const { t } = await getServerTranslator();
  return (
    <InlineNotice tone="privacy" title={t("legacy.privacy_notice.be9ed843")}>
      {children ?? t("legacy.your_information_will_not_be_displayed_to_other_candidates.77ccb540")}
    </InlineNotice>
  );
}
