import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3101";
const mailatoCommand =
  process.env.MAILATO_COMMAND ?? path.join(process.cwd(), "scripts/fake-mailato.mjs");
const mailatoDryRun = process.env.MAILATO_DRY_RUN ?? "true";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next dev -H 127.0.0.1 -p 3101",
        env: {
          ...process.env,
          MAILATO_COMMAND: mailatoCommand,
          MAILATO_DRY_RUN: mailatoDryRun
        },
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
