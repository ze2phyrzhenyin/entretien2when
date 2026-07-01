#!/usr/bin/env bash
set -euo pipefail

echo "Node: $(node --version 2>/dev/null || echo missing)"
echo "pnpm: $(pnpm --version 2>/dev/null || echo missing)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL: missing in current shell; copy .env.example to .env before db commands"
else
  echo "DATABASE_URL: set"
fi

echo "Prisma generate:"
pnpm db:generate

echo "Database connection:"
if [[ -n "${DATABASE_URL:-}" ]]; then
  pnpm exec prisma db execute --stdin <<< "SELECT 1;" || echo "Database connection failed"
else
  echo "Skipped database connection check because DATABASE_URL is not exported"
fi

echo "Playwright:"
pnpm exec playwright --version || echo "Playwright package missing"
if pnpm exec playwright install --dry-run chromium >/dev/null 2>&1; then
  echo "Playwright chromium dry-run succeeded"
else
  echo "Playwright browsers may not be installed"
fi
