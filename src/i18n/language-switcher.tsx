"use client";

import { Languages } from "lucide-react";
import { useLocale } from "./locale-provider";

export function LanguageSwitcher() {
  const { locale, localeSyncStatus, retryLocaleSync, setLocale, t } = useLocale();
  return (
    <div className="fixed right-3 top-3 z-[100] flex flex-col items-end gap-1 print:hidden">
      <div
        className="inline-flex items-center gap-1 rounded-full border border-border bg-background/95 p-1 text-xs shadow-sm backdrop-blur"
        role="group"
        aria-label={t("common.language.label")}
        data-i18n-preserve
      >
        <Languages className="ml-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {(["zh-CN", "en"] as const).map((option) => {
          const label = option === "zh-CN" ? t("common.language.zh") : t("common.language.en");
          const selected = locale === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setLocale(option)}
              aria-pressed={selected}
              aria-label={t("common.language.switchTo", { language: label })}
              className={`rounded-full px-2.5 py-1 font-medium transition ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {localeSyncStatus === "error" ? (
        <div
          className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-danger shadow-sm"
          role="alert"
        >
          <span>{t("common.language.syncError")}</span>
          <button type="button" className="font-semibold underline" onClick={retryLocaleSync}>
            {t("common.language.retry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
