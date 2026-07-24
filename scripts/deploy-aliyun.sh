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
# A public, certificate-validated HTTPS origin is mandatory.  Do not fall back
# to the server IP over HTTP: this application handles credentials and PII.
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"
PG_PORT="${PG_PORT:-15432}"
DB_NAME="${DB_NAME:-when2entretien}"
DB_USER="${DB_USER:-when2entretien}"
PNPM_VERSION="${PNPM_VERSION:-10.29.2}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"
# Set these only for a dedicated, managed TLS vhost. The fallback keeps the
# original legacy vhost discovery for existing installations.
NGINX_CONF="${NGINX_CONF:-}"
NGINX_BIN="${NGINX_BIN:-}"
NGINX_MAIN="${NGINX_MAIN:-}"
RELEASE="${RELEASE:-$(date +%Y%m%d-%H%M%S)}"
SKIP_CHECKS=0
SKIP_PUBLIC_CHECK=0
BOOTSTRAP_ADMIN=0

usage() {
  cat <<EOF
Usage: scripts/deploy-aliyun.sh [options]

Deploy Interview Scheduler CN to the Aliyun host behind $BASE_PATH.

Set PUBLIC_ORIGIN to the final HTTPS URL, for example:
  PUBLIC_ORIGIN=https://interviews.example.com$BASE_PATH $0

Options:
  --skip-checks          Skip local pnpm check before upload.
  --skip-public-check    Skip public curl check after deployment.
  --bootstrap-admin      Create the initial super admin only when the production
                         database has no administrators. Never resets an account.
  --backup-keep <count>  Keep this many pre-migration database backups. Default: 7.
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
    --bootstrap-admin)
      BOOTSTRAP_ADMIN=1
      shift
      ;;
    --backup-keep)
      BACKUP_KEEP="$2"
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

PUBLIC_ORIGIN="${PUBLIC_ORIGIN%/}"

if [[ "$BASE_PATH" != /* || "$BASE_PATH" == *".."* || "$BASE_PATH" == *[[:space:]]* ]]; then
  echo "BASE_PATH must be an absolute, non-traversing path." >&2
  exit 1
fi

if [[ -z "$PUBLIC_ORIGIN" || ! "$PUBLIC_ORIGIN" =~ ^https://[^/[:space:]]+/.+ ]]; then
  echo "PUBLIC_ORIGIN must be an absolute HTTPS URL containing BASE_PATH; HTTP deployment is refused." >&2
  exit 1
fi

public_origin_without_scheme="${PUBLIC_ORIGIN#https://}"
public_origin_path="/${public_origin_without_scheme#*/}"
if [[ "$PUBLIC_ORIGIN" == *[?#]* || "$public_origin_path" != "$BASE_PATH" ]]; then
  echo "PUBLIC_ORIGIN must use BASE_PATH exactly ($BASE_PATH), without query or fragment." >&2
  exit 1
fi

if [[ ! "$RELEASE" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Release names may contain only letters, digits, dot, underscore, and hyphen." >&2
  exit 1
fi

if [[ ! "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ || ! "$DB_USER" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
  echo "DB_NAME and DB_USER must be safe PostgreSQL identifiers." >&2
  exit 1
fi

if [[ ! "$APP_PORT" =~ ^[1-9][0-9]{0,4}$ || "$APP_PORT" -gt 65535 ]]; then
  echo "APP_PORT must be a valid TCP port." >&2
  exit 1
fi

if [[ ! "$PG_PORT" =~ ^[1-9][0-9]{0,4}$ || "$PG_PORT" -gt 65535 ]]; then
  echo "PG_PORT must be a valid TCP port." >&2
  exit 1
fi

if [[ ! "$PNPM_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "PNPM_VERSION must be an exact semver version." >&2
  exit 1
fi

if [[ ! "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_KEEP must be a positive integer." >&2
  exit 1
fi

if [[ -n "$NGINX_CONF" && "$NGINX_CONF" != /www/server/panel/vhost/nginx/*.conf && "$NGINX_CONF" != /etc/nginx/conf.d/*.conf ]]; then
  echo "NGINX_CONF must be a dedicated managed vhost under the nginx configuration directory." >&2
  exit 1
fi

log() {
  printf '\n== %s ==\n' "$*"
}

[[ -x "$LOGIN_SCRIPT" ]] || {
  echo "Missing login script: $LOGIN_SCRIPT" >&2
  exit 1
}

log "Verify public HTTPS and HTTP redirect"
https_status="$(curl --silent --show-error --max-time 20 --output /dev/null --write-out '%{http_code}' "$PUBLIC_ORIGIN/" || true)"
if [[ "$https_status" == "000" || -z "$https_status" ]]; then
  echo "PUBLIC_ORIGIN must already serve a certificate-validated HTTPS endpoint before deployment." >&2
  exit 1
fi

http_origin="http://${PUBLIC_ORIGIN#https://}"
http_headers="$(curl --silent --show-error --max-time 20 --dump-header - --output /dev/null "$http_origin/" || true)"
http_status="$(printf '%s\n' "$http_headers" | awk 'NR == 1 { print $2 }')"
http_location="$(printf '%s\n' "$http_headers" | awk 'BEGIN { IGNORECASE = 1 } /^location:/ { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit }')"
if [[ ! "$http_status" =~ ^(301|302|307|308)$ || "$http_location" != "$PUBLIC_ORIGIN"* ]]; then
  echo "The HTTP endpoint must redirect to the configured HTTPS origin before deployment." >&2
  exit 1
fi

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
  --exclude '.env*' \
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
  "$DB_USER" \
  "$BOOTSTRAP_ADMIN" \
  "$PNPM_VERSION" \
  "$BACKUP_KEEP" \
  "$NGINX_CONF" \
  "$NGINX_BIN" \
  "$NGINX_MAIN" <<'REMOTE'
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
BOOTSTRAP_ADMIN="${15}"
PNPM_VERSION="${16}"
BACKUP_KEEP="${17}"
REQUESTED_NGINX_CONF="${18}"
REQUESTED_NGINX_BIN="${19}"
REQUESTED_NGINX_MAIN="${20}"
PUBLIC_HOST="${PUBLIC_ORIGIN#https://}"
PUBLIC_HOST="${PUBLIC_HOST%%/*}"
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
  database_exists="$(sudo -iu postgres psql -p "$PG_PORT" -Atqc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" || true)"
  role_exists="$(sudo -iu postgres psql -p "$PG_PORT" -Atqc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" || true)"
  if [[ -n "$database_exists" || -n "$role_exists" ]]; then
    echo "Refusing to recreate a missing environment file for an existing database or role. Restore $ENV_FILE from the deployment secret store first." >&2
    exit 1
  fi

  DB_PASSWORD="$(openssl rand -hex 24)"
  sudo -iu postgres psql -p "$PG_PORT" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASSWORD';
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
APP_URL=$PUBLIC_ORIGIN
NEXT_PUBLIC_BASE_PATH=$BASE_PATH
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:$PG_PORT/$DB_NAME?schema=public
SESSION_TTL_DAYS=7
SESSION_COOKIE_SECURE=true
# The nginx location generated by this script overwrites X-Real-IP, so the
# application may safely use it for per-client abuse controls.
TRUST_PROXY=true
MAILATO_COMMAND=/usr/local/bin/mailato
MAILATO_DRY_RUN=false
EOF_ENV
  if [[ "$BOOTSTRAP_ADMIN" == "1" ]]; then
    ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"
    {
      printf 'ADMIN_BOOTSTRAP_EMAIL=%q\n' "admin@when2entretien.local"
      printf 'ADMIN_BOOTSTRAP_PASSWORD=%q\n' "$ADMIN_PASSWORD"
      printf 'ADMIN_BOOTSTRAP_NAME=%q\n' "远端超级管理员"
    } >> "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE"
fi

# Existing hosts may still have an HTTP APP_URL or insecure cookie policy from
# an earlier deployment. Preserve secrets and mail settings, but always update
# values that form this release's transport/security contract.
python3 - "$ENV_FILE" "$PUBLIC_ORIGIN" "$BASE_PATH" "$APP_PORT" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
updates = {
    "NODE_ENV": "production",
    "PORT": sys.argv[4],
    "HOSTNAME": "127.0.0.1",
    "APP_URL": sys.argv[2],
    "NEXT_PUBLIC_BASE_PATH": sys.argv[3],
    "SESSION_COOKIE_SECURE": "true",
    "TRUST_PROXY": "true",
}
lines = path.read_text().splitlines()
remaining = set(updates)
rewritten: list[str] = []
for line in lines:
    key, separator, _ = line.partition("=")
    if separator and key in updates:
        rewritten.append(f"{key}={updates[key]}")
        remaining.discard(key)
    else:
        rewritten.append(line)
for key in sorted(remaining):
    rewritten.append(f"{key}={updates[key]}")
path.write_text("\n".join(rewritten) + "\n")
PY
chmod 600 "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

open_overlap_count="$(sudo -iu postgres psql -p "$PG_PORT" -d "$DB_NAME" -Atqc '
  SELECT COUNT(*)
  FROM "GroupTimeSlot" AS left_slot
  JOIN "GroupTimeSlot" AS right_slot
    ON left_slot."groupId" = right_slot."groupId"
   AND left_slot."id" < right_slot."id"
   AND left_slot."status" = '\''OPEN'\''
   AND right_slot."status" = '\''OPEN'\''
   AND left_slot."startAt" < right_slot."endAt"
   AND left_slot."endAt" > right_slot."startAt"
  WHERE GREATEST(left_slot."endAt", right_slot."endAt") >= CURRENT_TIMESTAMP
')"
if [[ "$open_overlap_count" != "0" ]]; then
  echo "Refusing deployment: $open_overlap_count current or future overlapping OPEN slot pair(s) need an explicit scheduling repair before migration." >&2
  exit 1
fi

btree_gist_available="$(sudo -iu postgres psql -p "$PG_PORT" -d "$DB_NAME" -Atqc "SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'btree_gist')")"
if [[ "$btree_gist_available" != "t" ]]; then
  echo "The PostgreSQL btree_gist extension files are unavailable. Install the server's matching postgresql-contrib package before deployment." >&2
  exit 1
fi

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
if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm --version)" != "$PNPM_VERSION" ]]; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare "pnpm@$PNPM_VERSION" --activate
  else
    command -v npm >/dev/null 2>&1 || {
      echo "npm or corepack is required to install pnpm on the deployment host." >&2
      exit 1
    }
    npm install --global "pnpm@$PNPM_VERSION"
  fi
fi
if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm --version)" != "$PNPM_VERSION" ]]; then
  echo "The deployment host could not activate pnpm $PNPM_VERSION." >&2
  exit 1
fi

BACKUP_ROOT="$REMOTE_ROOT/backups"
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
BACKUP_FILE="$BACKUP_ROOT/pre-migrate-$RELEASE.dump"
if ! sudo -iu postgres pg_dump -p "$PG_PORT" -Fc --no-owner --no-privileges -d "$DB_NAME" > "$BACKUP_FILE"; then
  rm -f -- "$BACKUP_FILE"
  echo "Failed to create the required pre-migration database backup." >&2
  exit 1
fi
chmod 600 "$BACKUP_FILE"
find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'pre-migrate-*.dump' -printf '%T@ %p\n' \
  | sort -nr \
  | tail -n +"$((BACKUP_KEEP + 1))" \
  | cut -d' ' -f2- \
  | xargs -r rm -f --

pnpm install --frozen-lockfile
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" pnpm build
pnpm exec prisma migrate deploy

if [[ "$BOOTSTRAP_ADMIN" == "1" ]]; then
  pnpm db:seed
  # Bootstrap credentials must not remain in the long-lived runtime environment.
  sed -i '/^ADMIN_BOOTSTRAP_\(EMAIL\|PASSWORD\|NAME\)=/d' "$ENV_FILE"
fi

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

OUTBOX_SERVICE_NAME="${SERVICE_NAME%.service}-email-outbox.service"
OUTBOX_TIMER_NAME="${SERVICE_NAME%.service}-email-outbox.timer"
cat > "/etc/systemd/system/$OUTBOX_SERVICE_NAME" <<EOF_OUTBOX_SERVICE
[Unit]
Description=Interview Scheduler CN Email Outbox Processor
After=network.target postgresql.service

[Service]
Type=oneshot
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$REMOTE_ROOT/current
EnvironmentFile=$ENV_FILE
ExecStart=$REMOTE_ROOT/current/node_modules/.bin/tsx scripts/process-email-outbox.ts
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
EOF_OUTBOX_SERVICE

cat > "/etc/systemd/system/$OUTBOX_TIMER_NAME" <<EOF_OUTBOX_TIMER
[Unit]
Description=Run Interview Scheduler CN Email Outbox Processor

[Timer]
OnBootSec=90s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true

[Install]
WantedBy=timers.target
EOF_OUTBOX_TIMER

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl enable --now "$OUTBOX_TIMER_NAME"

if [[ -n "$REQUESTED_NGINX_CONF" ]]; then
  case "$REQUESTED_NGINX_CONF" in
    /www/server/panel/vhost/nginx/*.conf | /etc/nginx/conf.d/*.conf) ;;
    *)
      echo "Requested nginx vhost is outside the managed configuration directories." >&2
      exit 1
      ;;
  esac
  [[ -f "$REQUESTED_NGINX_CONF" ]] || {
    echo "Requested nginx vhost does not exist: $REQUESTED_NGINX_CONF" >&2
    exit 1
  }
  NGINX_CONF="$REQUESTED_NGINX_CONF"
  NGINX_BIN="${REQUESTED_NGINX_BIN:-/www/server/nginx/sbin/nginx}"
  NGINX_MAIN="${REQUESTED_NGINX_MAIN:-/www/server/nginx/conf/nginx.conf}"
elif [[ -f /www/server/panel/vhost/nginx/00-thesisforma.conf && -f /www/server/nginx/conf/nginx.conf ]]; then
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
        proxy_hide_header X-Powered-By;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), geolocation=(), microphone=()" always;
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
        proxy_hide_header X-Powered-By;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), geolocation=(), microphone=()" always;
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
    marker = "    # when2entretien-location-marker\n"
    if marker in text:
        text = text.replace(marker, block + "\n" + marker, 1)
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
  if curl -fsS "http://127.0.0.1:$APP_PORT$BASE_PATH/api/health/ready" >/tmp/when2entretien-health.json; then
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
curl -fsS -H "Host: $PUBLIC_HOST" "http://127.0.0.1$BASE_PATH/api/health/ready" >/tmp/when2entretien-nginx-health.json
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
  curl -fsS --max-time 20 "$PUBLIC_ORIGIN/api/health/ready" -o /tmp/when2entretien-public-health.json
  grep -q 'interview-scheduler-cn' /tmp/when2entretien-public-health.json
fi

log "Done"
cat <<EOF
Open:
  $PUBLIC_ORIGIN
EOF
