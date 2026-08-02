import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { CandidateShell } from "@/components/layout/candidate-shell";
import { Card } from "@/components/ui/card";
import { CandidateAuthConfirmation } from "./candidate-auth-confirmation";
export const metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true
  }
};
export default async function CandidateAuthConfirmationPage() {
  const { t } = await getServerTranslator();
  return (
    <CandidateShell size="narrow">
      <Card className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">
          {t("legacy.confirm_to_enter_the_candidate_page.61ec5e72")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(
            "legacy.to_prevent_email_security_scanners_from_using_the_link_prematurely_make_.ef983f78"
          )}
        </p>
        <CandidateAuthConfirmation />
        <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
          {t("legacy.return_to_fill_in_the_entry.eeb690e4")}
        </Link>
      </Card>
    </CandidateShell>
  );
}
