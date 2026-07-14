import { prisma } from './prisma.js';

/**
 * Geocoding (Nominatim) + nearby eateries (Overpass), both OpenStreetMap
 * services with strict usage policies:
 *  - Nominatim: max 1 request/second, identifying User-Agent. Requests go
 *    through a serial queue with a delay, and results (misses included)
 *    are cached in the GeoCache table keyed by normalized query.
 *  - Overpass: one union query per trip rather than one per location.
 */

const USER_AGENT = 'Roam Travel Planner (dev build; contact: rajpuneyani@gmail.com)';
const NOMINATIM_DELAY_MS = 1100;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Eatery {
  name: string;
  cuisine: string | null;
  amenity: string;
  lat: number;
  lon: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------- Nominatim, politely ------------------------- */

let nominatimQueue: Promise<unknown> = Promise.resolve();

function enqueueNominatim<T>(job: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(async () => {
    const result = await job();
    await sleep(NOMINATIM_DELAY_MS);
    return result;
  });
  nominatimQueue = run.catch(() => {});
  return run;
}

const normalizeQuery = (query: string): string =>
  query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 400);

/** Observability-only counters, filled when a caller passes them in. */
export interface GeocodeStats {
  cacheHits: number;
  nominatimCalls: number;
  failures: number;
}

/**
 * Geocode a free-text location. Returns null when the place can't be found.
 * Lookup misses are cached; transient network failures are not.
 */
export async function geocode(query: string, stats?: GeocodeStats): Promise<GeoPoint | null> {
  const key = normalizeQuery(query);
  if (!key) return null;

  const cached = await prisma.geoCache.findUnique({ where: { query: key } });
  if (cached) {
    if (stats) stats.cacheHits += 1;
    return cached.lat !== null && cached.lon !== null
      ? { lat: cached.lat, lon: cached.lon }
      : null;
  }
  if (stats) stats.nominatimCalls += 1;

  let point: GeoPoint | null;
  try {
    point = await enqueueNominatim(async () => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) {
        throw new Error(`Nominatim responded ${response.status}`);
      }
      const results = (await response.json()) as Array<{ lat: string; lon: string }>;
      const first = results[0];
      return first ? { lat: Number(first.lat), lon: Number(first.lon) } : null;
    });
  } catch (error) {
    // Transient failure — don't poison the cache with it.
    if (stats) stats.failures += 1;
    console.warn(
      `[roam] geocoding failed for "${query}": ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }

  await prisma.geoCache
    .upsert({
      where: { query: key },
      create: { query: key, lat: point?.lat ?? null, lon: point?.lon ?? null },
      update: {},
    })
    .catch(() => {
      /* cache write races are harmless */
    });

  return point;
}

/* ------------------------------ Overpass ------------------------------ */

/**
 * Real restaurants/cafes near ANY of the given points, deduped by name,
 * with obviously-closed places filtered out. One request per call.
 */
export async function nearbyEateries(points: GeoPoint[], radiusM = 1500): Promise<Eatery[]> {
  if (points.length === 0) return [];

  const around = points
    .map((p) => `${radiusM},${p.lat.toFixed(5)},${p.lon.toFixed(5)}`)
    .map(
      (area) =>
        `node["amenity"~"^(restaurant|cafe)$"]["name"](around:${area});` +
        `way["amenity"~"^(restaurant|cafe)$"]["name"](around:${area});`,
    )
    .join('');
  const query = `[out:json][timeout:25];(${around});out center 250;`;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error(`Overpass responded ${response.status}`);
  }

  const data = (await response.json()) as {
    elements: Array<{
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const seen = new Set<string>();
  const eateries: Eatery[] = [];
  for (const element of data.elements ?? []) {
    const tags = element.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    if (tags.operational_status === 'closed' || tags['disused:amenity']) continue;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    eateries.push({ name: name.trim(), cuisine: tags.cuisine ?? null, amenity: tags.amenity ?? 'restaurant', lat, lon });
  }
  return eateries;
}

/* ------------------------------- distance ------------------------------- */

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** ~80 meters per minute of unhurried city walking. */
export function walkingMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / 80));
}
