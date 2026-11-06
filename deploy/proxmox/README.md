# KontenAI Studio — Deployment Proxmox LXC

Aplikasi Next.js 16 + TypeScript + Prisma SQLite dengan OpenAI API untuk generasi teks, gambar, dan voice-over.

## Catatan sebelum instalasi

- Gunakan CT ID baru. Script bootstrap **tidak akan menghapus atau menimpa CT yang sudah ada**.
- Default CT: 4 core, RAM 4 GB, disk 20 GB. Sesuaikan resource dengan kebutuhan.
- Siapkan API key OpenAI dari dashboard platform OpenAI.
- Versi ini belum menyediakan autentikasi admin aplikasi. Jangan membuka port aplikasi ke internet publik sebelum autentikasi dan proteksi API ditambahkan.
- Video generation belum didukung oleh adapter OpenAI versi ini.

## Bootstrap

Jalankan di shell Proxmox sebagai root, dari folder repository:

```bash
bash deploy/proxmox/proxmox-create-lxc.sh 220 kontenai
```

Ganti `220` dengan CT ID yang benar-benar kosong. Script meminta password root CT secara interaktif jika argumen password tidak diberikan.

Script membuat Ubuntu 24.04 LXC, memasang Node.js, Bun, Nginx, menyalin source, membuat direktori SQLite dan upload, membangun Next.js, serta menyiapkan systemd.

## Konfigurasi OpenAI

Masuk ke container:

```bash
pct enter 220
nano /opt/kontenai/.env
```

Isi API key server-side:

```dotenv
DATABASE_URL="file:/opt/kontenai/db/custom.db"
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
ADMIN_PASSWORD="password_admin_panjang_dan_unik"
AUTH_SECRET="hasil_openssl_rand_hex_32"
OPENAI_API_KEY="isi_api_key_di_server"
OPENAI_TEXT_MODEL="gpt-6-luna"
OPENAI_IMAGE_MODEL="gpt-image-2.5-flare"
OPENAI_TTS_MODEL="gpt-4o-mini-tts"
```

Lindungi file dan restart service:

```bash
chmod 600 /opt/kontenai/.env
systemctl restart kontenai
systemctl status kontenai --no-pager
```

Buat nilai acak untuk `AUTH_SECRET` dengan `openssl rand -hex 32`. Gunakan password admin yang kuat dan unik. Jangan mengirim API key melalui chat, commit kredensial ke Git, atau menggunakan variabel `NEXT_PUBLIC_*`.

## Update aman

Pastikan source di container adalah Git checkout yang benar. Kemudian:

```bash
bash /opt/kontenai/deploy/proxmox/update.sh
```

Script akan:
1. Mengambil perubahan Git dengan fast-forward saja.
2. Memasang dependency terkunci.
3. Menghentikan service dan membuat backup database SQLite.
4. Membuat Prisma Client dan menerapkan schema tanpa `--accept-data-loss`.
5. Build aplikasi dan memulai ulang service.
6. Memeriksa status service.

Jika Prisma meminta perubahan destruktif, proses harus dihentikan dan schema/data diperiksa manual. Jangan menggunakan `db:reset` pada database produksi.

## Backup data

```bash
mkdir -p /opt/kontenai/backups
chmod 700 /opt/kontenai/backups
sqlite3 /opt/kontenai/db/custom.db '.backup /opt/kontenai/backups/manual-backup.db'
tar czf /opt/kontenai/backups/uploads-$(date +%Y%m%d).tar.gz -C /opt/kontenai/public uploads
```

Simpan salinan backup di luar container juga.

## Nginx dan HTTPS

Nginx reverse proxy disiapkan pada port 80. Sebelum mengarahkan domain publik, selesaikan autentikasi admin, pembatasan API, dan konfigurasi HTTPS. Setelah DNS A record mengarah ke alamat publik yang benar, sertifikat dapat dipasang dengan Certbot.

## Log dan troubleshooting

```bash
journalctl -u kontenai -n 100 --no-pager
tail -f /var/log/kontenai.log
systemctl restart kontenai
```

SQLite: `/opt/kontenai/db/custom.db`

Upload: `/opt/kontenai/public/uploads/`

Environment: `/opt/kontenai/.env`
