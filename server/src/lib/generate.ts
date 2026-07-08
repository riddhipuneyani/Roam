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
import { GenerationError, chatJson, isOpenAiConfigured } from './openai.js';
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
    `[roam] OPENAI_API_KEY is empty — serving built-in SAMPLE ${what} (dev only). ` +
      'Set the key in server/.env for real generation.',
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
    const raw = await chatJson(system, prompt, temperature);
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
  if (!isOpenAiConfigured()) {
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
): Promise<DestinationOption[]> {
  if (!isOpenAiConfigured()) {
    logSampleMode('destination options');
    return sampleDestinations(preferences);
  }
  return generateValidated(
    destinationsSystemPrompt(),
    destinationsUserPrompt(preferences),
    validateDestinationOptions,
    0.9,
  );
}

export async function regenerateActivity(
  itinerary: Itinerary,
  preferences: TripPreferences,
  dayNumber: number,
  slot: ActivitySlot,
): Promise<ActivityBlock> {
  if (!isOpenAiConfigured()) {
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
  if (!isOpenAiConfigured()) {
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
