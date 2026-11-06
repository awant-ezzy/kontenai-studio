# AWANT Konten AI Studio

![AWANT Konten AI Studio](./public/logo.svg)

**AWANT Konten AI Studio** adalah aplikasi web untuk membantu membuat paket konten media sosial berbantuan AI. Dari satu topik, aplikasi dapat menyiapkan materi yang disesuaikan untuk YouTube, Facebook, TikTok, dan Instagram.

Aplikasi dibangun menggunakan **Next.js 16, React, TypeScript, Prisma, SQLite, dan OpenAI API**.

## Fitur utama

- Generasi konten untuk satu atau beberapa platform sekaligus:
  - YouTube
  - Facebook
  - TikTok
  - Instagram
- Paket konten per platform mencakup 3 pilihan judul, naskah video, caption, hashtag, deskripsi, dan prompt thumbnail.
- Pembuatan gambar thumbnail melalui OpenAI Image API.
- Pembuatan voice-over melalui OpenAI Speech API (dapat diaktifkan sesuai kebutuhan).
- Proses generasi bertahap dengan indikator progres.
- Riwayat konten dan aset disimpan di database SQLite.
- Halaman login admin dengan autentikasi berbasis password dan sesi bertanda tangan.
- Antarmuka dengan identitas AWANT Konten AI Studio.

> **Batasan saat ini:** pembuatan video AI belum didukung oleh integrasi OpenAI di aplikasi ini. Naskah dan voice-over dapat digunakan untuk proses editing video di aplikasi lain.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend dan backend | Next.js 16, React 19, TypeScript |
| Styling dan komponen | Tailwind CSS 4, Radix UI |
| AI teks | OpenAI Responses API |
| AI gambar | OpenAI Image API |
| AI suara | OpenAI Speech API |
| Database | SQLite |
| ORM | Prisma 6 |
| Runtime/package manager | Node.js 20+ dan Bun |

## Persyaratan

Untuk menjalankan aplikasi secara lokal atau di server, siapkan:

- Node.js 20 atau lebih baru.
- Bun.
- API key OpenAI dengan akses dan billing yang sesuai untuk model yang akan digunakan.
- Ruang penyimpanan untuk database SQLite dan file hasil generasi.

## Menjalankan di komputer lokal

Clone repository dan masuk ke folder project:

```bash
git clone https://github.com/awant-ezzy/kontenai-studio.git
cd kontenai-studio
```

Pasang dependency dan siapkan environment:

```bash
bun install
cp .env.example .env
```

Edit file `.env`. Untuk pengembangan lokal, gunakan lokasi database lokal, misalnya:

```dotenv
DATABASE_URL="file:./dev.db"
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

ADMIN_PASSWORD="ganti_dengan_password_admin_yang_kuat"
AUTH_SECRET="isi_dengan_secret_acak_minimal_32_byte"

OPENAI_API_KEY="isi_api_key_openai"
```

Buat secret acak dengan:

```bash
openssl rand -hex 32
```

Siapkan database, Prisma Client, dan folder upload:

```bash
bun run db:generate
bun run db:push
mkdir -p public/uploads
```

Jalankan server pengembangan:

```bash
bun run dev
```

Buka [http://localhost:3000](http://localhost:3000), lalu login menggunakan password admin yang telah diatur di `.env`.

## Variabel environment

Konfigurasi contoh tersedia di [`.env.example`](./.env.example).

| Variabel | Fungsi |
| --- | --- |
| `DATABASE_URL` | Lokasi file database SQLite. |
| `NODE_ENV` | Mode aplikasi, gunakan `production` pada server produksi. |
| `PORT` | Port aplikasi, default deployment `3000`. |
| `HOST` | Alamat bind server, umumnya `0.0.0.0` pada container. |
| `ADMIN_PASSWORD` | Password untuk login admin. Wajib diisi sebelum aplikasi dibuka. |
| `AUTH_SECRET` | Secret acak untuk menandatangani sesi login. Wajib diisi. |
| `OPENAI_API_KEY` | API key OpenAI yang hanya digunakan di sisi server. |
| `OPENAI_TEXT_MODEL` | Model OpenAI untuk generasi teks. |
| `OPENAI_IMAGE_MODEL` | Model OpenAI untuk pembuatan gambar. |
| `OPENAI_TTS_MODEL` | Model OpenAI untuk pembuatan suara. |

Pastikan ID model yang dikonfigurasi tersedia untuk project OpenAI Anda. Nama model dapat berubah dan aksesnya bergantung pada akun/project. Jangan menganggap API key otomatis memiliki akses ke semua model.

**Keamanan API key:**
- Jangan menambahkan awalan `NEXT_PUBLIC_` pada API key atau secret.
- Jangan commit file `.env` ke GitHub.
- Jangan mengirim API key melalui chat, screenshot, atau issue publik.
- Jika API key pernah terlanjur dipublikasikan, segera cabut dan buat key baru dari dashboard OpenAI.

## Perintah project

| Perintah | Kegunaan |
| --- | --- |
| `bun run dev` | Menjalankan development server. |
| `bun run lint` | Menjalankan ESLint. |
| `bun run db:generate` | Membuat Prisma Client. |
| `bun run db:push` | Menyesuaikan schema Prisma ke database. |
| `bun run db:migrate` | Menjalankan alur migrasi Prisma untuk development. |
| `bun run build` | Membuat production build Next.js standalone. |
| `bun run start` | Menjalankan hasil build production. |

Hindari menjalankan `bun run db:reset` pada database produksi karena perintah tersebut dapat menghapus data.

## Deployment Proxmox LXC

Panduan deployment dan script tersedia di folder [`deploy/proxmox/`](./deploy/proxmox/):

- [Panduan deployment Proxmox](./deploy/proxmox/README.md)
- [Script bootstrap LXC](./deploy/proxmox/proxmox-create-lxc.sh)
- [Script update aplikasi](./deploy/proxmox/update.sh)

Bootstrap dijalankan dari shell host Proxmox sebagai root. Contoh:

```bash
bash deploy/proxmox/proxmox-create-lxc.sh 220 kontenai
```

Gunakan CT ID yang benar-benar kosong. Script akan menolak membuat container jika CT ID tersebut sudah digunakan. Jangan menjalankan bootstrap pada CT yang berisi aplikasi atau data penting.

Setelah instalasi, lengkapi `/opt/kontenai/.env` di dalam LXC dengan `ADMIN_PASSWORD`, `AUTH_SECRET`, dan `OPENAI_API_KEY`, lalu restart service:

```bash
chmod 600 /opt/kontenai/.env
systemctl restart kontenai
systemctl status kontenai --no-pager
```

Ikuti panduan deployment untuk konfigurasi domain, reverse proxy, HTTPS, backup, dan prosedur update. Jangan membuka aplikasi ke internet sebelum autentikasi, secret, firewall, dan HTTPS dikonfigurasi dengan benar.

## Database dan file hasil

Pada konfigurasi deployment Proxmox, lokasi default yang digunakan adalah:

- Database: `/opt/kontenai/db/custom.db`
- Upload dan aset gambar/audio: `/opt/kontenai/public/uploads/`
- Environment: `/opt/kontenai/.env`

**Backup database dan folder upload secara berkala.** Simpan salinan backup di luar container/server agar data tetap dapat dipulihkan jika terjadi kerusakan host atau storage.

Contoh backup SQLite yang aman:

```bash
mkdir -p /opt/kontenai/backups
chmod 700 /opt/kontenai/backups
sqlite3 /opt/kontenai/db/custom.db '.backup /opt/kontenai/backups/kontenai-backup.db'
tar czf /opt/kontenai/backups/uploads-$(date +%Y%m%d).tar.gz -C /opt/kontenai/public uploads
```

## CI dan pemeriksaan kode

GitHub Actions menjalankan pemeriksaan dependency, pembuatan Prisma Client, lint, dan production build pada push/pull request sesuai konfigurasi workflow di [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

Status pemeriksaan dapat dilihat pada tab **Actions** repository GitHub.

## Kontribusi dan pengembangan

Perubahan sebaiknya dibuat pada branch terpisah, diuji dengan lint dan build, lalu diajukan melalui Pull Request ke branch `main`. Jangan memasukkan kredensial, database produksi, hasil upload pengguna, atau file backup ke commit.

## Lisensi

MIT.
