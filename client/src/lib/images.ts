/**
 * Curated Unsplash photography, keyed by destination and mood.
 * Every consumer should render these through <TravelImage>, which falls back
 * to a known-good pool if a specific photo ever disappears.
 */

// Unsplash's CDN now 404s hotlinks without the ixlib parameter — keep it.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?ixlib=rb-4.0.3&auto=format&fit=crop&w=${w}&q=80`;

/** Reliable classics — the safety net for unknown destinations & onError. */
export const FALLBACK_POOL: string[] = [
  u('1469474968028-56623f02e42e'), // sunlit mountain valley
  u('1500530855697-b586d89ba3ee'), // lone road into mist
  u('1476514525535-07fb3b4ae5f1'), // boats on a teal lake
  u('1503220317375-aaad61436b1b'), // traveler above the clouds
  u('1467269204594-9661b134dd2b'), // European street corner
  u('1488646953014-85cb44e25828'), // maps and a camera
  u('1507525428034-b723cf961d3e'), // quiet beach
  u('1519681393784-d120267933ba'), // tents under the stars
];

const DESTINATIONS: Array<{ match: RegExp; images: string[] }> = [
  { match: /lisbon|portugal/i, images: [u('1555881400-74d7acaacd8b'), u('1467269204594-9661b134dd2b')] },
  { match: /porto/i, images: [u('1555881400-74d7acaacd8b')] },
  { match: /paris|france/i, images: [u('1502602898657-3e91760cbb34')] },
  { match: /tokyo/i, images: [u('1540959733332-eab4deabeeaf')] },
  { match: /kyoto|japan/i, images: [u('1493976040374-85c8e12f0c0e')] },
  { match: /rome|italy/i, images: [u('1552832230-c0197dd311b5')] },
  { match: /venice/i, images: [u('1523906834658-6e24ef2386f9')] },
  { match: /santorini|greece/i, images: [u('1533105079780-92b9be482077')] },
  { match: /bali|indonesia/i, images: [u('1537996194471-e657df975ab4')] },
  { match: /barcelona|spain/i, images: [u('1539037116277-4db20889f2d4')] },
  { match: /amsterdam|netherlands/i, images: [u('1534351590666-13e3e96b5017')] },
  { match: /london|england|uk/i, images: [u('1513635269975-59663e0ac1ad')] },
  { match: /new york|nyc/i, images: [u('1496442226666-8d4d0e62e6e9')] },
  { match: /iceland|reykjavik/i, images: [u('1476610182048-b716b8518aae')] },
  { match: /peru|machu|cusco/i, images: [u('1526392060635-9d6019884377')] },
  { match: /thailand|bangkok|phuket/i, images: [u('1528181304800-259b08848526')] },
  { match: /vietnam|hoi an|hanoi/i, images: [u('1528127269322-539801943592')] },
  { match: /india|agra|jaipur/i, images: [u('1564507592333-c60657eea523')] },
  { match: /turkey|istanbul|cappadocia/i, images: [u('1524231757912-21f4fe3a7200')] },
  { match: /sydney|australia/i, images: [u('1506973035872-a4ec16b8e8d9')] },
  { match: /mexico|oaxaca/i, images: [u('1518105779142-d975f22f1b0a')] },
  { match: /slovenia|ljubljana/i, images: [u('1476514525535-07fb3b4ae5f1')] },
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function fallbackFor(seed: string): string {
  return FALLBACK_POOL[hash(seed) % FALLBACK_POOL.length];
}

/** Best-guess hero photo for a destination string like "Lisbon, Portugal". */
export function destinationImage(name: string, variant = 0): string {
  const entry = DESTINATIONS.find((d) => d.match.test(name));
  if (entry) {
    return entry.images[variant % entry.images.length];
  }
  return fallbackFor(name + variant);
}

/** One image per trip vibe, used on the onboarding tiles. */
export const VIBE_IMAGES: Record<string, string> = {
  relaxation: u('1507525428034-b723cf961d3e', 900),
  adventure: u('1464822759023-fed622ff2c3b', 900),
  culture: u('1493976040374-85c8e12f0c0e', 900),
  romance: u('1502602898657-3e91760cbb34', 900),
  food: u('1504674900247-0877df9cc836', 900),
  family: u('1476514525535-07fb3b4ae5f1', 900),
  'solo-reset': u('1470770841072-f978cf4d019e', 900),
};

/** Landing & auth page photography. */
export const SCENES = {
  landingHero: u('1469474968028-56623f02e42e', 1800),
  landingDetail: u('1488646953014-85cb44e25828', 800),
  loginPanel: u('1467269204594-9661b134dd2b', 1400),
  signupPanel: u('1503220317375-aaad61436b1b', 1400),
  emptyShelf: u('1500530855697-b586d89ba3ee', 1000),
  crafting: u('1476514525535-07fb3b4ae5f1', 1400),
  surprise: u('1500530855697-b586d89ba3ee', 900),
  known: u('1502602898657-3e91760cbb34', 900),
};
