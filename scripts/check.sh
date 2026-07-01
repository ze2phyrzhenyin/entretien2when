#!/usr/bin/env bash
set -euo pipefail

echo "1/5 format check"
pnpm format:check

echo "2/5 lint"
pnpm lint

echo "3/5 typecheck"
pnpm typecheck

echo "4/5 unit tests"
pnpm test

echo "5/5 build"
pnpm build

if command -v pnpm >/dev/null 2>&1 && pnpm exec playwright --version >/dev/null 2>&1; then
  if node -e "try { const fs=require('node:fs'); const { chromium }=require('@playwright/test'); process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1); } catch { process.exit(1); }"; then
    echo "Optional e2e smoke"
    pnpm exec playwright test --grep "@smoke"
  else
    echo "Playwright Chromium is not installed; skipped e2e smoke with explicit notice."
  fi
else
  echo "Playwright is not available; skipped e2e smoke with explicit notice."
fi
