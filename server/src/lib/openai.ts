import OpenAI from 'openai';

let client: OpenAI | null = null;

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    client = new OpenAI({ apiKey });
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
 * Send a system + user prompt pair and parse the JSON response.
 * Throws GenerationError when the response is not parseable JSON.
 */
export async function chatJson(
  system: string,
  user: string,
  temperature = 0.7,
): Promise<unknown> {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

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
    return JSON.parse(content);
  } catch {
    throw new GenerationError('The model returned malformed JSON');
  }
}
