import type { Metadata } from "next";
import "@/styles/globals.css";
import { catalogs } from "@/i18n/catalogs";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: catalogs[locale]["metadata.title"],
    description: catalogs[locale]["metadata.description"]
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <LanguageSwitcher />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
