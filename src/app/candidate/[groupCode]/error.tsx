"use client";
import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default function CandidateError({
  reset
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  const { t } = useLocale();
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title={t("legacy.candidate_page_failed_to_load.9680d654")}
          description={t(
            "legacy.please_check_if_the_interview_group_number_is_correct_or_try_again_later.27eb3ddf"
          )}
          action={<Button onClick={reset}>{t("legacy.try_again.b8784c8d")}</Button>}
        />
      </div>
    </main>
  );
}
