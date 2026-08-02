"use client";
import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default function RootError({
  reset
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  const { t } = useLocale();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
      <ErrorState
        title={t("legacy.page_failed_to_load.cfa50627")}
        description={t("legacy.please_try_again_later_or_return_to_the_previous_page.dbd2ab7d")}
        className="w-full"
        action={<Button onClick={reset}>{t("legacy.try_again.b8784c8d")}</Button>}
      />
    </main>
  );
}
