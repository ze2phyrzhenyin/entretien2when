import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
export default async function NotFound() {
  const { t } = await getServerTranslator();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
      <ErrorState
        title={t("legacy.page_not_found.e75737c1")}
        description={t("legacy.please_check_if_the_link_is_correct.b3e6f8ce")}
        className="w-full"
        action={
          <Button asChild>
            <Link href="/join">{t("legacy.back_to_entry.74afc7d6")}</Link>
          </Button>
        }
      />
    </main>
  );
}
