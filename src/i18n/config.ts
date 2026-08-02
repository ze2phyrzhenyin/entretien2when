import { getSessionCookiePath } from "@/lib/app-url";

export const supportedLocales = ["zh-CN", "en"] as const;
export type AppLocale = (typeof supportedLocales)[number];

// Anonymous UI visits start in English. Durable rows and artifacts created
// before locale support remain Chinese unless they carry an explicit locale.
export const defaultUiLocale: AppLocale = "en";
export const legacyContentLocale: AppLocale = "zh-CN";
export const defaultLocale: AppLocale = legacyContentLocale;
export const localeCookieName = "when2entretien_locale";

export function normalizeLocale(value: unknown): AppLocale {
  if (typeof value !== "string") return defaultLocale;
  const normalized = value.trim().toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return defaultLocale;
}

export function resolveUiLocale(value: unknown): AppLocale {
  if (typeof value !== "string") return defaultUiLocale;
  const normalized = value.trim().toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return defaultUiLocale;
}

export function isSupportedLocale(value: unknown): value is AppLocale {
  return value === "zh-CN" || value === "en";
}

export function getStaffNotificationLocale(): AppLocale {
  return normalizeLocale(process.env.STAFF_NOTIFICATION_LOCALE);
}

export function localeCookieOptions(basePath?: string) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: getSessionCookiePath(basePath),
    maxAge: 60 * 60 * 24 * 365
  };
}
