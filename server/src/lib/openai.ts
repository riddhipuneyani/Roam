import OpenAI from 'openai';

/**
 * Itinerary generation runs on Google's Gemini API through its
 * OpenAI-compatible endpoint, so the openai SDK is still the client.
 */
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

let client: OpenAI | null = null;

export function isGenerationConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    // The SDK already backs off and retries 429/5xx; give it a bit more room.
    client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL, maxRetries: 3 });
  }
  return client;
}

export class GenerationError extends Error {
  /** 'parse' failures are worth one retry with a corrective note; 'provider' failures are not. */
  readonly kind: 'parse' | 'provider';

  constructor(message: string, kind: 'parse' | 'provider' = 'parse') {
    super(message);
    this.name = 'GenerationError';
    this.kind = kind;
  }
}

/**
 * Some Gemini responses arrive fenced (```json ... ```) even in JSON mode —
 * strip the fence before parsing rather than assuming OpenAI's exact shape.
 */
function extractJson(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

/**
 * Send a system + user prompt pair and parse the JSON response.
 * Throws GenerationError when the response is not parseable JSON.
 */
export async function chatJson(
  system: string,
  user: string,
  temperature = 0.7,
): Promise<unknown> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  let completion;
  try {
    completion = await getClient().chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    // Gemini 2.5 models spend "thinking" tokens from the output budget; a
    // long multi-day itinerary needs generous headroom or the JSON truncates.
    max_completion_tokens: 32768,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
  } catch (error) {
    // Provider errors (rate limits, outages) must surface as the friendly
    // GenerationError path, never a raw 500.
    if (error instanceof OpenAI.APIError) {
      console.error(`[roam] Gemini API error ${error.status ?? 'unknown'}: ${error.message}`);
      throw new GenerationError(
        error.status === 429
          ? 'The itinerary service is briefly over capacity'
          : 'The itinerary service had a hiccup',
        'provider',
      );
    }
    throw error;
  }

  const choice = completion.choices[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new GenerationError('The model returned an empty response');
  }

  try {
    return JSON.parse(extractJson(content));
  } catch {
    const finish = choice?.finish_reason ?? 'unknown';
    throw new GenerationError(`The model returned malformed JSON (finish_reason: ${finish})`);
  }
}
