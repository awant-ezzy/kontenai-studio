# KontenAI Studio

Generator konten Facebook, YouTube, TikTok, dan Instagram berbasis Next.js, Prisma SQLite, dan OpenAI API.

## Fitur

- Satu topik menghasilkan judul, script, caption, hashtag, deskripsi, dan prompt thumbnail per platform.
- Thumbnail melalui OpenAI GPT Image.
- Voice-over melalui OpenAI Speech API.
- Riwayat konten tersimpan di SQLite.
- UI dark mode dan proses generasi bertahap.

> Catatan: integrasi video generation belum tersedia pada provider OpenAI di versi ini. Jangan mengaktifkan fitur video sampai provider video khusus ditambahkan dan diuji.

## Development

Persyaratan: Bun, Node.js 20+, dan API key OpenAI.

```bash
bun install
cp .env.example .env
# Isi OPENAI_API_KEY pada .env (jangan commit file ini)
mkdir -p db public/uploads
bun run db:generate
bun run db:push
bun run dev
```

Buka http://localhost:3000.

## Environment

Contoh konfigurasi tersedia di `.env.example`.

- `OPENAI_API_KEY`: wajib, hanya di server.
- `OPENAI_TEXT_MODEL`: default `gpt-6-luna`.
- `OPENAI_IMAGE_MODEL`: default `gpt-image-2.5-flare`.
- `OPENAI_TTS_MODEL`: default `gpt-4o-mini-tts` (periksa jadwal deprecasi provider sebelum penggunaan jangka panjang).
- `DATABASE_URL`: lokasi SQLite, default deployment `file:/opt/kontenai/db/custom.db`.

Jangan gunakan awalan `NEXT_PUBLIC_` untuk API key. Jangan mengunggah `.env` atau file kredensial ke GitHub.

## Deployment Proxmox LXC

Lihat [deploy/proxmox/README.md](./deploy/proxmox/README.md).

Bootstrap script kini menolak membuat ulang CT ID yang sudah ada. Pilih CT ID baru untuk instalasi baru. Jangan menjalankan ulang script terhadap container berisi data.

Update script membuat backup SQLite, menghentikan service selama proses update, menjalankan Prisma tanpa opsi `--accept-data-loss`, membangun aplikasi, lalu memeriksa service.

## Catatan keamanan produksi

Aplikasi versi ini masih perlu autentikasi admin dan perlindungan API sebelum dibuka ke internet publik. Jalankan hanya di jaringan tepercaya atau di balik akses yang dibatasi sampai lapisan autentikasi selesai diterapkan.

## Lisensi

MIT.
