# KontenAI Studio

> Generator konten Facebook + YouTube + TikTok + Instagram sekali klik. Generasi teks menggunakan OpenAI; fitur media lama masih menggunakan Z.ai selama migrasi bertahap.

![Dark Mode UI](./public/favicon.svg)

## ✨ Fitur

- **Sekali klik, banyak output**: dari satu topik → script, caption, hashtag, judul, deskripsi, thumbnail, voiceover, dan video pendek untuk 4 platform sekaligus
- **Multi-platform**: YouTube (16:9), Facebook (1:1), TikTok (9:16), Instagram (4:5)
- **Bahasa**: Indonesia & English
- **6 Tone**: santai, profesional, edukatif, lucu, inspiratif, provokatif
- **10 Niche**: tech, food, lifestyle, finance, education, entertainment, health, travel, business, umum
- **TTS multi-chunk**: script panjang dipecah otomatis, lalu WAV digabung
- **Riwayat tersimpan** di SQLite via Prisma, bisa dihapus/di-buka ulang
- **Dark mode UI** ala YouTube Creator Studio
- **Tanpa login**, single-user (cocok untuk creator personal)
- **Siap Proxmox LXC** — script bootstrap otomatis

## 🚀 Quick start (development)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env and set OPENAI_API_KEY on the server

# 3. Create the SQLite directory
mkdir -p db

# 4. Generate Prisma client
bun run db:generate

# 5. Push DB schema (development only; back up data first)
bun run db:push

# 6. Run dev server
bun run dev
# → http://localhost:3000
```

## 📦 Deploy ke Proxmox LXC

Lihat: [`deploy/proxmox/README.md`](./deploy/proxmox/README.md)

Cepat:
```bash
bash deploy/proxmox/proxmox-create-lxc.sh 200 kontenai MyPassword123
pct exec 200 -- nano /opt/kontenai/.env  # isi OPENAI_API_KEY
pct exec 200 -- systemctl restart kontenai
```

Akses: `http://<IP-CONTAINER>/`

## 🧱 Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **DB**: Prisma + SQLite (file-based, no external DB needed)
- **AI teks**: OpenAI Chat Completions API (server-side)
- **AI media legacy**: Z.ai (image generation, TTS, video generation; migrasi bertahap)
- **UI**: Tailwind CSS 4 + shadcn/ui + Lucide icons
- **State**: Zustand
- **Reverse proxy**: Nginx (di Proxmox container)
- **Process manager**: systemd

## 🗂️ Pipeline AI (sekali klik)

1. **Text** (per platform, sequential): OpenAI menghasilkan 3 judul + script + caption + 8-12 hashtag + deskripsi + thumbnail prompt
2. **Thumbnail**: Z.ai image generation (migrasi ke OpenAI belum dilakukan)
3. **Voiceover**: Z.ai TTS (migrasi ke OpenAI belum dilakukan)
4. **Video**: Z.ai video generation 5 detik 720p (migrasi ke OpenAI belum dilakukan)

Total waktu: ~30-90 detik per generation (tergantung jumlah platform).

## 📁 Struktur Proyek

```
.
├── prisma/schema.prisma          # Content + Asset models
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.ts       # POST pipeline AI
│   │   │   └── content/[id]/...        # GET/DELETE/poll
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # main UI
│   │   └── globals.css                # dark theme
│   ├── lib/
│   │   ├── openai.ts                   # OpenAI text API wrapper
│   │   ├── zai.ts                      # Z.ai media API wrapper (legacy)
│   │   ├── storage.ts                  # file storage helper
│   │   ├── store.ts                    # Zustand store
│   │   ├── types.ts                    # shared types
│   │   └── db.ts                       # Prisma client
│   └── components/
│       ├── generator-form.tsx         # input form
│       ├── generation-progress.tsx     # live progress
│       ├── result-view.tsx             # tabbed result per platform
│       └── history-sidebar.tsx         # saved history
└── deploy/proxmox/                    # Proxmox LXC bootstrap script + README
```

## 🔧 Konfigurasi

`.env`:
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

`.z-ai-config`:
```json
{
  "baseUrl": "https://api.z.ai/api/v1",
  "apiKey": "YOUR_API_KEY"
}
```

## 📝 License

MIT
"# kontenai-studio" 


## OpenAI configuration

Copy `.env.example` to `.env`, then set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Keep `.env` server-side and out of Git. Text generation uses OpenAI; image, TTS, and video still use the legacy Z.ai integration in this stage.
