"use client";
import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default function AdminError({
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
          title={t("legacy.background_loading_failed.56c3d002")}
          description={t(
            "legacy.please_confirm_account_permissions_and_network_status_and_try_again.4fe53739"
          )}
          action={<Button onClick={reset}>{t("legacy.try_again.b8784c8d")}</Button>}
        />
      </div>
    </main>
  );
}
