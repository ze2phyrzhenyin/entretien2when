"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import { catalogs, createTranslator, type MessageKey } from "./catalogs";
import { localeCookieName, normalizeLocale, type AppLocale } from "./config";
import { persistLocaleWithRetry } from "./locale-persistence";

type LocaleSyncStatus = "idle" | "saving" | "error";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  localeSyncStatus: LocaleSyncStatus;
  retryLocaleSync: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function currentCandidateGroupCode() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const pathname = window.location.pathname.startsWith(basePath)
    ? window.location.pathname.slice(basePath.length)
    : window.location.pathname;
  const groupCode = /^\/candidate\/([^/]+)/u.exec(pathname)?.[1];
  return groupCode === "auth" ? undefined : groupCode;
}

export function LocaleProvider({
  initialLocale,
  children
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, updateLocale] = useState(() => normalizeLocale(initialLocale));
  const [localeSyncStatus, setLocaleSyncStatus] = useState<LocaleSyncStatus>("idle");
  const syncVersion = useRef(0);
  const translate = useMemo(() => createTranslator(locale), [locale]);
  const persistLocale = useCallback((nextLocale: AppLocale) => {
    const groupCode = currentCandidateGroupCode();
    if (!groupCode) {
      setLocaleSyncStatus("idle");
      return;
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const version = syncVersion.current + 1;
    syncVersion.current = version;
    setLocaleSyncStatus("saving");
    void persistLocaleWithRetry({
      url: `${basePath}/api/locale`,
      locale: nextLocale,
      groupCode
    })
      .then(() => {
        if (syncVersion.current === version) setLocaleSyncStatus("idle");
      })
      .catch(() => {
        if (syncVersion.current === version) setLocaleSyncStatus("error");
      });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = catalogs[locale]["metadata.title"];
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", catalogs[locale]["metadata.description"]);
  }, [locale]);

  // Keep an already authenticated candidate session aligned with the locale
  // selected before this page was opened (for example via a saved cookie).
  useEffect(() => {
    persistLocale(locale);
  }, [locale, persistLocale]);

  const setLocale = useCallback(
    (nextLocale: AppLocale) => {
      const normalized = normalizeLocale(nextLocale);
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const cookiePath = basePath || "/";
      document.cookie = [
        `${localeCookieName}=${encodeURIComponent(normalized)}`,
        `Path=${cookiePath}`,
        "Max-Age=31536000",
        "SameSite=Lax",
        ...(window.location.protocol === "https:" ? ["Secure"] : [])
      ].join("; ");
      startTransition(() => {
        updateLocale(normalized);
        // Server Components read the locale cookie. A refresh merges their new
        // payload while React preserves mounted Client Component form state.
        router.refresh();
      });
    },
    [router]
  );

  const retryLocaleSync = useCallback(() => persistLocale(locale), [locale, persistLocale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      localeSyncStatus,
      retryLocaleSync,
      t: translate
    }),
    [locale, localeSyncStatus, retryLocaleSync, setLocale, translate]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
