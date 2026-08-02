import { getServerTranslator } from "@/i18n/server";
import { LoadingState } from "@/components/ui/loading-state";
export default async function Loading() {
  const { t } = await getServerTranslator();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
      <LoadingState
        title={t("legacy.loading_page.f696ef85")}
        description={t("legacy.please_wait.043bd055")}
        className="w-full"
      />
    </main>
  );
}
