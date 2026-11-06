import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatJSON, generateImage, generateTTS, generateVideo, saveBase64Image, saveBuffer } from '@/lib/zai';
import { ensureUploadsDir, getPublicUrl, PLATFORM_IMAGE_SIZE, PLATFORM_LABEL } from '@/lib/storage';
import path from 'path';

export const runtime = 'nodejs';
export const maxDurationSeconds = 600;

interface GenerationPayload {
  topic: string;
  language: 'id' | 'en';
  platforms: string[];
  tone?: string;
  niche?: string;
  generateVoiceover?: boolean;
  generateVideo?: boolean;
}

interface GeneratedTextSet {
  titles: string[];
  script: string;
  caption: string;
  hashtags: string[];
  description: string;
  thumbnailPrompt: string;
}

const LANG_NAME: Record<string, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
};

// Split text into chunks of <=maxChars, breaking at sentence boundaries (., !, ?)
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+|\S+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    const candidate = (current + ' ' + s).trim();
    if (candidate.length > maxChars) {
      if (current) chunks.push(current.trim());
      if (s.length > maxChars) {
        for (let i = 0; i < s.length; i += maxChars) {
          chunks.push(s.slice(i, i + maxChars).trim());
        }
        current = '';
      } else {
        current = s.trim();
      }
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

// Merge multiple WAV files (same format) into one by combining PCM bodies and updating header
function mergeWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  const firstHeader = buffers[0].slice(0, 44);
  const sampleRate = firstHeader.readUInt32LE(24);
  const channels = firstHeader.readUInt16LE(22);
  const bitsPerSample = firstHeader.readUInt16LE(34);

  let totalDataSize = 0;
  for (const b of buffers) {
    const dataStr = 'data';
    let dataOffset = -1;
    for (let i = 12; i < b.length - 4; i++) {
      if (b.slice(i, i + 4).toString('ascii') === dataStr) {
        dataOffset = i + 4;
        break;
      }
    }
    if (dataOffset === -1) dataOffset = 44;
    totalDataSize += b.length - dataOffset;
  }

  const newBuffer = Buffer.alloc(44 + totalDataSize);
  firstHeader.copy(newBuffer, 0);
  newBuffer.writeUInt32LE(36 + totalDataSize, 4);
  newBuffer.writeUInt32LE(totalDataSize, 40);
  let offset = 44;
  for (const b of buffers) {
    let dataOffset = -1;
    for (let i = 12; i < b.length - 4; i++) {
      if (b.slice(i, i + 4).toString('ascii') === 'data') {
        dataOffset = i + 4;
        break;
      }
    }
    if (dataOffset === -1) dataOffset = 44;
    const body = b.slice(dataOffset);
    body.copy(newBuffer, offset);
    offset += body.length;
  }
  void sampleRate; void channels; void bitsPerSample;
  return newBuffer;
}

async function generateTextSet(
  topic: string,
  platform: string,
  language: 'id' | 'en',
  tone: string,
  niche: string
): Promise<GeneratedTextSet> {
  const langName = LANG_NAME[language];
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;

  const sys = `You are an expert social media content strategist and copywriter specialized in ${platformLabel} content.
You write in ${langName}.
You always return ONLY valid JSON (no markdown fences, no commentary).
Every output must be platform-native, engaging, and ready to publish.
IMPORTANT TYPE RULES:
- "titles" MUST be an array of 3 strings
- "script" MUST be a single string (NOT an array)
- "caption" MUST be a single string (NOT an array)
- "description" MUST be a single string (NOT an array)
- "hashtags" MUST be an array of strings (without # prefix)
- "thumbnailPrompt" MUST be a single string (in English)`;

  const user = `Create a complete ${platformLabel} content package about: "${topic}".
Tone: ${tone}
Niche: ${niche}
Language: ${langName}

Return JSON with these exact keys and types:
{
  "titles": ["title 1", "title 2", "title 3"],
  "script": "single string containing a 60-90 second video script with stage directions in brackets, 200-400 words, ready for voiceover",
  "caption": "single string with emoji, max 500 chars, hook first then CTA at end",
  "hashtags": ["hashtag1", "hashtag2", "...8-12 hashtags without # prefix"],
  "description": "single string for the platform description field, 150-300 words",
  "thumbnailPrompt": "single English sentence describing an eye-catching ${platformLabel} thumbnail image for this topic - visual style, colors, mood"
}

Return ONLY the JSON object, no markdown fences, no commentary.`;

  const result = await chatJSON<GeneratedTextSet>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    { temperature: 0.85, maxTokens: 4096 }
  );

  return normalizeTextSet(result);
}

function normalizeTextSet(raw: any): GeneratedTextSet {
  const arrToString = (v: any): string => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.join(' ');
    if (v == null) return '';
    return String(v);
  };
  const arrOfStr = (v: any): string[] => {
    if (Array.isArray(v)) return v.map((x) => arrToString(x)).filter(Boolean);
    if (typeof v === 'string') return v.split(/\n|,\s*/).map((s) => s.trim()).filter(Boolean);
    return [];
  };
  return {
    titles: arrOfStr(raw?.titles),
    script: arrToString(raw?.script),
    caption: arrToString(raw?.caption),
    hashtags: arrOfStr(raw?.hashtags),
    description: arrToString(raw?.description),
    thumbnailPrompt: arrToString(raw?.thumbnailPrompt),
  };
}

// Background pipeline — runs after we return the response
async function runPipeline(
  contentId: string,
  body: GenerationPayload,
  platforms: string[],
  language: 'id' | 'en',
  tone: string,
  niche: string,
  wantVoiceover: boolean,
  wantVideo: boolean
) {
  const dir = await ensureUploadsDir(contentId);
  const updateProgress = async (progress: number, step: string) => {
    await db.content.update({
      where: { id: contentId },
      data: { progress, step },
    });
  };

  try {
    // Step 1: Generate text content (sequential)
    await updateProgress(10, 'Membuat script & caption per platform');
    const textResults: (GeneratedTextSet | null)[] = [];
    for (const p of platforms) {
      try {
        const set = await generateTextSet(body.topic, p, language, tone, niche);
        textResults.push(set);
      } catch (e) {
        console.error(`Text gen failed for ${p}:`, e);
        textResults.push(null);
      }
      if (platforms.length > 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // Save text assets
    await updateProgress(40, 'Menyimpan script, caption & hashtag');
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const set = textResults[i];
      if (!set) continue;
      const makeAsset = (type: string, value: string, meta?: any) =>
        db.asset.create({
          data: { contentId, platform: p, type, value, meta: meta ? JSON.stringify(meta) : null },
        });
      await Promise.all([
        makeAsset('title', set.titles.join('\n---\n'), { count: set.titles.length }),
        makeAsset('script', set.script, { wordCount: set.script.split(/\s+/).length }),
        makeAsset('caption', set.caption, { length: set.caption.length }),
        makeAsset('hashtags', set.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' '), { count: set.hashtags.length }),
        makeAsset('description', set.description, { length: set.description.length }),
      ]);
    }

    // Step 2: Thumbnails (sequential)
    await updateProgress(55, 'Membuat thumbnail AI per platform');
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const set = textResults[i];
      if (!set?.thumbnailPrompt) continue;
      try {
        const size = PLATFORM_IMAGE_SIZE[p] ?? '1024x1024';
        const base64 = await generateImage(set.thumbnailPrompt, size);
        if (!base64) continue;
        const filename = `thumbnail-${p}.png`;
        const filepath = path.join(dir, filename);
        await saveBase64Image(base64, filepath);
        await db.asset.create({
          data: {
            contentId,
            platform: p,
            type: 'thumbnail',
            value: getPublicUrl(contentId, filename),
            meta: JSON.stringify({ size, filename, prompt: set.thumbnailPrompt }),
          },
        });
      } catch (e) {
        console.error(`Thumbnail gen failed for ${p}:`, e);
      }
      if (platforms.length > 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // Step 3: Voiceover (per platform)
    if (wantVoiceover) {
      await updateProgress(75, 'Membuat voiceover AI (TTS)');
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        const set = textResults[i];
        if (!set?.script) continue;
        try {
          const cleanScript = set.script
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\([^)]*\)/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!cleanScript) continue;

          const chunks = chunkText(cleanScript, 900);
          if (chunks.length === 0) continue;

          if (chunks.length === 1) {
            const buffer = await generateTTS(chunks[0], { voice: 'tongtong', speed: 1.0, format: 'wav' });
            const filename = `voiceover-${p}.wav`;
            await saveBuffer(buffer, path.join(dir, filename));
            await db.asset.create({
              data: {
                contentId,
                platform: p,
                type: 'voiceover',
                value: getPublicUrl(contentId, filename),
                meta: JSON.stringify({ filename, format: 'wav', sizeBytes: buffer.length, charCount: chunks[0].length }),
              },
            });
          } else {
            const buffers: Buffer[] = [];
            for (const chunk of chunks) {
              try {
                const buf = await generateTTS(chunk, { voice: 'tongtong', speed: 1.0, format: 'wav' });
                buffers.push(buf);
              } catch (e) {
                console.error(`TTS chunk failed for ${p}:`, e);
              }
              await new Promise((r) => setTimeout(r, 600));
            }
            if (buffers.length === 0) continue;
            const merged = mergeWavBuffers(buffers);
            const filename = `voiceover-${p}.wav`;
            await saveBuffer(merged, path.join(dir, filename));
            await db.asset.create({
              data: {
                contentId,
                platform: p,
                type: 'voiceover',
                value: getPublicUrl(contentId, filename),
                meta: JSON.stringify({ filename, format: 'wav', sizeBytes: merged.length, chunks: buffers.length }),
              },
            });
          }
        } catch (e) {
          console.error(`TTS gen failed for ${p}:`, e);
        }
        if (platforms.length > 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    // Step 4: Video
    if (wantVideo) {
      await updateProgress(85, 'Membuat video pendek AI (bisa 1-3 menit)');
      try {
        const firstSet = textResults.find(Boolean);
        const videoPromptBase = firstSet?.thumbnailPrompt
          ? `${firstSet.thumbnailPrompt}. Cinematic, smooth motion, professional lighting, vertical-friendly.`
          : `${body.topic}. Cinematic short clip, engaging social media content.`;

        const videoResult = await generateVideo(videoPromptBase, {
          duration: 5,
          size: '1280x720',
          withAudio: false,
        });

        if (videoResult.status === 'SUCCESS' && videoResult.videoUrl) {
          await db.asset.create({
            data: {
              contentId,
              platform: 'common',
              type: 'video',
              value: videoResult.videoUrl,
              meta: JSON.stringify({
                coverUrl: videoResult.coverUrl,
                duration: 5,
                size: '1280x720',
                source: 'zai-video-gen',
              }),
            },
          });
        } else {
          await db.asset.create({
            data: {
              contentId,
              platform: 'common',
              type: 'video',
              value: '',
              meta: JSON.stringify({ status: 'failed_or_timeout' }),
            },
          });
        }
      } catch (e: any) {
        console.error('Video gen failed:', e);
        await db.asset.create({
          data: {
            contentId,
            platform: 'common',
            type: 'video',
            value: '',
            meta: JSON.stringify({ error: e?.message ?? 'unknown' }),
          },
        });
      }
    }

    await updateProgress(100, 'Selesai');
    await db.content.update({
      where: { id: contentId },
      data: { status: 'completed', progress: 100, step: 'Selesai' },
    });
  } catch (error: any) {
    console.error('Pipeline failed:', error);
    await db.content.update({
      where: { id: contentId },
      data: {
        status: 'failed',
        error: error?.message ?? 'Unknown error',
        step: 'Gagal',
      },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerationPayload;
    if (!body.topic || !body.topic.trim()) {
      return NextResponse.json({ error: 'Topic wajib diisi' }, { status: 400 });
    }
    if (!body.platforms || body.platforms.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal 1 platform' }, { status: 400 });
    }

    const language = (body.language === 'en' ? 'en' : 'id') as 'id' | 'en';
    const platforms = body.platforms.filter((p) => ['youtube', 'facebook', 'tiktok', 'instagram'].includes(p));
    if (platforms.length === 0) {
      return NextResponse.json({ error: 'Platform tidak valid' }, { status: 400 });
    }
    const tone = body.tone || 'casual';
    const niche = body.niche || 'general';
    const wantVoiceover = body.generateVoiceover !== false;
    const wantVideo = body.generateVideo !== false;

    // Create content record
    const content = await db.content.create({
      data: {
        topic: body.topic.trim(),
        language,
        platforms: JSON.stringify(platforms),
        tone,
        niche,
        status: 'running',
        progress: 5,
        step: 'Memulai pipeline AI',
      },
    });

    // Fire pipeline in background — return immediately
    void runPipeline(content.id, body, platforms, language, tone, niche, wantVoiceover, wantVideo).catch((e) =>
      console.error('Background pipeline crashed:', e)
    );

    // Return content immediately (status=running)
    const fresh = await db.content.findUnique({
      where: { id: content.id },
      include: { assets: true },
    });
    return NextResponse.json({ content: fresh });
  } catch (error: any) {
    console.error('Failed to start generation:', error);
    return NextResponse.json({ error: error?.message ?? 'Generation failed' }, { status: 500 });
  }
}

export async function GET() {
  const items = await db.content.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { assets: true },
  });
  return NextResponse.json({ items });
}
