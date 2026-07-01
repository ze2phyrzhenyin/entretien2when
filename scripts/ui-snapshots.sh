#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${PLAYWRIGHT_BASE_URL:-}" ]]; then
  BASE_URL="$PLAYWRIGHT_BASE_URL"
  SHOULD_START_SERVER="false"
else
  SNAPSHOT_PORT="${PLAYWRIGHT_PORT:-3100}"
  BASE_URL="http://127.0.0.1:${SNAPSHOT_PORT}"
  SHOULD_START_SERVER="true"
fi
OUT_DIR="artifacts/ui-snapshots/frontend-refactor-p0"
mkdir -p "$OUT_DIR"

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

check_health() {
  curl -fsS --max-time 2 "$BASE_URL/api/health" >/dev/null 2>&1
}

if ! check_health && [[ "$SHOULD_START_SERVER" == "true" ]]; then
  echo "Local server is not reachable at $BASE_URL. Starting next start."
  if [[ ! -f ".next/BUILD_ID" ]]; then
    pnpm build
  fi
  pnpm exec next start -H 127.0.0.1 -p "$SNAPSHOT_PORT" > artifacts/ui-snapshots-server.log 2>&1 &
  SERVER_PID="$!"

  for _ in {1..60}; do
    if check_health; then
      break
    fi
    sleep 1
  done
fi

if ! check_health; then
  echo "Dev server failed to become ready at $BASE_URL."
  exit 1
fi

if ! node -e "try { const fs=require('node:fs'); const { chromium }=require('@playwright/test'); process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1); } catch { process.exit(1); }"; then
  echo "Playwright Chromium is not installed; cannot capture screenshots."
  exit 1
fi

PLAYWRIGHT_BASE_URL="$BASE_URL" env -u NO_COLOR pnpm exec playwright test tests/e2e/ui-snapshots.spec.ts
echo "Screenshots saved to $OUT_DIR"
