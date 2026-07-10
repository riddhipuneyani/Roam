import {
  type ActivityBlock,
  type ActivitySlot,
  type DestinationOption,
  type Itinerary,
  type ItineraryDay,
  type RestaurantRec,
  type TripPreferences,
  validateDestinationOptions,
  validateItinerary,
  validateRestaurant,
  validateSingleActivity,
  validateSingleRestaurant,
} from './itinerary.js';
import { GenerationError, chatJson, isGenerationConfigured } from './openai.js';
import {
  type CandidateForPrompt,
  type DayCandidatesForPrompt,
  destinationsSystemPrompt,
  destinationsUserPrompt,
  groundedRegenSystemPrompt,
  groundedRegenUserPrompt,
  groundedRestaurantsSystemPrompt,
  groundedRestaurantsUserPrompt,
  itinerarySystemPrompt,
  itineraryUserPrompt,
  preferenceCurrency,
  regenerateActivitySystemPrompt,
  regenerateActivityUserPrompt,
  regenerateRestaurantSystemPrompt,
  regenerateRestaurantUserPrompt,
  retryNote,
} from './prompts.js';
import { type Eatery, type GeoPoint, geocode, haversineM, nearbyEateries, walkingMinutes } from './geo.js';
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
  const itinerary = await generateValidated(
    itinerarySystemPrompt(preferences.duration, preferenceCurrency(preferences).code),
    itineraryUserPrompt(destination, preferences),
    (value) => validateItinerary(value, preferences.duration),
    0.7,
  );

  // Grounding pass: replace model-suggested restaurants with real nearby
  // places from OpenStreetMap. A failure here must never sink the whole
  // generation — the ungrounded itinerary is still a complete product.
  try {
    await groundRestaurants(itinerary, preferences);
  } catch (error) {
    console.warn(
      `[roam] restaurant grounding failed — keeping model-suggested restaurants: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
  return itinerary;
}

/* --------------------------- restaurant grounding --------------------------- */

const SLOTS: readonly ActivitySlot[] = ['morning', 'afternoon', 'evening'];
const CANDIDATE_RADIUS_M = 1500;
const CANDIDATES_PER_DAY = 10;

const normName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Geocode every activity location (cache-first, 1 req/s on misses) and
 * attach coordinates to the blocks so the client can draw day maps.
 */
async function annotateActivityCoordinates(itinerary: Itinerary): Promise<void> {
  const resolved = new Map<string, GeoPoint | null>();
  for (const day of itinerary.days) {
    for (const slot of SLOTS) {
      const block = day[slot];
      const query = `${block.location}, ${itinerary.destination}`;
      if (!resolved.has(query)) {
        resolved.set(query, await geocode(query));
      }
      const point = resolved.get(query) ?? null;
      block.lat = point?.lat ?? null;
      block.lon = point?.lon ?? null;
    }
  }
}

function dayActivityPoints(day: ItineraryDay): Array<{ point: GeoPoint; activity: string }> {
  return SLOTS.flatMap((slot) => {
    const block = day[slot];
    return typeof block.lat === 'number' && typeof block.lon === 'number'
      ? [{ point: { lat: block.lat, lon: block.lon }, activity: block.activity }]
      : [];
  });
}

function rankCandidates(
  eateries: Eatery[],
  anchors: Array<{ point: GeoPoint; activity: string }>,
  exclude: Set<string>,
  limit = CANDIDATES_PER_DAY,
): CandidateForPrompt[] {
  const ranked: CandidateForPrompt[] = [];
  for (const eatery of eateries) {
    if (exclude.has(normName(eatery.name))) continue;
    let best: { distanceM: number; activity: string } | null = null;
    for (const anchor of anchors) {
      const distanceM = haversineM(anchor.point, { lat: eatery.lat, lon: eatery.lon });
      if (distanceM <= CANDIDATE_RADIUS_M && (!best || distanceM < best.distanceM)) {
        best = { distanceM, activity: anchor.activity };
      }
    }
    if (best) {
      ranked.push({
        name: eatery.name,
        cuisine: eatery.cuisine,
        amenity: eatery.amenity,
        distanceM: best.distanceM,
        nearestActivity: best.activity,
        walkMinutes: walkingMinutes(best.distanceM),
      });
    }
  }
  return ranked.sort((a, b) => a.distanceM - b.distanceM).slice(0, limit);
}

interface GroundedSelection {
  days: Array<{ dayNumber: number; restaurants: RestaurantRec[] }>;
}

function validateGroundedSelection(
  value: unknown,
  itinerary: Itinerary,
  dayCandidates: DayCandidatesForPrompt[],
): { ok: true; value: GroundedSelection } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const v = value as { days?: unknown };
  if (!v || !Array.isArray(v.days) || v.days.length !== itinerary.days.length) {
    return { ok: false, errors: [`response must have a "days" array with ${itinerary.days.length} entries`] };
  }
  const usedNames = new Map<string, number>();
  v.days.forEach((entry, i) => {
    const day = entry as { dayNumber?: unknown; restaurants?: unknown };
    if (day.dayNumber !== i + 1) errors.push(`days[${i}].dayNumber must equal ${i + 1}`);
    if (!Array.isArray(day.restaurants) || day.restaurants.length < 1 || day.restaurants.length > 3) {
      errors.push(`days[${i}].restaurants must contain 1-3 entries`);
      return;
    }
    const candidates = dayCandidates.find((d) => d.dayNumber === i + 1)?.candidates ?? [];
    const candidateNames = new Set(candidates.map((c) => normName(c.name)));
    day.restaurants.forEach((restaurant, j) => {
      validateRestaurant(restaurant, `days[${i}].restaurants[${j}]`, errors);
      const name = (restaurant as { name?: unknown }).name;
      if (typeof name !== 'string') return;
      const key = normName(name);
      if (candidates.length > 0 && !candidateNames.has(key)) {
        errors.push(
          `days[${i}].restaurants[${j}] "${name}" is not in day ${i + 1}'s candidate list — copy a candidate name exactly`,
        );
      }
      const firstUse = usedNames.get(key);
      if (firstUse !== undefined && firstUse !== i) {
        errors.push(`"${name}" was already picked for day ${firstUse + 1} — no restaurant may repeat across days`);
      }
      usedNames.set(key, i);
    });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: v as GroundedSelection };
}

async function groundRestaurants(itinerary: Itinerary, preferences: TripPreferences): Promise<void> {
  await annotateActivityCoordinates(itinerary);

  const allAnchors = itinerary.days.flatMap(dayActivityPoints);
  if (allAnchors.length === 0) {
    console.warn('[roam] no activity locations could be geocoded — restaurants stay ungrounded');
    return;
  }

  const eateries = await nearbyEateries(allAnchors.map((a) => a.point));
  const dayCandidates: DayCandidatesForPrompt[] = itinerary.days.map((day) => ({
    dayNumber: day.dayNumber,
    candidates: rankCandidates(eateries, dayActivityPoints(day), new Set()),
  }));

  const groundedDays = dayCandidates.filter((d) => d.candidates.length > 0).length;
  if (groundedDays === 0) {
    console.warn('[roam] Overpass found no eateries near any activity — restaurants stay ungrounded');
    return;
  }
  console.log(
    `[roam] grounding restaurants: ${eateries.length} real places found, candidates on ${groundedDays}/${itinerary.days.length} days`,
  );

  const selection = await generateValidated(
    groundedRestaurantsSystemPrompt(preferenceCurrency(preferences).code),
    groundedRestaurantsUserPrompt(itinerary, preferences, dayCandidates),
    (value) => validateGroundedSelection(value, itinerary, dayCandidates),
    0.6,
  );

  const eateryByName = new Map(eateries.map((e) => [normName(e.name), e]));
  for (const entry of selection.days) {
    const day = itinerary.days[entry.dayNumber - 1];
    day.restaurants = entry.restaurants.map((restaurant) => {
      const match = eateryByName.get(normName(restaurant.name));
      return match
        ? { ...restaurant, lat: match.lat, lon: match.lon }
        : { ...restaurant, lat: null, lon: null };
    });
  }
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
  const block = await generateValidated(
    regenerateActivitySystemPrompt(),
    regenerateActivityUserPrompt(itinerary, preferences, dayNumber, slot),
    validateSingleActivity,
    0.9,
  );
  // Keep the day map honest: geocode the replacement's location.
  try {
    const point = await geocode(`${block.location}, ${itinerary.destination}`);
    block.lat = point?.lat ?? null;
    block.lon = point?.lon ?? null;
  } catch {
    block.lat = null;
    block.lon = null;
  }
  return block;
}

export async function regenerateRestaurant(
  itinerary: Itinerary,
  preferences: TripPreferences,
  dayNumber: number,
  restaurantIndex: number,
): Promise<RestaurantRec> {
  const day = itinerary.days[dayNumber - 1];
  const current = day.restaurants[restaurantIndex];
  if (!isGenerationConfigured()) {
    logSampleMode('restaurant');
    return sampleRestaurant(preferences, current.mealType);
  }

  // Grounded path: re-query real candidates near the day's activities
  // (geocoding is cache-warm from the original generation), excluding every
  // restaurant already anywhere in the trip.
  try {
    let anchors = dayActivityPoints(day);
    if (anchors.length === 0) {
      // Older trips predate coordinate annotation — geocode on demand.
      for (const slot of SLOTS) {
        const block = day[slot];
        const point = await geocode(`${block.location}, ${itinerary.destination}`);
        block.lat = point?.lat ?? null;
        block.lon = point?.lon ?? null;
      }
      anchors = dayActivityPoints(day);
    }

    if (anchors.length > 0) {
      const used = new Set(
        itinerary.days.flatMap((d) => d.restaurants.map((r) => normName(r.name))),
      );
      const eateries = await nearbyEateries(anchors.map((a) => a.point));
      const candidates = rankCandidates(eateries, anchors, used, 12);

      if (candidates.length > 0) {
        const candidateNames = new Set(candidates.map((c) => normName(c.name)));
        const pick = await generateValidated(
          groundedRegenSystemPrompt(preferenceCurrency(preferences).code),
          groundedRegenUserPrompt(itinerary, preferences, dayNumber, current, candidates),
          (value) => {
            const result = validateSingleRestaurant(value);
            if (!result.ok) return result;
            if (!candidateNames.has(normName(result.value.name))) {
              return {
                ok: false as const,
                errors: [`"${result.value.name}" is not in the candidate list — copy a candidate name exactly`],
              };
            }
            return result;
          },
          0.8,
        );
        const match = eateries.find((e) => normName(e.name) === normName(pick.name));
        return { ...pick, lat: match?.lat ?? null, lon: match?.lon ?? null };
      }
      console.warn(`[roam] no unused real candidates near day ${dayNumber} — falling back to ungrounded regen`);
    }
  } catch (error) {
    console.warn(
      `[roam] grounded restaurant regen failed — falling back to ungrounded: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }

  // Ungrounded fallback (sparse OSM coverage or OSM outage) — the prompt
  // already forbids repeating anything planned that day.
  return generateValidated(
    regenerateRestaurantSystemPrompt(),
    regenerateRestaurantUserPrompt(itinerary, preferences, dayNumber, current),
    validateSingleRestaurant,
    0.9,
  );
}
