import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { Clock } from "lucide-react";
import { ReviewNotice } from "@/components/design-system/review-notice";
import { Card } from "@/components/ui/card";
import { TimeRangePreview } from "@/components/scheduling/time-range-preview";
import type { TimeRangeItem } from "@/components/scheduling/types";
export async function CandidateSubmittedSummary({
  slots,
  defaultTimezone,
  note,
  modifyHref,
  hasPendingSubmission,
  canRequestModification
}: {
  slots: TimeRangeItem[];
  defaultTimezone: string;
  note?: string | null;
  modifyHref?: string;
  hasPendingSubmission: boolean;
  canRequestModification: boolean;
}) {
  const { t } = await getServerTranslator();
  return (
    <Card className="p-6" variant="flat">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{t("legacy.current_available_time.ad871025")}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {canRequestModification
              ? t(
                  "legacy.if_you_need_to_modify_it_you_need_to_submit_an_application_and_wait_for_.1e1910fc"
                )
              : t(
                  "legacy.there_are_currently_formal_interview_arrangements_or_applications_pendin.f3c3af09"
                )}
          </p>
        </div>
        {canRequestModification && modifyHref ? (
          <Link
            href={modifyHref}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-subtle"
          >
            {t("legacy.apply_for_modification.a300bfbe")}
          </Link>
        ) : null}
      </div>
      <div className="mt-5">
        <TimeRangePreview items={slots} defaultTimezone={defaultTimezone} />
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium">{t("legacy.candidate_notes.23fc9983")}</p>
        <p className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm leading-6 text-muted-foreground">
          {note || t("legacy.not_filled_in.7f051905")}
        </p>
      </div>
      {hasPendingSubmission ? (
        <div className="mt-5">
          <ReviewNotice mode="pending" />
        </div>
      ) : null}
    </Card>
  );
}
