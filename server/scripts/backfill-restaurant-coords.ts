/**
 * One-off repair: attach OSM coordinates to itinerary restaurants (and any
 * activity blocks missing them) for trips generated before grounding, or
 * where the grounding pass fell back. Run with:
 *
 *   npx tsx scripts/backfill-restaurant-coords.ts
 *
 * Matching, per day:
 *   1. Restaurant name matched (normalized) against real eateries from one
 *      Overpass union query around the day's activity anchors.
 *   2. Otherwise the name is geocoded with the destination appended, and
 *      accepted only within 40km of the destination centroid — a wrong-city
 *      namesake stays unpinned rather than lying on the map.
 * Respects the shared Nominatim queue (1 req/s) and the GeoCache table.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { type GeoPoint, geocode, haversineM, nearbyEateries } from '../src/lib/geo.js';
import type { ActivitySlot, Itinerary } from '../src/lib/itinerary.js';

const SLOTS: readonly ActivitySlot[] = ['morning', 'afternoon', 'evening'];
const MAX_KM_FROM_DESTINATION = 40;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(): Promise<void> {
  const trips = await prisma.trip.findMany({
    where: { status: { in: ['complete', 'active'] } },
    orderBy: { createdAt: 'asc' },
  });

  let totalFixed = 0;
  for (const trip of trips) {
    const itinerary = trip.itinerary as Itinerary | null;
    if (!itinerary?.days?.length) continue;

    const missingRestaurants = itinerary.days.reduce(
      (n, d) => n + d.restaurants.filter((r) => typeof r.lat !== 'number').length,
      0,
    );
    const missingActivities = itinerary.days.reduce(
      (n, d) => n + SLOTS.filter((s) => typeof d[s].lat !== 'number').length,
      0,
    );
    if (missingRestaurants === 0 && missingActivities === 0) continue;

    console.log(
      `\n${trip.destination} (${trip.id}) — missing: ${missingActivities} activity, ${missingRestaurants} restaurant coords`,
    );

    // 1. Repair activity coordinates (cache-first).
    for (const day of itinerary.days) {
      for (const slot of SLOTS) {
        const block = day[slot];
        if (typeof block.lat === 'number') continue;
        const point = await geocode(`${block.location}, ${itinerary.destination}`);
        block.lat = point?.lat ?? null;
        block.lon = point?.lon ?? null;
      }
    }

    // 2. Real eateries near all anchors, one Overpass query per trip.
    const anchors: GeoPoint[] = itinerary.days.flatMap((day) =>
      SLOTS.flatMap((slot) => {
        const b = day[slot];
        return typeof b.lat === 'number' && typeof b.lon === 'number'
          ? [{ lat: b.lat, lon: b.lon }]
          : [];
      }),
    );
    const eateryByName = new Map<string, GeoPoint>();
    if (anchors.length > 0) {
      try {
        for (const eatery of await nearbyEateries(anchors, 2000)) {
          eateryByName.set(norm(eatery.name), { lat: eatery.lat, lon: eatery.lon });
        }
        await sleep(1000); // be polite to Overpass between trips
      } catch (error) {
        console.warn(`  overpass failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    const centroid = await geocode(itinerary.destination);

    // 3. Match or geocode each unpinned restaurant.
    let fixed = 0;
    let unresolved = 0;
    for (const day of itinerary.days) {
      for (const restaurant of day.restaurants) {
        if (typeof restaurant.lat === 'number') continue;
        let point = eateryByName.get(norm(restaurant.name)) ?? null;
        if (!point) {
          const candidate = await geocode(`${restaurant.name}, ${itinerary.destination}`);
          if (
            candidate &&
            centroid &&
            haversineM(candidate, centroid) <= MAX_KM_FROM_DESTINATION * 1000
          ) {
            point = candidate;
          }
        }
        if (point) {
          restaurant.lat = point.lat;
          restaurant.lon = point.lon;
          fixed += 1;
        } else {
          unresolved += 1;
        }
      }
    }

    await prisma.trip.update({
      where: { id: trip.id },
      data: { itinerary: itinerary as unknown as Prisma.InputJsonValue },
    });
    totalFixed += fixed;
    console.log(`  pinned ${fixed} restaurants; ${unresolved} not resolvable (likely not real OSM places)`);
  }

  console.log(`\ndone — ${totalFixed} restaurant pins recovered across ${trips.length} trips`);
  await prisma.$disconnect();
}

void run();
