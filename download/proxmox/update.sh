#!/usr/bin/env bash
# =============================================================================
# KontenAI Studio — Update script (run INSIDE the LXC container as root)
# Usage:
#   pct exec <CT_ID> -- bash /opt/kontenai/deploy/proxmox/update.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/kontenai"
cd "${APP_DIR}"

echo ">> Pulling latest code (if git repo)..."
if [[ -d ".git" ]]; then
  git pull --ff-only || true
else
  echo ">> Not a git repo. Re-deploy by re-running proxmox-create-lxc.sh"
fi

echo ">> Installing dependencies..."
bun install --frozen-lockfile

echo ">> Pushing DB schema..."
bun run db:push || true

echo ">> Rebuilding Next.js..."
bun run build

echo ">> Restarting service..."
systemctl restart kontenai

sleep 3
if systemctl is-active --quiet kontenai; then
  echo "✓ KontenAI Studio restarted successfully"
  echo "  Status: $(systemctl status kontenai --no-pager -l | head -3 | tail -1)"
else
  echo "✗ Service failed to start. Check logs:"
  tail -20 /var/log/kontenai.log
  exit 1
fi
