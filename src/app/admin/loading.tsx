import { getServerTranslator } from "@/i18n/server";
import { LoadingState } from "@/components/ui/loading-state";
export default async function AdminLoading() {
  const { t } = await getServerTranslator();
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <LoadingState
          title={t("legacy.loading_background.65619c65")}
          description={t("legacy.reading_interview_group_and_candidate_data.a26c2395")}
        />
      </div>
    </main>
  );
}
