import { cookies } from "next/headers";
import { createTranslator } from "./catalogs";
import { defaultUiLocale, localeCookieName, resolveUiLocale, type AppLocale } from "./config";

export async function getRequestLocale(): Promise<AppLocale> {
  try {
    const cookieStore = await cookies();
    return resolveUiLocale(cookieStore.get(localeCookieName)?.value);
  } catch {
    return defaultUiLocale;
  }
}

export async function getServerTranslator() {
  const locale = await getRequestLocale();
  return { locale, t: createTranslator(locale) };
}
