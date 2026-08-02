"use client";

import { useLocale } from "@/i18n/locale-provider";
import { InlineNotice } from "@/components/design-system/inline-notice";
export function AdminOnlyNotice({ children }: { children?: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <InlineNotice tone="admin" title={t("legacy.administrators_only.fc66e66e")}>
      {children ??
        t("legacy.visible_only_to_administrators_candidates_will_not_see_this_section.74618342")}
    </InlineNotice>
  );
}
