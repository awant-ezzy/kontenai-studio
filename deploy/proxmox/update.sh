#!/usr/bin/env bash
# Run inside the LXC container as root.
set -euo pipefail

APP_DIR="/opt/kontenai"
cd "${APP_DIR}"

echo ">> Pulling latest code..."
if [[ -d ".git" ]]; then
  git pull --ff-only
else
  echo "ERROR: ${APP_DIR} is not a Git checkout. Update source manually." >&2
  exit 1
fi

echo ">> Installing dependencies..."
bun install --frozen-lockfile

echo ">> Stopping service and backing up SQLite..."
systemctl stop kontenai
restart_service() {
  systemctl start kontenai || true
}
trap restart_service EXIT

DB_FILE="/opt/kontenai/db/custom.db"
if [[ -f "${DB_FILE}" ]]; then
  BACKUP_DIR="/opt/kontenai/backups"
  mkdir -p "${BACKUP_DIR}"
  chmod 700 "${BACKUP_DIR}"
  cp -a "${DB_FILE}" "${BACKUP_DIR}/custom-$(date +%Y%m%d-%H%M%S).db"
  echo "SQLite backup created in ${BACKUP_DIR}."
fi

echo ">> Generating Prisma client..."
bun run db:generate

echo ">> Applying schema without --accept-data-loss..."
bun run db:push

echo ">> Building Next.js..."
bun run build

echo ">> Restarting and checking service..."
systemctl start kontenai
trap - EXIT
sleep 3
if systemctl is-active --quiet kontenai; then
  echo "KontenAI Studio restarted successfully."
  systemctl status kontenai --no-pager -l | head -5
else
  echo "Service failed. Recent logs:" >&2
  journalctl -u kontenai -n 50 --no-pager >&2
  exit 1
fi
