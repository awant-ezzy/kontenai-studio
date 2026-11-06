# AWANT Konten AI Studio

Generator konten multi-platform berbasis Next.js, Prisma SQLite, dan OpenAI API.

## Identitas
AWANT Konten AI Studio — dibuat untuk workflow kreator Facebook, YouTube, TikTok, dan Instagram.

## Fitur
- Generasi script, caption, hashtag, judul, dan deskripsi melalui OpenAI.
- Thumbnail melalui OpenAI Image API.
- Voice-over melalui OpenAI Speech API.
- Riwayat konten menggunakan SQLite.
- Login administrator dengan sesi aman.

## Development
```bash
bun install
cp .env.example .env
# Isi OPENAI_API_KEY, ADMIN_PASSWORD, AUTH_SECRET
bun run db:generate
bun run db:push
bun run dev
```

## Deploy Proxmox
Ikuti panduan terbaru di [deploy/proxmox/README.md](../deploy/proxmox/README.md).

API key OpenAI hanya disimpan di environment server dan tidak boleh dikirim ke browser atau di-commit ke Git. Fitur video belum diaktifkan karena memerlukan provider video khusus.
