#!/usr/bin/env bash
# =============================================================================
# KontenAI Studio — Proxmox LXC Container Bootstrap Script
# Run this on the Proxmox HOST (PVE shell as root).
#
# Usage:
#   bash proxmox-create-lxc.sh [CT_ID] [CT_HOSTNAME] [CT_PASSWORD]
#
# Defaults: CT_ID=200, CT_HOSTNAME=kontenai
# =============================================================================

set -euo pipefail

CT_ID="${1:-200}"
CT_HOSTNAME="${2:-kontenai}"
if [[ -n "${3:-}" ]]; then
  CT_PASSWORD="$3"
else
  read -rsp "Set a strong root password for CT ${CT_ID}: " CT_PASSWORD
  echo
  if [[ -z "$CT_PASSWORD" ]]; then
    echo "ERROR: password cannot be empty." >&2
    exit 1
  fi
fi
CT_MEMORY="4096"
CT_CORES="4"
CT_DISK="20"
CT_BRIDGE="vmbr0"
CT_IP="dhcp"
CT_GW=""
TEMPLATE_STORAGE="local"
ROOTFS_STORAGE="local-lvm"

echo "================================================"
echo " KontenAI Studio — Proxmox LXC Bootstrap"
echo " CT ID      : ${CT_ID}"
echo " Hostname   : ${CT_HOSTNAME}"
echo " Memory     : ${CT_MEMORY} MB"
echo " Cores      : ${CT_CORES}"
echo " Disk       : ${CT_DISK} GB"
echo " Network    : ${CT_IP}"
echo "================================================"

# Never stop or destroy an existing guest automatically.
if pct status "${CT_ID}" >/dev/null 2>&1; then
  echo "ERROR: CT ${CT_ID} already exists. Nothing was changed." >&2
  echo "Choose a new CT ID, or back up and remove the old CT manually after verification." >&2
  exit 1
fi

# --- 1. Download Ubuntu 24.04 LXC template if not present ---
if ! pveam list "${TEMPLATE_STORAGE}" 2>/dev/null | grep -q "ubuntu-24.04-standard"; then
  echo ">> Downloading Ubuntu 24.04 LXC template..."
  pveam download "${TEMPLATE_STORAGE}" ubuntu-24.04-standard_24.04-1_amd64.tar.zst || \
    pveam download "${TEMPLATE_STORAGE}" ubuntu-24.04-standard_24.04-1_amd64.tar.xz
fi

# --- 2. Create the container ---
echo ">> Creating LXC container ${CT_ID}..."
NET_CFG="name=eth0,bridge=${CT_BRIDGE},ip=${CT_IP}"
if [[ -n "${CT_GW}" ]]; then
  NET_CFG="${NET_CFG},gw=${CT_GW}"
fi

pct create "${CT_ID}" "${TEMPLATE_STORAGE}:vztmpl/ubuntu-24.04-standard" \
  --arch amd64 \
  --hostname "${CT_HOSTNAME}" \
  --cores "${CT_CORES}" \
  --memory "${CT_MEMORY}" \
  --swap 2048 \
  --rootfs "${ROOTFS_STORAGE}:${CT_DISK}" \
  --net0 "${NET_CFG}" \
  --nameserver "1.1.1.1 8.8.8.8" \
  --password "${CT_PASSWORD}" \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1

echo ">> Starting container..."
pct start "${CT_ID}"

echo ">> Waiting for container network..."
for i in {1..30}; do
  if pct exec "${CT_ID}" -- ping -c1 -W1 1.1.1.1 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ">> Installing system packages inside container..."
pct exec "${CT_ID}" -- bash -c '
  set -e
  apt-get update -y
  apt-get install -y curl wget git build-essential python3 nginx ufw ca-certificates
  apt-get install -y ffmpeg imagemagick || true
'

echo ">> Installing Bun + Node.js..."
pct exec "${CT_ID}" -- bash -c '
  set -e
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  curl -fsSL https://bun.sh/install | bash
  ln -sf /root/.bun/bin/bun /usr/local/bin/bun
  echo "Bun $(bun --version) / Node $(node --version)"
'

echo ">> Creating app directory..."
pct exec "${CT_ID}" -- bash -c 'mkdir -p /opt/kontenai'

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
echo ">> Pushing project from ${REPO_DIR} into CT..."
TAR_FILE="/tmp/kontenai-$(date +%s).tar.gz"
tar -czf "${TAR_FILE}" \
  --exclude='node_modules' --exclude='.next' --exclude='db' \
  --exclude='public/uploads' --exclude='dev.log' --exclude='server.log' \
  --exclude='.zscripts' --exclude='.env' --exclude='.z-ai-config' \
  -C "${REPO_DIR}" .

pct push "${CT_ID}" "${TAR_FILE}" /tmp/kontenai.tar.gz
rm -f "${TAR_FILE}"
pct exec "${CT_ID}" -- bash -c '
  set -e
  cd /opt/kontenai
  tar -xzf /tmp/kontenai.tar.gz
  rm -f /tmp/kontenai.tar.gz
  chown -R root:root /opt/kontenai
'

echo ">> Writing production environment..."
pct exec "${CT_ID}" -- bash -c "cat > /opt/kontenai/.env <<'EOF'
DATABASE_URL=file:/opt/kontenai/db/custom.db
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
EOF
mkdir -p /opt/kontenai/db /opt/kontenai/public/uploads
chmod 700 /opt/kontenai/db"

echo ">> Installing dependencies and building..."
pct exec "${CT_ID}" -- bash -c '
  set -e
  cd /opt/kontenai
  bun install --frozen-lockfile
  bun run db:generate
  bun run build
'

echo ">> Creating OpenAI environment file..."
pct exec "${CT_ID}" -- bash -c "touch /opt/kontenai/.env
chmod 600 /opt/kontenai/.env
echo 'Add OPENAI_API_KEY to /opt/kontenai/.env after deployment.'"

echo ">> Setting up systemd service..."
pct exec "${CT_ID}" -- bash -c "cat > /etc/systemd/system/kontenai.service <<'EOF'
[Unit]
Description=KontenAI Studio — AI Content Generator
After=network.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/kontenai
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0
EnvironmentFile=/opt/kontenai/.env
ExecStart=/usr/local/bin/bun /opt/kontenai/.next/standalone/server.js
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/kontenai.log
StandardError=append:/var/log/kontenai.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable kontenai
systemctl restart kontenai"

echo ">> Setting up Nginx..."
pct exec "${CT_ID}" -- bash -c "cat > /etc/nginx/sites-available/kontenai <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 200M;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    location /uploads/ {
        alias /opt/kontenai/public/uploads/;
        expires 7d;
        add_header Cache-Control \"public, immutable\";
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
ln -sf /etc/nginx/sites-available/kontenai /etc/nginx/sites-enabled/kontenai
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx"

pct exec "${CT_ID}" -- bash -c 'ufw allow 80/tcp || true; ufw --force enable || true'
CT_IP_ADDR=$(pct exec "${CT_ID}" -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
echo "KontenAI Studio deployed. CT ID: ${CT_ID}; IP: ${CT_IP_ADDR}; HTTP port: 80"
echo "Before public exposure, configure HTTPS and enable application authentication."
