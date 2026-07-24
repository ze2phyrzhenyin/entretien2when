import { execFileSync } from "node:child_process";
import path from "node:path";

export default function globalSetup() {
  // A supplied browser origin can point to a shared environment. Never run a
  // schema-changing command there from a test runner.
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return;
  }

  if (process.env.WHEN2ENTRETIEN_ALLOW_E2E_MUTATION !== "1") {
    throw new Error(
      "Local E2E needs a disposable database. Run `pnpm test:e2e`, or set WHEN2ENTRETIEN_ALLOW_E2E_MUTATION=1 after confirming DATABASE_URL is safe to migrate."
    );
  }

  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  execFileSync(pnpm, ["exec", "prisma", "migrate", "deploy"], {
    cwd: path.resolve(import.meta.dirname, "../.."),
    env: process.env,
    stdio: "inherit"
  });
}
