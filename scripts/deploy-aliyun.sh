#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ALIYUN_DIR="${ALIYUN_DIR:-$HOME/Developer/aliyun-root-login}"
LOGIN_SCRIPT="${LOGIN_SCRIPT:-$ALIYUN_DIR/login.sh}"
REMOTE_HOST="${REMOTE_HOST:-120.24.108.234}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/when2entretien}"
ENV_DIR="${ENV_DIR:-/etc/when2entretien}"
ENV_FILE="${ENV_FILE:-$ENV_DIR/when2entretien.env}"
RUNTIME_ROOT="${RUNTIME_ROOT:-/var/lib/when2entretien}"
SERVICE_NAME="${SERVICE_NAME:-when2entretien-web.service}"
SERVICE_USER="${SERVICE_USER:-when2entretien}"
APP_PORT="${APP_PORT:-5162}"
BASE_PATH="${BASE_PATH:-/when2entretien}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://$REMOTE_HOST$BASE_PATH}"
PG_PORT="${PG_PORT:-15432}"
DB_NAME="${DB_NAME:-when2entretien}"
DB_USER="${DB_USER:-when2entretien}"
RELEASE="${RELEASE:-$(date +%Y%m%d-%H%M%S)}"
SKIP_CHECKS=0
SKIP_PUBLIC_CHECK=0

usage() {
  cat <<EOF
Usage: scripts/deploy-aliyun.sh [options]

Deploy Interview Scheduler CN to the Aliyun host behind $BASE_PATH.

Options:
  --skip-checks          Skip local pnpm check before upload.
  --skip-public-check    Skip public curl check after deployment.
  --release <name>       Release directory name. Default: timestamp.
  -h, --help             Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-checks)
      SKIP_CHECKS=1
      shift
      ;;
    --skip-public-check)
      SKIP_PUBLIC_CHECK=1
      shift
      ;;
    --release)
      RELEASE="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

log() {
  printf '\n== %s ==\n' "$*"
}

[[ -x "$LOGIN_SCRIPT" ]] || {
  echo "Missing login script: $LOGIN_SCRIPT" >&2
  exit 1
}

if [[ "$SKIP_CHECKS" != "1" ]]; then
  log "Run local check"
  (cd "$PROJECT_DIR" && pnpm check)
fi

BUNDLE_ROOT="${BUNDLE_ROOT:-/tmp/when2entretien-aliyun-deploy}"
BUNDLE_DIR="$BUNDLE_ROOT/$RELEASE"
REMOTE_TGZ="/tmp/when2entretien-${RELEASE}.tgz"

log "Prepare bundle"
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"
tar -C "$PROJECT_DIR" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'artifacts' \
  --exclude 'test-results' \
  --exclude 'playwright-report' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '*.log' \
  -czf "$BUNDLE_DIR/app.tgz" .
ls -lh "$BUNDLE_DIR/app.tgz"

log "Upload bundle"
"$LOGIN_SCRIPT" "cat > $REMOTE_TGZ" < "$BUNDLE_DIR/app.tgz"

log "Install remote release"
"$LOGIN_SCRIPT" bash -s -- \
  "$REMOTE_ROOT" \
  "$RUNTIME_ROOT" \
  "$ENV_DIR" \
  "$ENV_FILE" \
  "$SERVICE_NAME" \
  "$SERVICE_USER" \
  "$APP_PORT" \
  "$BASE_PATH" \
  "$PUBLIC_ORIGIN" \
  "$RELEASE" \
  "$REMOTE_TGZ" \
  "$PG_PORT" \
  "$DB_NAME" \
  "$DB_USER" <<'REMOTE'
set -euo pipefail

REMOTE_ROOT="$1"
RUNTIME_ROOT="$2"
ENV_DIR="$3"
ENV_FILE="$4"
SERVICE_NAME="$5"
SERVICE_USER="$6"
APP_PORT="$7"
BASE_PATH="$8"
PUBLIC_ORIGIN="$9"
RELEASE="${10}"
REMOTE_TGZ="${11}"
PG_PORT="${12}"
DB_NAME="${13}"
DB_USER="${14}"
REMOTE_RELEASE="$REMOTE_ROOT/releases/$RELEASE"

mkdir -p "$REMOTE_ROOT/releases" "$REMOTE_RELEASE" "$RUNTIME_ROOT" "$ENV_DIR"
tar --no-same-owner -C "$REMOTE_RELEASE" -xzf "$REMOTE_TGZ"
rm -f "$REMOTE_TGZ"

if ! getent group "$SERVICE_USER" >/dev/null 2>&1; then
  groupadd --system "$SERVICE_USER"
fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --gid "$SERVICE_USER" --home-dir "$RUNTIME_ROOT" --shell /sbin/nologin "$SERVICE_USER"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$RUNTIME_ROOT"
chmod 750 "$RUNTIME_ROOT"
if [[ -f /etc/mailato/mailato.env ]]; then
  chgrp "$SERVICE_USER" /etc/mailato/mailato.env
  chmod 640 /etc/mailato/mailato.env
fi

if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"
  sudo -iu postgres psql -p "$PG_PORT" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER ROLE "$DB_USER" WITH LOGIN PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE "$DB_NAME" OWNER "$DB_USER"'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DB_NAME')\gexec
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";
SQL
  cat > "$ENV_FILE" <<EOF_ENV
NODE_ENV=production
PORT=$APP_PORT
HOSTNAME=127.0.0.1
HOME=$RUNTIME_ROOT
APP_URL=$PUBLIC_ORIGIN
NEXT_PUBLIC_BASE_PATH=$BASE_PATH
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:$PG_PORT/$DB_NAME?schema=public
SESSION_TTL_DAYS=7
MAILATO_COMMAND=/usr/local/bin/mailato
MAILATO_DRY_RUN=false
ADMIN_BOOTSTRAP_EMAIL=admin@when2entretien.local
ADMIN_BOOTSTRAP_PASSWORD=$ADMIN_PASSWORD
ADMIN_BOOTSTRAP_NAME=远端超级管理员
EOF_ENV
  chmod 600 "$ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

sudo -iu postgres psql -p "$PG_PORT" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
ALTER SCHEMA public OWNER TO "$DB_USER";
GRANT USAGE, CREATE ON SCHEMA public TO "$DB_USER";
SQL

HBA_FILE="$(sudo -iu postgres psql -p "$PG_PORT" -Atc 'show hba_file')"
HBA_RULE="host    $DB_NAME    $DB_USER    127.0.0.1/32    md5"
if ! grep -Fq "$HBA_RULE" "$HBA_FILE"; then
  cp "$HBA_FILE" "$HBA_FILE.bak.when2entretien.$(date +%Y%m%d%H%M%S)"
  tmp_hba="$(mktemp)"
  {
    echo "$HBA_RULE"
    cat "$HBA_FILE"
  } > "$tmp_hba"
  cat "$tmp_hba" > "$HBA_FILE"
  rm -f "$tmp_hba"
  chown postgres:postgres "$HBA_FILE"
  chmod 600 "$HBA_FILE"
  sudo -iu postgres psql -p "$PG_PORT" -c "select pg_reload_conf();" >/dev/null
fi

cd "$REMOTE_RELEASE"
npm install --include=dev --no-audit --no-fund
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build
npx prisma migrate deploy
npm run db:seed

ln -sfn "$REMOTE_RELEASE" "$REMOTE_ROOT/current"
chown -R root:root "$REMOTE_RELEASE"
chmod -R a+rX "$REMOTE_RELEASE"
chmod 755 "$REMOTE_ROOT" "$REMOTE_ROOT/releases" "$REMOTE_RELEASE"

cat > "/etc/systemd/system/$SERVICE_NAME" <<EOF_SERVICE
[Unit]
Description=Interview Scheduler CN Next.js Web
After=network.target postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$REMOTE_ROOT/current
EnvironmentFile=$ENV_FILE
ExecStart=$REMOTE_ROOT/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p $APP_PORT
Restart=always
RestartSec=5
KillSignal=SIGINT
SyslogIdentifier=when2entretien-web
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF_SERVICE

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

if [[ -f /www/server/panel/vhost/nginx/00-thesisforma.conf && -f /www/server/nginx/conf/nginx.conf ]]; then
  NGINX_CONF="/www/server/panel/vhost/nginx/00-thesisforma.conf"
  NGINX_BIN="/www/server/nginx/sbin/nginx"
  NGINX_MAIN="/www/server/nginx/conf/nginx.conf"
elif [[ -f /etc/nginx/conf.d/thesisforma.conf ]]; then
  NGINX_CONF="/etc/nginx/conf.d/thesisforma.conf"
  NGINX_BIN="$(command -v nginx)"
  NGINX_MAIN=""
else
  echo "root nginx config not found." >&2
  exit 1
fi

cp "$NGINX_CONF" "$NGINX_CONF.bak.when2entretien.$(date +%Y%m%d%H%M%S)"
python3 - "$NGINX_CONF" "$BASE_PATH" "$APP_PORT" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
base_path = sys.argv[2]
app_port = sys.argv[3]
text = path.read_text()

block = f"""    location = {base_path} {{
        proxy_pass http://127.0.0.1:{app_port};
        proxy_http_version 1.1;
        proxy_cache off;
        proxy_cache_bypass 1;
        proxy_no_cache 1;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix {base_path};
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }}

    location ^~ {base_path}/ {{
        proxy_pass http://127.0.0.1:{app_port};
        proxy_http_version 1.1;
        proxy_cache off;
        proxy_cache_bypass 1;
        proxy_no_cache 1;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix {base_path};
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }}
"""

escaped = re.escape(base_path)
pattern = rf"    location = {escaped} \{{\n.*?\n    \}}\n\n    location \^~ {escaped}/ \{{\n.*?\n    \}}\n"
if re.search(pattern, text, flags=re.S):
    text = re.sub(pattern, block, text, count=1, flags=re.S)
else:
    marker = "    location = /portal {\n"
    if marker not in text:
        marker = "    location = /siteweb/ {\n"
    if marker not in text:
        marker = "    location = / {\n"
    if marker not in text:
        raise SystemExit(f"Could not find insertion point in {path}")
    text = text.replace(marker, block + "\n" + marker, 1)

path.write_text(text)
PY

if [[ -n "$NGINX_MAIN" ]]; then
  "$NGINX_BIN" -t -c "$NGINX_MAIN"
else
  "$NGINX_BIN" -t
fi

systemctl enable nginx >/dev/null 2>&1 || true
if systemctl is-active --quiet nginx; then
  systemctl reload nginx || systemctl restart nginx || true
else
  systemctl start nginx || /etc/rc.d/init.d/nginx start || true
fi

for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$APP_PORT$BASE_PATH/api/health" >/tmp/when2entretien-health.json; then
    break
  fi
  if [[ "$i" == "60" ]]; then
    systemctl status "$SERVICE_NAME" --no-pager -l >&2 || true
    journalctl -u "$SERVICE_NAME" -n 120 --no-pager >&2 || true
    exit 1
  fi
  sleep 1
done
grep -q 'interview-scheduler-cn' /tmp/when2entretien-health.json
curl -fsS -H "Host: 120.24.108.234" "http://127.0.0.1$BASE_PATH/api/health" >/tmp/when2entretien-nginx-health.json
grep -q 'interview-scheduler-cn' /tmp/when2entretien-nginx-health.json

old_releases="$(ls -1dt "$REMOTE_ROOT"/releases/* 2>/dev/null | tail -n +6 || true)"
if [[ -n "$old_releases" ]]; then
  printf '%s\n' "$old_releases" | xargs rm -rf
fi

cat <<EOF
REMOTE_DEPLOY_OK=1
RELEASE=$RELEASE
CURRENT=$REMOTE_ROOT/current
SERVICE=$SERVICE_NAME
PUBLIC_URL=$PUBLIC_ORIGIN
ENV_FILE=$ENV_FILE
EOF
REMOTE

if [[ "$SKIP_PUBLIC_CHECK" != "1" ]]; then
  log "Public check"
  curl -fsS --max-time 20 "$PUBLIC_ORIGIN/api/health" -o /tmp/when2entretien-public-health.json
  grep -q 'interview-scheduler-cn' /tmp/when2entretien-public-health.json
fi

log "Done"
cat <<EOF
Open:
  $PUBLIC_ORIGIN
EOF
