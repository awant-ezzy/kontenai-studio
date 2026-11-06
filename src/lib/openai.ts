import OpenAI from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
}

let client: OpenAI | null = null;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY belum dikonfigurasi di environment server.');
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      timeout: 90_000,
      maxRetries: 0,
    });
  }

  return client;
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5.5';
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0;
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

      if (!retryable || attempt === 3) {
        throw error;
      }

      const waitMs = Math.min(1_000 * 2 ** attempt, 8_000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

async function requestText(
  messages: ChatMessage[],
  options: ChatOptions = {},
  jsonMode = false
): Promise<string> {
  if (messages.length === 0) {
    throw new Error('Pesan untuk AI tidak boleh kosong.');
  }

  const completion = await withRetry(() =>
    getOpenAI().chat.completions.create({
      model: getModel(),
      messages,
      max_completion_tokens: options.maxTokens ?? 4096,
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    })
  );

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI tidak mengembalikan konten teks.');
  }

  return text;
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  return requestText(messages, options);
}

export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<T> {
  const raw = await requestText(messages, options, true);

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('OpenAI mengembalikan JSON yang tidak valid.');
  }
}

/** Reset the cached client in tests or when server configuration is reloaded. */
export function resetOpenAIClient(): void {
  client = null;
}
