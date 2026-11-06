#!/usr/bin/env bash
# =============================================================================
# KontenAI Studio — Proxmox LXC Container Bootstrap Script
# Run this on the Proxmox HOST (PVE shell as root).
#
# Creates an unprivileged Ubuntu 24.04 LXC container, installs Node.js 20 + Bun,
# clones/installs KontenAI Studio, sets up systemd service, and starts the app
# behind an Nginx reverse proxy.
#
# Usage:
#   bash proxmox-create-lxc.sh [CT_ID] [CT_HOSTNAME] [CT_PASSWORD]
#
# Defaults: CT_ID=200, CT_HOSTNAME=kontenai, CT_PASSWORD=kontenai2025
# =============================================================================

set -euo pipefail

CT_ID="${1:-200}"
CT_HOSTNAME="${2:-kontenai}"
CT_PASSWORD="${3:-kontenai2025}"
CT_MEMORY="4096"           # MB - bump to 8192 if you enable video gen
CT_CORES="4"
CT_DISK="20"               # GB - bump to 40 if you save many video assets
CT_BRIDGE="vmbr0"
CT_IP="dhcp"                # or set static e.g. "192.168.1.50/24"
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

# --- 1. Download Ubuntu 24.04 LXC template if not present ---
if ! pveam list "${TEMPLATE_STORAGE}" 2>/dev/null | grep -q "ubuntu-24.04-standard"; then
  echo ">> Downloading Ubuntu 24.04 LXC template..."
  pveam download "${TEMPLATE_STORAGE}" ubuntu-24.04-standard_24.04-1_amd64.tar.zst || \
    pveam download "${TEMPLATE_STORAGE}" ubuntu-24.04-standard_24.04-1_amd64.tar.xz
fi

# --- 2. Destroy existing CT if any ---
if pct status "${CT_ID}" >/dev/null 2>&1; then
  echo ">> Existing CT ${CT_ID} found, destroying..."
  pct stop "${CT_ID}" >/dev/null 2>&1 || true
  pct destroy "${CT_ID}" --force 1>/dev/null || true
fi

# --- 3. Create the container ---
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

# Wait for network
echo ">> Waiting for container network..."
for i in {1..30}; do
  if pct exec "${CT_ID}" -- ping -c1 -W1 1.1.1.1 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# --- 4. Install dependencies inside CT ---
echo ">> Installing system packages inside container..."
pct exec "${CT_ID}" -- bash -c '
  set -e
  apt-get update -y
  apt-get install -y curl wget git build-essential python3 nginx ufw ca-certificates
  apt-get install -y ffmpeg imagemagick || true
'

# --- 5. Install Bun + Node.js (LTS) ---
echo ">> Installing Bun + Node.js LTS..."
pct exec "${CT_ID}" -- bash -c '
  set -e
  # Node.js 20 LTS
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  # Bun
  curl -fsSL https://bun.sh/install | bash
  # Make bun available system-wide
  ln -sf /root/.bun/bin/bun /usr/local/bin/bun
  echo "Bun $(bun --version) / Node $(node --version)"
'

# --- 6. Create app directory + deploy ---
echo ">> Creating app directory..."
pct exec "${CT_ID}" -- bash -c 'mkdir -p /opt/kontenai'

# --- 7. Push this repo into the container ---
# (We assume this script is run from the project root; if not, clone from your git remote instead.)
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo ">> Pushing project from ${REPO_DIR} into CT..."

# Tar the project (excluding heavy stuff)
TAR_FILE="/tmp/kontenai-$(date +%s).tar.gz"
tar -czf "${TAR_FILE}" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='db' \
  --exclude='public/uploads' \
  --exclude='dev.log' \
  --exclude='server.log' \
  --exclude='.zscripts' \
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

# --- 8. Configure environment ---
echo ">> Writing .env..."
pct exec "${CT_ID}" -- bash -c "cat > /opt/kontenai/.env <<'EOF'
DATABASE_URL=file:/opt/kontenai/db/custom.db
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
EOF
mkdir -p /opt/kontenai/db
mkdir -p /opt/kontenai/public/uploads"

# --- 9. Install + build ---
echo ">> Installing dependencies (this may take 2-5 minutes)..."
pct exec "${CT_ID}" -- bash -c '
  set -e
  cd /opt/kontenai
  bun install --frozen-lockfile
  # Build Next.js (standalone output)
  bun run build
'

# --- 10. Setup Z.ai SDK config ---
echo ">> Setting up Z.ai SDK config..."
pct exec "${CT_ID}" -- bash -c "mkdir -p /root /opt/kontenai
cat > /opt/kontenai/.z-ai-config <<'EOF'
{
  \"baseUrl\": \"https://api.z.ai/api/v1\",
  \"apiKey\": \"PASTE_YOUR_ZAI_API_KEY_HERE\"
}
EOF
# Also at user home for CLI tools
cp /opt/kontenai/.z-ai-config /root/.z-ai-config
chmod 600 /opt/kontenai/.z-ai-config /root/.z-ai-config"

# --- 11. Setup systemd service ---
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

# --- 12. Setup Nginx reverse proxy ---
echo ">> Setting up Nginx reverse proxy..."
pct exec "${CT_ID}" -- bash -c "cat > /etc/nginx/sites-available/kontenai <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 200M;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # Next.js standalone serves /uploads/* directly from public/uploads/
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
nginx -t && systemctl restart nginx"

# --- 13. Firewall (optional, conservative defaults) ---
pct exec "${CT_ID}" -- bash -c 'ufw allow 80/tcp || true
ufw --force enable || true'

# --- 14. Done ---
CT_IP_ADDR=$(pct exec "${CT_ID}" -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
echo ""
echo "================================================"
echo " ✓ KontenAI Studio deployed successfully!"
echo "================================================"
echo ""
echo " CT ID            : ${CT_ID}"
echo " Container IP     : ${CT_IP_ADDR}"
echo " App port (CT)    : 3000"
echo " Public URL       : http://${CT_IP_ADDR}/"
echo ""
echo " Next steps:"
echo "   1. Edit /opt/kontenai/.z-ai-config and paste your Z.ai API key:"
echo "      pct exec ${CT_ID} -- nano /opt/kontenai/.z-ai-config"
echo "      pct exec ${CT_ID} -- systemctl restart kontenai"
echo ""
echo "   2. (Optional) Forward port 80 from your router to ${CT_IP_ADDR}"
echo ""
echo "   3. (Optional) Add HTTPS with Let's Encrypt:"
echo "      pct exec ${CT_ID} -- apt-get install -y certbot python3-certbot-nginx"
echo "      pct exec ${CT_ID} -- certbot --nginx -d your-domain.com"
echo ""
echo "   4. View logs:"
echo "      pct exec ${CT_ID} -- tail -f /var/log/kontenai.log"
echo ""
echo " Login to container:"
echo "   pct enter ${CT_ID}    (or)   pct exec ${CT_ID} -- bash"
echo ""
