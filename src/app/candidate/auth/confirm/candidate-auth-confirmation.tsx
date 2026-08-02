"use client";
import { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/app-url";
import { isCandidateToken } from "@/lib/auth/candidate-token-format";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { isSupportedLocale, type AppLocale } from "@/i18n/config";
export function CandidateAuthConfirmation() {
  const { locale, setLocale, t } = useLocale();
  const [token, setToken] = useState("");
  const [submissionLocale, setSubmissionLocale] = useState(locale);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);
  const pendingLinkLocale = useRef<AppLocale | null>(null);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const url = new URL(window.location.href);
    const requestedLocale = url.searchParams.get("lang");
    const linkLocale = isSupportedLocale(requestedLocale) ? requestedLocale : locale;
    const fragmentToken = decodeURIComponent(window.location.hash.slice(1));
    setToken(isCandidateToken(fragmentToken) ? fragmentToken : "");
    setSubmissionLocale(linkLocale);
    pendingLinkLocale.current = linkLocale !== locale ? linkLocale : null;
    setReady(true);
    // Remove both the bearer token and one-time locale hint. Keeping `lang`
    // would override a later language choice on refresh/back navigation.
    url.hash = "";
    url.searchParams.delete("lang");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    if (isSupportedLocale(requestedLocale) && linkLocale !== locale) setLocale(linkLocale);
  }, [locale, setLocale]);

  useEffect(() => {
    if (!ready) return;
    if (pendingLinkLocale.current && pendingLinkLocale.current !== locale) return;
    pendingLinkLocale.current = null;
    setSubmissionLocale(locale);
  }, [locale, ready]);
  if (!ready) {
    return (
      <p className="mt-5 text-sm text-muted-foreground">
        {t("legacy.checking_access_link.d51c8760")}
      </p>
    );
  }
  if (!token) {
    return (
      <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t(
          "legacy.the_access_link_is_invalid_or_the_one_time_voucher_is_missing_please_reo.32545377"
        )}
      </p>
    );
  }
  return (
    <form action={withBasePath("/candidate/auth/consume")} method="post" className="mt-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={submissionLocale} />
      <Button type="submit" className="w-full">
        {t("legacy.continue_to_enter.81c9bc54")}
      </Button>
    </form>
  );
}
