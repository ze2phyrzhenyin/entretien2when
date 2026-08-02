import type { AppLocale } from "./config";

type FetchResult = { ok: boolean };
type LocaleFetch = (input: string, init: RequestInit) => Promise<FetchResult>;

export async function persistLocaleWithRetry({
  url,
  locale,
  groupCode,
  fetcher = fetch,
  attempts = 3,
  wait = (delayMs: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, delayMs);
    })
}: {
  url: string;
  locale: AppLocale;
  groupCode: string;
  fetcher?: LocaleFetch;
  attempts?: number;
  wait?: (delayMs: number) => Promise<void>;
}) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, groupCode }),
        credentials: "same-origin"
      });
      if (response.ok) return;
      lastError = new Error(`Locale persistence failed with status ${response.ok ? 200 : 500}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt + 1 < attempts) await wait(150 * 3 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Locale persistence failed");
}
