import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';
import { promises as fsp } from 'fs';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

export async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const zai = await getZAI();
  // Retry with backoff for 429
  let lastErr: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
        temperature: options.temperature ?? 0.8,
        max_tokens: options.maxTokens ?? 4096,
      } as any);
      return completion.choices[0]?.message?.content ?? '';
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message ?? '';
      if (msg.includes('429') || msg.includes('Too many requests')) {
        // backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function chatJSON<T = any>(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const raw = await chat(messages, options);
  // Extract JSON from possible markdown code fences
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  // Find first { or [ and last } or ]
  const firstBrace = cleaned.search(/[{[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as T;
}

async function withRetry<T>(fn: () => Promise<T>, name = 'API'): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message ?? '';
      if (msg.includes('429') || msg.includes('Too many requests')) {
        const wait = 1500 * Math.pow(2, attempt); // 1.5s, 3s, 6s, 12s
        console.warn(`${name} got 429, retrying in ${wait}ms (attempt ${attempt + 1}/4)`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function generateImage(
  prompt: string,
  size: '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440' = '1024x1024'
): Promise<string> {
  return withRetry(async () => {
    const zai = await getZAI();
    const response = await zai.images.generations.create({
      prompt,
      size,
    } as any);
    return response.data[0]?.base64 ?? '';
  }, 'generateImage');
}

export async function generateTTS(
  text: string,
  options: { voice?: string; speed?: number; format?: 'wav' | 'pcm' } = {}
): Promise<Buffer> {
  return withRetry(async () => {
    const zai = await getZAI();
    const response = await zai.audio.tts.create({
      input: text,
      voice: options.voice ?? 'tongtong',
      speed: options.speed ?? 1.0,
      response_format: options.format ?? 'wav',
      stream: false,
    } as any);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(new Uint8Array(arrayBuffer));
  }, 'generateTTS');
}

export interface VideoTaskResult {
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  videoUrl?: string;
  coverUrl?: string;
}

export const generateVideo = async (
  prompt: string,
  options: {
    duration?: 5 | 10;
    size?: string;
    withAudio?: boolean;
  } = {}
): Promise<VideoTaskResult> => {
  const zai = await getZAI();
  const task = await zai.video.generations.create({
    prompt,
    quality: 'speed',
    with_audio: options.withAudio ?? false,
    size: options.size ?? '1280x720',
    fps: 30,
    duration: options.duration ?? 5,
  } as any);

  const taskId = (task as any).id;
  if (!taskId) {
    throw new Error('Failed to create video task: ' + JSON.stringify(task));
  }

  // Poll for completion (max ~3 min)
  const maxPolls = 36;
  const pollInterval = 5000;
  let result: any = task;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));
    result = await (zai as any).async.result.query(taskId);
    const status = result?.task_status;
    if (status === 'SUCCESS') {
      const videoUrl = result.video_result?.[0]?.url || result.video_url || result.url || result.video;
      const coverUrl = result.video_result?.[0]?.cover_image_url || result.cover_image_url;
      return { status: 'SUCCESS', videoUrl, coverUrl };
    }
    if (status === 'FAILED' || status === 'FAIL') {
      return { status: 'FAILED' };
    }
  }
  return { status: 'FAILED' };
};

// Save base64 to file
export async function saveBase64Image(base64: string, filepath: string): Promise<void> {
  // Strip data URL prefix if present
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleaned, 'base64');
  await fsp.mkdir(path.dirname(filepath), { recursive: true });
  await fsp.writeFile(filepath, buffer);
}

export async function saveBuffer(buffer: Buffer, filepath: string): Promise<void> {
  await fsp.mkdir(path.dirname(filepath), { recursive: true });
  await fsp.writeFile(filepath, buffer);
}
