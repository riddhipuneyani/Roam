import {
  type ActivityBlock,
  type ActivitySlot,
  type DestinationOption,
  type Itinerary,
  type RestaurantRec,
  type TripPreferences,
  validateDestinationOptions,
  validateItinerary,
  validateSingleActivity,
  validateSingleRestaurant,
} from './itinerary.js';
import { GenerationError, chatJson, isGenerationConfigured } from './openai.js';
import {
  destinationsSystemPrompt,
  destinationsUserPrompt,
  itinerarySystemPrompt,
  itineraryUserPrompt,
  regenerateActivitySystemPrompt,
  regenerateActivityUserPrompt,
  regenerateRestaurantSystemPrompt,
  regenerateRestaurantUserPrompt,
  retryNote,
} from './prompts.js';
import {
  sampleActivity,
  sampleDestinations,
  sampleItinerary,
  sampleRestaurant,
} from './sample.js';

function logSampleMode(what: string): void {
  console.warn(
    `[roam] no generation provider has an API key — serving built-in SAMPLE ${what} (dev only). ` +
      'Set GEMINI_API_KEY and/or GROQ_API_KEY in server/.env for real generation.',
  );
}

/**
 * Generic call → validate → retry-once loop. The retry prompt includes the
 * exact validation failures so the model can correct them.
 */
async function generateValidated<T>(
  system: string,
  user: string,
  validate: (value: unknown) => { ok: true; value: T } | { ok: false; errors: string[] },
  temperature: number,
): Promise<T> {
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = attempt === 0 ? user : user + retryNote(lastErrors);

    let raw: unknown;
    try {
      raw = await chatJson(system, prompt, temperature);
    } catch (error) {
      // Malformed/truncated JSON burns a retry too, with a targeted note.
      // Provider errors (rate limits, outages) are not retried here — the
      // SDK already backed off, and a corrective prompt can't fix a 429.
      if (error instanceof GenerationError && error.kind === 'parse' && attempt === 0) {
        lastErrors = [
          'the previous response was not valid JSON (possibly truncated or wrapped in commentary) — respond with the complete, well-formed JSON object and nothing else',
        ];
        console.warn(`[roam] generation attempt 1 returned malformed JSON: ${error.message} — retrying`);
        continue;
      }
      throw error;
    }

    const result = validate(raw);
    if (result.ok) {
      return result.value;
    }
    lastErrors = result.errors;
    console.warn(`[roam] generation attempt ${attempt + 1} failed validation:`, lastErrors.slice(0, 6));
  }

  throw new GenerationError('The response did not match the expected format after a retry');
}

export async function generateItinerary(
  destination: string,
  preferences: TripPreferences,
): Promise<Itinerary> {
  if (!isGenerationConfigured()) {
    logSampleMode('itinerary');
    return sampleItinerary(destination, preferences);
  }
  return generateValidated(
    itinerarySystemPrompt(preferences.duration),
    itineraryUserPrompt(destination, preferences),
    (value) => validateItinerary(value, preferences.duration),
    0.7,
  );
}

export async function generateDestinations(
  preferences: TripPreferences,
  exclude: string[] = [],
): Promise<DestinationOption[]> {
  if (!isGenerationConfigured()) {
    logSampleMode('destination options');
    return sampleDestinations(preferences, exclude);
  }
  return generateValidated(
    destinationsSystemPrompt(),
    destinationsUserPrompt(preferences, exclude),
    (value) => validateDestinationOptions(value, exclude),
    0.9,
  );
}

export async function regenerateActivity(
  itinerary: Itinerary,
  preferences: TripPreferences,
  dayNumber: number,
  slot: ActivitySlot,
): Promise<ActivityBlock> {
  if (!isGenerationConfigured()) {
    logSampleMode(`${slot} activity`);
    return sampleActivity(slot, preferences);
  }
  return generateValidated(
    regenerateActivitySystemPrompt(),
    regenerateActivityUserPrompt(itinerary, preferences, dayNumber, slot),
    validateSingleActivity,
    0.9,
  );
}

export async function regenerateRestaurant(
  itinerary: Itinerary,
  preferences: TripPreferences,
  dayNumber: number,
  restaurantIndex: number,
): Promise<RestaurantRec> {
  const current = itinerary.days[dayNumber - 1].restaurants[restaurantIndex];
  if (!isGenerationConfigured()) {
    logSampleMode('restaurant');
    return sampleRestaurant(preferences, current.mealType);
  }
  return generateValidated(
    regenerateRestaurantSystemPrompt(),
    regenerateRestaurantUserPrompt(itinerary, preferences, dayNumber, current),
    validateSingleRestaurant,
    0.9,
  );
}
