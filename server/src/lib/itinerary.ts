export type BudgetTier = 'budget' | 'comfortable' | 'luxury';
export type Companions = 'solo' | 'partner' | 'friends' | 'family';

export const VIBES = [
  'relaxation',
  'adventure',
  'culture',
  'romance',
  'food',
  'family',
  'solo-reset',
] as const;

export interface TripPreferences {
  duration: number;
  budgetTier: BudgetTier;
  budgetEstimate: number;
  destinationKnown: boolean;
  destination: string | null;
  vibe: string[];
  companions: Companions;
  foodPreferences: string[];
  customInterests: string[];
}

export interface ActivityBlock {
  activity: string;
  description: string;
  why: string;
  estimatedCost: string;
  location: string;
}

export interface RestaurantRec {
  name: string;
  cuisine: string;
  priceRange: string;
  mealType: string;
  why: string;
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  morning: ActivityBlock;
  afternoon: ActivityBlock;
  evening: ActivityBlock;
  restaurants: RestaurantRec[];
  transport: string;
  dailyBudgetEstimate: string;
  tip: string;
}

export interface Itinerary {
  destination: string;
  tripSummary: string;
  estimatedTotalBudget: string;
  days: ItineraryDay[];
  packingList: string[];
  practicalTips: string[];
}

export interface DestinationOption {
  name: string;
  country: string;
  rationale: string;
}

export type ActivitySlot = 'morning' | 'afternoon' | 'evening';

/* ------------------------------------------------------------------ */
/* Validation — collects every problem so a retry prompt can list them */
/* ------------------------------------------------------------------ */

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path}.${key} must be a non-empty string`);
  }
}

function checkStringArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array of strings`);
    return;
  }
  if (!value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    errors.push(`${path} must contain only non-empty strings`);
  }
}

export function validateActivityBlock(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of ['activity', 'description', 'why', 'estimatedCost', 'location']) {
    checkString(value, key, path, errors);
  }
}

export function validateRestaurant(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of ['name', 'cuisine', 'priceRange', 'mealType', 'why']) {
    checkString(value, key, path, errors);
  }
}

function validateDay(
  value: unknown,
  index: number,
  errors: string[],
): void {
  const path = `days[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (value.dayNumber !== index + 1) {
    errors.push(`${path}.dayNumber must equal ${index + 1}`);
  }
  checkString(value, 'theme', path, errors);
  validateActivityBlock(value.morning, `${path}.morning`, errors);
  validateActivityBlock(value.afternoon, `${path}.afternoon`, errors);
  validateActivityBlock(value.evening, `${path}.evening`, errors);

  if (!Array.isArray(value.restaurants) || value.restaurants.length === 0) {
    errors.push(`${path}.restaurants must be a non-empty array`);
  } else {
    value.restaurants.forEach((restaurant, i) =>
      validateRestaurant(restaurant, `${path}.restaurants[${i}]`, errors),
    );
  }

  checkString(value, 'transport', path, errors);
  checkString(value, 'dailyBudgetEstimate', path, errors);
  checkString(value, 'tip', path, errors);
}

const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A trip must never suggest the same activity or restaurant twice, on any
 * day. Returns retry-prompt-ready error strings naming each duplication.
 */
function findCrossTripDuplicates(itinerary: Itinerary): string[] {
  const errors: string[] = [];

  const seenActivities = new Map<string, string>();
  const seenRestaurants = new Map<string, string>();

  for (const day of itinerary.days) {
    for (const slot of ['morning', 'afternoon', 'evening'] as const) {
      const name = normalizeName(day[slot].activity);
      const where = `day ${day.dayNumber} ${slot}`;
      const firstUse = seenActivities.get(name);
      if (firstUse) {
        errors.push(
          `duplicate activity: "${day[slot].activity}" at ${where} was already suggested at ${firstUse} — every activity must appear only once in the whole trip; replace the later one with a different real activity`,
        );
      } else {
        seenActivities.set(name, where);
      }
    }

    day.restaurants.forEach((restaurant, i) => {
      const name = normalizeName(restaurant.name);
      const where = `day ${day.dayNumber} restaurants[${i}]`;
      const firstUse = seenRestaurants.get(name);
      if (firstUse) {
        errors.push(
          `duplicate restaurant: "${restaurant.name}" at ${where} was already recommended at ${firstUse} — every restaurant must appear only once in the whole trip; replace the later one with a different real restaurant`,
        );
      } else {
        seenRestaurants.set(name, where);
      }
    });
  }

  return errors;
}

export function validateItinerary(
  value: unknown,
  expectedDays: number,
): Result<Itinerary> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['response must be a JSON object'] };
  }

  checkString(value, 'destination', 'itinerary', errors);
  checkString(value, 'tripSummary', 'itinerary', errors);
  checkString(value, 'estimatedTotalBudget', 'itinerary', errors);

  if (!Array.isArray(value.days)) {
    errors.push('days must be an array');
  } else {
    if (value.days.length !== expectedDays) {
      errors.push(`days must contain exactly ${expectedDays} entries (got ${value.days.length})`);
    }
    value.days.forEach((day, i) => validateDay(day, i, errors));
  }

  checkStringArray(value.packingList, 'packingList', errors);
  checkStringArray(value.practicalTips, 'practicalTips', errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Structure is sound — now enforce uniqueness across the whole trip.
  const duplicates = findCrossTripDuplicates(value as unknown as Itinerary);
  if (duplicates.length > 0) {
    return { ok: false, errors: duplicates };
  }

  return { ok: true, value: value as unknown as Itinerary };
}

export function validateDestinationOptions(
  value: unknown,
  exclude: string[] = [],
): Result<DestinationOption[]> {
  const errors: string[] = [];

  if (!isRecord(value) || !Array.isArray(value.options)) {
    return { ok: false, errors: ['response must be an object with an "options" array'] };
  }
  if (value.options.length < 3 || value.options.length > 5) {
    errors.push(`options must contain 3-5 destinations (got ${value.options.length})`);
  }
  value.options.forEach((option, i) => {
    const path = `options[${i}]`;
    if (!isRecord(option)) {
      errors.push(`${path} must be an object`);
      return;
    }
    checkString(option, 'name', path, errors);
    checkString(option, 'country', path, errors);
    checkString(option, 'rationale', path, errors);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // No repeats within the set, and nothing the traveler was already shown.
  const options = value.options as unknown as DestinationOption[];
  const excluded = new Set(exclude.map(normalizeName));
  const seen = new Set<string>();
  for (const option of options) {
    const name = normalizeName(option.name);
    if (seen.has(name)) {
      errors.push(
        `"${option.name}" appears more than once in options — every option must be a different destination`,
      );
    }
    seen.add(name);
    if (excluded.has(name)) {
      errors.push(
        `"${option.name}" was already shown to the traveler earlier — it must not be suggested again; pick a genuinely different destination`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: options };
}

export function validateSingleActivity(value: unknown): Result<ActivityBlock> {
  const errors: string[] = [];
  validateActivityBlock(value, 'activity', errors);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as unknown as ActivityBlock };
}

export function validateSingleRestaurant(value: unknown): Result<RestaurantRec> {
  const errors: string[] = [];
  validateRestaurant(value, 'restaurant', errors);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as unknown as RestaurantRec };
}

/* --------------------------------------------------- */
/* Preferences validation for incoming API request body */
/* --------------------------------------------------- */

const BUDGET_TIERS: readonly string[] = ['budget', 'comfortable', 'luxury'];
const COMPANIONS: readonly string[] = ['solo', 'partner', 'friends', 'family'];

export function validatePreferences(value: unknown): Result<TripPreferences> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['preferences must be an object'] };
  }

  const duration = value.duration;
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 14) {
    errors.push('duration must be an integer between 1 and 14');
  }

  if (typeof value.budgetTier !== 'string' || !BUDGET_TIERS.includes(value.budgetTier)) {
    errors.push('budgetTier must be one of budget | comfortable | luxury');
  }

  if (typeof value.budgetEstimate !== 'number' || value.budgetEstimate <= 0) {
    errors.push('budgetEstimate must be a positive number');
  }

  if (typeof value.destinationKnown !== 'boolean') {
    errors.push('destinationKnown must be a boolean');
  }

  if (value.destinationKnown === true) {
    if (typeof value.destination !== 'string' || value.destination.trim().length === 0) {
      errors.push('destination is required when destinationKnown is true');
    }
  } else if (value.destination !== null && typeof value.destination !== 'string') {
    errors.push('destination must be a string or null');
  }

  checkStringArray(value.vibe, 'vibe', errors);

  if (typeof value.companions !== 'string' || !COMPANIONS.includes(value.companions)) {
    errors.push('companions must be one of solo | partner | friends | family');
  }

  for (const key of ['foodPreferences', 'customInterests'] as const) {
    const arr = value[key];
    if (!Array.isArray(arr) || !arr.every((item) => typeof item === 'string')) {
      errors.push(`${key} must be an array of strings`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const prefs = value as unknown as TripPreferences;
  return {
    ok: true,
    value: {
      ...prefs,
      destination: prefs.destination?.trim() || null,
      vibe: prefs.vibe.map((v) => v.trim()).filter(Boolean),
      foodPreferences: prefs.foodPreferences.map((v) => v.trim()).filter(Boolean),
      customInterests: prefs.customInterests.map((v) => v.trim()).filter(Boolean),
    },
  };
}
