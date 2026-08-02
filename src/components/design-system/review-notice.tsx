"use client";

import { useLocale } from "@/i18n/locale-provider";
import { InlineNotice } from "@/components/design-system/inline-notice";
export function ReviewNotice({ mode = "default" }: { mode?: "default" | "modify" | "pending" }) {
  const { t } = useLocale();
  const messageByMode = {
    default: t(
      "legacy.if_modifications_are_required_after_submission_the_new_modifications_nee.c2b8ea87"
    ),
    modify: t(
      "legacy.this_modification_will_not_take_effect_immediately_after_submission_it_w.09f53191"
    ),
    pending: t(
      "legacy.your_modification_request_is_waiting_for_review_by_the_administrator_the.e3b5216a"
    )
  };
  return (
    <InlineNotice
      tone={mode === "pending" ? "warning" : "info"}
      title={t("legacy.modify_review_reminder.118c2723")}
    >
      {messageByMode[mode]}
    </InlineNotice>
  );
}
