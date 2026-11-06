export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY belum dikonfigurasi di environment server.');
  }
  return apiKey;
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5.5';
}

async function requestCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {},
  jsonMode = false
): Promise<string> {
  if (messages.length === 0) {
    throw new Error('Pesan untuk AI tidak boleh kosong.');
  }

  const apiKey = getApiKey();
  const payload = {
    model: getModel(),
    messages,
    max_completion_tokens: options.maxTokens ?? 4096,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90_000),
        cache: 'no-store',
      });

      const result = (await response.json()) as OpenAIChatCompletionResponse;

      if (!response.ok) {
        const message = result.error?.message || `OpenAI API request failed (HTTP ${response.status}).`;
        const error = Object.assign(new Error(message), { status: response.status });
        const retryable = response.status === 429 || [500, 502, 503, 504].includes(response.status);

        if (!retryable || attempt === 3) {
          throw error;
        }
        lastError = error;
      } else {
        const content = result.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('OpenAI tidak mengembalikan konten teks.');
        }
        return content;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OpenAI request error';
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0;
      if (status && status !== 429 && ![500, 502, 503, 504].includes(status)) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(message);
      if (attempt === 3) throw lastError;
    }

    await new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * 2 ** attempt, 8_000)));
  }

  throw lastError ?? new Error('OpenAI request failed.');
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  return requestCompletion(messages, options);
}

export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<T> {
  const raw = await requestCompletion(messages, options, true);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('OpenAI mengembalikan JSON yang tidak valid.');
  }
}
