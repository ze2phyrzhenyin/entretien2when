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
rm -f "$OUT_DIR"/*.png

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

if [[ -z "${PLAYWRIGHT_ADMIN_EMAIL:-}" ||
  -z "${PLAYWRIGHT_ADMIN_PASSWORD:-}" ||
  -z "${PLAYWRIGHT_GROUP_ID:-}" ||
  -z "${PLAYWRIGHT_GROUP_CODE:-}" ||
  -z "${PLAYWRIGHT_CANDIDATE_ID:-}" ||
  -z "${PLAYWRIGHT_SUBMISSION_ID:-}" ]]; then
  echo "Preparing demo screenshot data."
  DEMO_JSON_FILE="$OUT_DIR/demo-data.json"
  pnpm --silent db:seed:demo > "$DEMO_JSON_FILE"

  export PLAYWRIGHT_ADMIN_EMAIL
  export PLAYWRIGHT_ADMIN_PASSWORD
  export PLAYWRIGHT_GROUP_ID
  export PLAYWRIGHT_GROUP_CODE
  export PLAYWRIGHT_CANDIDATE_ID
  export PLAYWRIGHT_SUBMISSION_ID

  PLAYWRIGHT_ADMIN_EMAIL="$(node -e "const data=require('./$DEMO_JSON_FILE'); process.stdout.write(data.adminEmail)")"
  PLAYWRIGHT_ADMIN_PASSWORD="$(node -e "const data=require('./$DEMO_JSON_FILE'); process.stdout.write(data.adminPassword)")"
  PLAYWRIGHT_GROUP_ID="$(node -e "const data=require('./$DEMO_JSON_FILE'); process.stdout.write(data.groupId)")"
  PLAYWRIGHT_GROUP_CODE="$(node -e "const data=require('./$DEMO_JSON_FILE'); process.stdout.write(data.groupCode)")"
  PLAYWRIGHT_CANDIDATE_ID="$(node -e "const data=require('./$DEMO_JSON_FILE'); process.stdout.write(data.candidateId)")"
  PLAYWRIGHT_SUBMISSION_ID="$(node -e "const data=require('./$DEMO_JSON_FILE'); process.stdout.write(data.submissionId)")"
fi

if ! node -e "try { const fs=require('node:fs'); const { chromium }=require('@playwright/test'); process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1); } catch { process.exit(1); }"; then
  echo "Playwright Chromium is not installed; cannot capture screenshots."
  exit 1
fi

PLAYWRIGHT_BASE_URL="$BASE_URL" env -u NO_COLOR pnpm exec playwright test tests/e2e/ui-snapshots.spec.ts
echo "Screenshots saved to $OUT_DIR"
