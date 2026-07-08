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
    client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }
  return client;
}

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationError';
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

  const completion = await getClient().chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new GenerationError('The model returned an empty response');
  }

  try {
    return JSON.parse(extractJson(content));
  } catch {
    throw new GenerationError('The model returned malformed JSON');
  }
}
