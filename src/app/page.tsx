import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
export default async function HomePage() {
  const { t } = await getServerTranslator();
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            {t("legacy.interview_scheduling.14061728")}
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {t(
              "legacy.professional_collaboration_tool_for_candidate_privacy_isolation_modifica.0c654adf"
            )}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/join">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {t("legacy.submit_availability.112035c7")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/login">{t("legacy.administrator_sign_in.c454c61e")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
