import { getServerTranslator } from "@/i18n/server";
import { LoadingState } from "@/components/ui/loading-state";
export default async function CandidateLoading() {
  const { t } = await getServerTranslator();
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <LoadingState
          title={t("legacy.loading_interview_panel.32995edf")}
          description={t("legacy.reading_your_commit_status.ba100a7a")}
        />
      </div>
    </main>
  );
}
