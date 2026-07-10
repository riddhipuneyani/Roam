import OpenAI from 'openai';

/**
 * Provider-selection layer for generation calls.
 *
 * An ordered chain of OpenAI-compatible providers is tried in turn; when one
 * is unavailable (quota/rate limit, timeout, outage, bad model) the next is
 * tried automatically. Validation and retry logic upstream never sees which
 * provider actually served a request — this layer only decides who answers.
 *
 * Configure with GENERATION_CHAIN, a comma-separated list of provider:model
 * entries, e.g. "gemini:gemini-2.5-flash,gemini:gemini-2.5-flash-lite,groq:llama-3.3-70b-versatile".
 * Entries whose provider has no API key in the environment are skipped.
 */

const PROVIDERS: Record<
  string,
  { baseURL: string; keyEnv: string; maxCompletionTokens: number }
> = {
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    keyEnv: 'GEMINI_API_KEY',
    // Gemini 2.5 thinking tokens spend from the output budget — long
    // multi-day itineraries truncate without generous headroom.
    maxCompletionTokens: 32768,
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    // Groq counts the requested output budget toward its per-minute token
    // limit (12k TPM on the free tier) — ask only for what the JSON needs.
    maxCompletionTokens: 8192,
  },
};

interface ChainEntry {
  provider: string;
  model: string;
  label: string; // "gemini:gemini-2.5-flash", for logs
}

function defaultChain(): string {
  const primaryModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const entries = [`gemini:${primaryModel}`];
  if (primaryModel !== 'gemini-2.5-flash-lite') {
    entries.push('gemini:gemini-2.5-flash-lite');
  }
  entries.push('groq:llama-3.3-70b-versatile');
  return entries.join(',');
}

/** The configured chain, keeping only entries whose provider has a key. */
export function generationChain(): ChainEntry[] {
  const raw = process.env.GENERATION_CHAIN ?? defaultChain();
  const entries: ChainEntry[] = [];
  for (const item of raw.split(',')) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    const provider = colon === -1 ? trimmed : trimmed.slice(0, colon);
    const model = colon === -1 ? '' : trimmed.slice(colon + 1);
    const spec = PROVIDERS[provider];
    if (!spec || !model) {
      console.warn(`[roam] ignoring malformed GENERATION_CHAIN entry: "${trimmed}"`);
      continue;
    }
    if (!process.env[spec.keyEnv]) continue; // no key — skip silently
    entries.push({ provider, model, label: `${provider}:${model}` });
  }
  return entries;
}

export function isGenerationConfigured(): boolean {
  return generationChain().length > 0;
}

const clients = new Map<string, OpenAI>();

function clientFor(provider: string): OpenAI {
  let client = clients.get(provider);
  if (!client) {
    const spec = PROVIDERS[provider];
    client = new OpenAI({
      apiKey: process.env[spec.keyEnv],
      baseURL: spec.baseURL,
    });
    clients.set(provider, client);
  }
  return client;
}

export class GenerationError extends Error {
  readonly kind: 'parse' | 'provider';

  constructor(message: string, kind: 'parse' | 'provider' = 'parse') {
    super(message);
    this.name = 'GenerationError';
    this.kind = kind;
  }
}

/**
 * Some models emit fenced JSON (```json ... ```) even in JSON mode —
 * strip the fence before parsing rather than assuming one exact shape.
 */
function extractJson(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function describeFailure(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    return `${error.status ?? 'API'} ${error.message}`.slice(0, 200);
  }
  if (error instanceof Error) return error.message.slice(0, 200);
  return String(error).slice(0, 200);
}

const REQUEST_TIMEOUT_MS = Number(process.env.GENERATION_TIMEOUT_MS) || 120_000;

/**
 * Send a system + user prompt pair through the provider chain and parse the
 * JSON response. Provider failures (rate limits, timeouts, outages) advance
 * the chain; only when every provider fails does the caller see an error.
 * Malformed JSON from a healthy provider throws a 'parse' GenerationError so
 * the upstream validation retry can ask for a corrected response.
 */
export async function chatJson(
  system: string,
  user: string,
  temperature = 0.7,
): Promise<unknown> {
  const chain = generationChain();
  if (chain.length === 0) {
    throw new GenerationError('No generation provider is configured', 'provider');
  }

  let lastFailure = '';
  for (const entry of chain) {
    let completion;
    try {
      completion = await clientFor(entry.provider).chat.completions.create(
        {
          model: entry.model,
          temperature,
          response_format: { type: 'json_object' },
          max_completion_tokens: PROVIDERS[entry.provider].maxCompletionTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        { timeout: REQUEST_TIMEOUT_MS },
      );
    } catch (error) {
      // Any provider-side failure (429 quota, 5xx, timeout, bad model,
      // revoked key) means this provider can't serve us right now — the next
      // one in the chain might. A repeat call here would fail identically.
      lastFailure = describeFailure(error);
      const position = chain.indexOf(entry);
      const next = chain[position + 1];
      console.warn(
        `[roam] ${entry.label} unavailable (${lastFailure})${next ? ` — trying ${next.label}` : ' — chain exhausted'}`,
      );
      continue;
    }

    const choice = completion.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      throw new GenerationError(
        `The model returned an empty response (served by ${entry.label})`,
      );
    }

    console.log(`[roam] generation served by ${entry.label}`);
    try {
      return JSON.parse(extractJson(content));
    } catch {
      const finish = choice?.finish_reason ?? 'unknown';
      throw new GenerationError(
        `The model returned malformed JSON (served by ${entry.label}, finish_reason: ${finish})`,
      );
    }
  }

  console.error(`[roam] every generation provider failed; last error: ${lastFailure}`);
  throw new GenerationError(
    'We’ve hit today’s planning limit — every source we use is busy. Please try again in a little while.',
    'provider',
  );
}
