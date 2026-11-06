# KontenAI Studio — Deploy ke Proxmox LXC Ubuntu

Aplikasi AI generator konten Facebook + YouTube + TikTok + Instagram sekali klik. Berbasis Next.js 16 + TypeScript + Prisma (SQLite) + Z.ai SDK.

---

## Apa yang dihasilkan AI dari satu topik?

| Asset | YouTube | Facebook | TikTok | Instagram |
|---|---|---|---|---|
| 3 Judul | ✓ | ✓ | ✓ | ✓ |
| Script video (60-90 dtk) | ✓ | ✓ | ✓ | ✓ |
| Caption + emoji | ✓ | ✓ | ✓ | ✓ |
| 8-12 Hashtag | ✓ | ✓ | ✓ | ✓ |
| Deskripsi video | ✓ | ✓ | ✓ | ✓ |
| Thumbnail (rasio sesuai platform) | 16:9 | 1:1 | 9:16 | 4:5 |
| Voiceover AI (TTS) | ✓ | ✓ | ✓ | ✓ |
| Video pendek AI 5 detik | ✓ (shared) | ✓ (shared) | ✓ (shared) | ✓ (shared) |

Setiap aset bisa di-download / di-copy langsung dari UI.

---

## Cara Deploy ke Proxmox (3 langkah)

### Langkah 1: Dapatkan Z.ai API key

1. Daftar di https://z.ai/
2. Buat API key di dashboard.

### Langkah 2: Jalankan bootstrap script di Proxmox host

```bash
# Login ke Proxmox host shell (web UI > Node > Shell)
# atau via SSH ke root@proxmox-host

# Clone / copy project ke Proxmox host
git clone https://your-repo/kontenai-studio.git
cd kontenai-studio

# Buat LXC container otomatis (default: CT 200, hostname=kontenai, 4 core, 4GB RAM, 20GB disk)
bash deploy/proxmox/proxmox-create-lxc.sh

# Atau custom:
bash deploy/proxmox/proxmox-create-lxc.sh 201 kontenai MyPassword123
```

Script akan otomatis:
- Download template Ubuntu 24.04 LXC
- Buat container unprivileged dengan nesting=1
- Install Node.js 20, Bun, Nginx, ffmpeg, imagemagick
- Push kode aplikasi ke `/opt/kontenai`
- Install dependencies + build Next.js standalone
- Setup systemd service `kontenai.service` (auto-restart, auto-start on boot)
- Setup Nginx reverse proxy di port 80
- Enable UFW firewall (port 80 terbuka)

### Langkah 3: Pasang Z.ai API key

```bash
# Edit config
pct exec 200 -- nano /opt/kontenai/.z-ai-config

# Isi:
# {
#   "baseUrl": "https://api.z.ai/api/v1",
#   "apiKey": "AKTUAL_KEY_KAMU"
# }

# Restart service
pct exec 200 -- systemctl restart kontenai

# Cek status
pct exec 200 -- systemctl status kontenai
```

Akses aplikasi di `http://<IP-CONTAINER>/`.

---

## Cara Cek IP Container

```bash
pct exec 200 -- ip -4 addr show eth0 | grep inet
```

Atau dari Proxmox web UI > Container > Resources > Network.

---

## Update Aplikasi

### Opsi A: Update via Git (jika repo di-deploy lewat git)

```bash
pct exec 200 -- bash /opt/kontenai/deploy/proxmox/update.sh
```

### Opsi B: Re-deploy dari Proxmox host

```bash
cd /path/ke/kontenai-studio
git pull
bash deploy/proxmox/proxmox-create-lxc.sh 200 kontenai  # destroy + recreate
```

---

## Akses & Log

```bash
# Masuk ke container
pct enter 200
# atau
pct exec 200 -- bash

# Lihat log aplikasi
pct exec 200 -- tail -f /var/log/kontenai.log

# Lihat status service
pct exec 200 -- systemctl status kontenai

# Restart service
pct exec 200 -- systemctl restart kontenai
```

---

## Konfigurasi LXC Container di Proxmox

Setting default dari script:

| Item | Nilai | Catatan |
|---|---|---|
| CT ID | 200 | |
| Hostname | kontenai | |
| OS | Ubuntu 24.04 LTS | |
| Type | Unprivileged | Lebih aman |
| Nesting | Enabled | Wajib untuk Bun |
| Memory | 4 GB | Naikkan ke 8 GB jika video gen aktif |
| CPU | 4 core | |
| Disk | 20 GB | Naikkan ke 40 GB jika banyak aset |
| Swap | 2 GB | |
| Network | vmbr0 DHCP | Ganti static IP di script jika perlu |
| Auto-start | Yes | Start saat host boot |

Naikkan memory ke 8 GB+ jika sering pakai video generation (5 detik 720p perlu ~2 GB peak).

---

## HTTPS dengan Let's Encrypt

```bash
# Pastikan domain sudah di-DNS A record ke IP container
pct exec 200 -- apt-get install -y certbot python3-certbot-nginx
pct exec 200 -- certbot --nginx -d kontenai.example.com
```

Certbot akan auto-edit config Nginx dan setup auto-renew.

---

## Backup & Restore

### Backup container (dari Proxmox host)
```bash
vzdump 200 --storage local --mode snapshot --compress zstd
# Hasil: /var/lib/vz/dump/vzdump-lxc-200-*.tar.zst
```

### Restore
```bash
pct restore 201 /var/lib/vz/dump/vzdump-lxc-200-<timestamp>.tar.zst --storage local-lvm
```

### Backup hanya data user (asset uploads + database)
```bash
pct exec 200 -- tar czf /tmp/kontenai-data.tar.gz \
  -C /opt/kontenai db public/uploads
pct pull 200 /tmp/kontenai-data.tar.gz ./kontenai-data-backup.tar.gz
```

---

## Struktur Folder di Container

```
/opt/kontenai/
├── .next/                 # build output (standalone)
│   └── standalone/        # entry point server.js
├── public/
│   └── uploads/           # AI assets (thumbnails, voiceovers)
├── db/
│   └── custom.db          # SQLite database
├── prisma/
│   └── schema.prisma
├── src/                   # source code
├── .z-ai-config           # Z.ai API key
├── .env                   # env vars
└── deploy/proxmox/        # script deploy
```

---

## Troubleshooting

### Service tidak mau start
```bash
pct exec 200 -- journalctl -u kontenai -n 50 --no-pager
pct exec 200 -- tail -50 /var/log/kontenai.log
```

### Video generation timeout
Default timeout video gen adalah 3 menit. Untuk performance, gunakan `quality: 'speed'` (sudah default) dan `duration: 5`. Bila perlu durasi 10 detik, naikkan memory container.

### TTS input > 1024 karakter
Aplikasi sudah otomatis split script menjadi chunk ≤900 karakter dan merge WAV hasil. Tidak perlu intervensi manual.

### Rate limit Z.ai (429)
Aplikasi sudah sequential per platform + backoff retry 1s/2s/4s. Jika masih sering kena limit, kurangi jumlah platform simultan atau tambah delay di `src/app/api/generate/route.ts`.

### Reset database
```bash
pct exec 200 -- bash -c 'cd /opt/kontenai && bun run db:reset'
pct exec 200 -- systemctl restart kontenai
```

### Hapus semua aset (file upload) tapi keep database
```bash
pct exec 200 -- rm -rf /opt/kontenai/public/uploads/*
```

---

## Resource Requirements

| Skala | CPU | RAM | Disk | Bandwidth |
|---|---|---|---|---|
| Personal (1-5 gen/hari) | 2 core | 4 GB | 20 GB | 1 GB/bln |
| Tim kecil (20 gen/hari) | 4 core | 8 GB | 40 GB | 5 GB/bln |
| Agensi (100+ gen/hari) | 8 core | 16 GB | 100 GB | 20 GB/bln |

---

## Lisensi

MIT — bebas pakai, modifikasi, dan distribusi.
