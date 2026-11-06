import path from 'path';
import { promises as fsp } from 'fs';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OPENAI_API_BASE = 'https://api.openai.com/v1';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY belum dikonfigurasi di environment server.');
  }
  return key;
}

function getTextModel(): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || 'gpt-6-luna';
}

async function requestOpenAI<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  operation: string
): Promise<T> {
  const apiKey = getApiKey();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(`${OPENAI_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const responseText = await response.text();
      let message = responseText;
      try {
        const parsed = JSON.parse(responseText);
        message = parsed?.error?.message || responseText;
      } catch {
        // Keep the original response body for diagnostics.
      }

      const error = new Error(`OpenAI ${operation} failed (${response.status}): ${message}`);
      lastError = error;

      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('OpenAI ')) {
        lastError = error;
        if (!/\((429|500|502|503|504)\)/.test(error.message) || attempt === 3) {
          throw error;
        }
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === 3) {
          throw new Error(`OpenAI ${operation} request failed: ${lastError.message}`);
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }

  throw lastError ?? new Error(`OpenAI ${operation} failed.`);
}

function extractResponseText(response: any): string {
  if (typeof response?.output_text === 'string') {
    return response.output_text;
  }

  const parts: string[] = [];
  for (const item of response?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }
  return parts.join('\n').trim();
}

export async function chat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const response = await requestOpenAI<any>(
    '/responses',
    {
      model: getTextModel(),
      input: messages.map(({ role, content }) => ({ role, content })),
      max_output_tokens: options.maxTokens ?? 4096,
    },
    'text generation'
  );

  const output = extractResponseText(response);
  if (!output) {
    throw new Error('OpenAI returned an empty text response.');
  }
  return output;
}

export async function chatJSON<T = any>(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const raw = await chat(messages, options);
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const firstBrace = cleaned.search(/[\[{]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace >= firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error('OpenAI returned invalid JSON for structured content generation.');
  }
}

export async function generateImage(
  prompt: string,
  size: '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440' = '1024x1024'
): Promise<string> {
  const response = await requestOpenAI<any>(
    '/images/generations',
    {
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2.5-flare',
      prompt,
      size,
      n: 1,
      quality: 'medium',
      output_format: 'png',
    },
    'image generation'
  );

  const base64 = response?.data?.[0]?.b64_json;
  if (typeof base64 !== 'string' || !base64) {
    throw new Error('OpenAI image response did not contain image data.');
  }
  return base64;
}

export async function generateTTS(
  text: string,
  options: { voice?: string; speed?: number; format?: 'wav' | 'pcm' } = {}
): Promise<Buffer> {
  const response = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
      input: text,
      voice: options.voice && options.voice !== 'tongtong' ? options.voice : 'marin',
      speed: options.speed ?? 1,
      response_format: options.format ?? 'wav',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI speech generation failed (${response.status}): ${message}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export interface VideoTaskResult {
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  videoUrl?: string;
  coverUrl?: string;
}

export async function generateVideo(
  _prompt: string,
  _options: { duration?: 5 | 10; size?: string; withAudio?: boolean } = {}
): Promise<VideoTaskResult> {
  throw new Error(
    'Video generation belum tersedia melalui integrasi OpenAI pada aplikasi ini. Fitur video perlu provider video khusus.'
  );
}

export async function saveBase64Image(base64: string, filepath: string): Promise<void> {
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleaned, 'base64');
  await fsp.mkdir(path.dirname(filepath), { recursive: true });
  await fsp.writeFile(filepath, buffer);
}

export async function saveBuffer(buffer: Buffer, filepath: string): Promise<void> {
  await fsp.mkdir(path.dirname(filepath), { recursive: true });
  await fsp.writeFile(filepath, buffer);
}
