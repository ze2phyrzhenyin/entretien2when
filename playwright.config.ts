import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { normalizeBasePath } from "./src/lib/app-url";

// Keep the browser origin aligned with Next's local development origin. A
// mixture of localhost and 127.0.0.1 creates separate cookie jars and made
// candidate session E2E tests appear flaky after an admin navigation.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";
const mailatoCommand =
  process.env.MAILATO_COMMAND ?? path.join(process.cwd(), "scripts/fake-mailato.mjs");
const mailatoDryRun = process.env.MAILATO_DRY_RUN ?? "true";
const configuredWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? "1", 10);
const productionBuild = process.env.PLAYWRIGHT_PRODUCTION_BUILD === "1";
const configuredBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const serverReadyUrl = `${baseURL}${configuredBasePath}/join`;
const browserOrigin = new URL(baseURL);
const legacyChineseStorageState = {
  cookies: [
    {
      name: "when2entretien_locale",
      value: "zh-CN",
      domain: browserOrigin.hostname,
      path: configuredBasePath || "/",
      expires: -1,
      httpOnly: false,
      secure: browserOrigin.protocol === "https:",
      sameSite: "Lax" as const
    }
  ],
  origins: []
};

// Local E2E must never inherit a developer's real Mailato credentials from
// .env. The worker process calls queue processors directly in several suites.
if (process.env.WHEN2ENTRETIEN_ALLOW_E2E_MUTATION === "1" && !process.env.PLAYWRIGHT_BASE_URL) {
  process.env.MAILATO_COMMAND = path.join(process.cwd(), "scripts/fake-mailato.mjs");
  process.env.MAILATO_DRY_RUN = "true";
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  // Suites share a database and the dev server performs a cold compilation on
  // first navigation. Keep the release gate deterministic until every suite
  // has fully isolated fixtures.
  workers: Number.isSafeInteger(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 1,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    storageState: legacyChineseStorageState,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: productionBuild
          ? "pnpm build && pnpm exec next start -H 127.0.0.1 -p 3101"
          : "pnpm exec next dev -H 127.0.0.1 -p 3101",
        env: {
          ...process.env,
          MAILATO_COMMAND: mailatoCommand,
          MAILATO_DRY_RUN: mailatoDryRun,
          CANDIDATE_AUTH_DEV_PREVIEW: "true"
        },
        url: serverReadyUrl,
        reuseExistingServer: !productionBuild,
        timeout: productionBuild ? 240_000 : 120_000
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
