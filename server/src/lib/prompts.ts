import type {
  ActivitySlot,
  Itinerary,
  ItineraryDay,
  RestaurantRec,
  TripPreferences,
} from './itinerary.js';

const TONE = `You are the trip designer behind Roam, a calm, editorial travel planning
service. You write like a well-traveled friend: specific, warm, unhurried, never
salesy. You recommend real, currently-operating places by their real names, with
realistic prices in USD.`;

function describePreferences(preferences: TripPreferences): string {
  const lines = [
    `Trip length: ${preferences.duration} days`,
    `Budget tier: ${preferences.budgetTier} (roughly $${preferences.budgetEstimate} total for the whole trip, excluding flights)`,
    `Traveling: ${preferences.companions}`,
    `Trip vibe: ${preferences.vibe.join(', ')}`,
  ];
  if (preferences.foodPreferences.length > 0) {
    lines.push(`Food preferences: ${preferences.foodPreferences.join(', ')}`);
  }
  if (preferences.customInterests.length > 0) {
    lines.push(`Personal interests: ${preferences.customInterests.join(', ')}`);
  }
  return lines.join('\n');
}

/* ------------------------------- itinerary ------------------------------- */

export function itinerarySystemPrompt(days: number): string {
  return `${TONE}

Respond with ONLY a single JSON object — no markdown, no commentary — matching exactly this schema:

{
  "destination": "string — city, country",
  "tripSummary": "string — 2-3 sentences capturing the shape and feel of the trip",
  "estimatedTotalBudget": "string — e.g. \\"$1,450 for two people\\"",
  "days": [
    {
      "dayNumber": 1,
      "theme": "string — a short editorial title for the day",
      "morning":   { "activity": "string", "description": "string", "why": "string", "estimatedCost": "string", "location": "string — neighborhood or address" },
      "afternoon": { "activity": "string", "description": "string", "why": "string", "estimatedCost": "string", "location": "string" },
      "evening":   { "activity": "string", "description": "string", "why": "string", "estimatedCost": "string", "location": "string" },
      "restaurants": [{ "name": "string", "cuisine": "string", "priceRange": "string — e.g. \\"$$ · ~$25/person\\"", "mealType": "string — breakfast/lunch/dinner", "why": "string" }],
      "transport": "string — how to get around this day",
      "dailyBudgetEstimate": "string — e.g. \\"$140\\"",
      "tip": "string — one insider note for the day"
    }
  ],
  "packingList": ["string"],
  "practicalTips": ["string"]
}

Hard requirements:
- "days" must contain exactly ${days} entries, with dayNumber running 1 to ${days}.
- Every "why" field is the heart of the product: it must explain why THIS choice fits THIS traveler — connect it explicitly to their stated vibe, budget tier, companions, food preferences, or interests. Never just describe the place.
- 2-3 restaurants per day, matched to the stated food preferences.
- "estimatedCost" strings like "$18", "Free", or "$40 for two" — consistent with the budget tier.
- Descriptions are 2-3 sentences. Real place names only; if unsure a place still operates, choose a safer well-known alternative.
- Pace the days realistically: cluster activities by neighborhood, don't zig-zag across the city.
- NEVER repeat yourself across the trip: every activity (morning/afternoon/evening) and every restaurant must appear exactly once in the whole itinerary. Before finishing, re-read all ${days} days and replace any repeated activity or restaurant with a different real one.`;
}

export function itineraryUserPrompt(
  destination: string,
  preferences: TripPreferences,
): string {
  return `Design a complete ${preferences.duration}-day itinerary for ${destination}.

Traveler profile:
${describePreferences(preferences)}

Return the JSON object only.`;
}

export function retryNote(errors: string[]): string {
  return `

Your previous response failed validation with these problems:
- ${errors.slice(0, 12).join('\n- ')}

Return the corrected, complete JSON object only.`;
}

/* ------------------------------ destinations ----------------------------- */

export function destinationsSystemPrompt(): string {
  return `${TONE}

The traveler has not chosen a destination. Respond with ONLY a JSON object:

{
  "options": [
    { "name": "string — city", "country": "string", "rationale": "string — 2 sentences on why this fits this traveler specifically" }
  ]
}

Hard requirements:
- Exactly 4 options, varied in region and character.
- Each rationale must reference the traveler's stated vibe, budget tier, companions, or interests — not generic praise of the destination.
- Favor destinations that are realistic for the stated budget tier and trip length (consider travel time).
- If the request lists destinations the traveler has already seen, do NOT suggest any of them again — return four genuinely different places, not near-identical neighbors of the rejected ones.`;
}

export function destinationsUserPrompt(
  preferences: TripPreferences,
  exclude: string[] = [],
): string {
  const exclusionNote =
    exclude.length > 0
      ? `\n\nThe traveler has already seen these destinations and passed on them — do not suggest any of them again:\n${exclude.join(', ')}`
      : '';
  return `Suggest destinations for this traveler:

${describePreferences(preferences)}${exclusionNote}

Return the JSON object only.`;
}

/* ------------------------------ regeneration ----------------------------- */

function dayContext(day: ItineraryDay): string {
  return `Theme: "${day.theme}"
Morning: ${day.morning.activity} (${day.morning.location})
Afternoon: ${day.afternoon.activity} (${day.afternoon.location})
Evening: ${day.evening.activity} (${day.evening.location})
Restaurants: ${day.restaurants.map((r) => r.name).join(', ')}`;
}

export function regenerateActivitySystemPrompt(): string {
  return `${TONE}

Respond with ONLY a single JSON object — one replacement activity — matching exactly:

{ "activity": "string", "description": "string", "why": "string", "estimatedCost": "string", "location": "string" }

Hard requirements:
- Must be a genuinely different activity from the current one and from everything else already planned that day.
- Must suit the same time of day, the day's theme, and the traveler's budget tier — keep the cost in the same band.
- The "why" must connect the choice to the traveler's stated preferences.`;
}

export function regenerateActivityUserPrompt(
  itinerary: Itinerary,
  preferences: TripPreferences,
  dayNumber: number,
  slot: ActivitySlot,
): string {
  const day = itinerary.days[dayNumber - 1];
  const current = day[slot];
  return `Trip: ${itinerary.destination} — ${itinerary.tripSummary}

Traveler profile:
${describePreferences(preferences)}

Day ${dayNumber} currently looks like:
${dayContext(day)}

Replace ONLY the ${slot} activity. The traveler wasn't feeling this one:
"${current.activity}" — ${current.description}

Return the JSON object only.`;
}

export function regenerateRestaurantSystemPrompt(): string {
  return `${TONE}

Respond with ONLY a single JSON object — one replacement restaurant — matching exactly:

{ "name": "string", "cuisine": "string", "priceRange": "string", "mealType": "string", "why": "string" }

Hard requirements:
- A real, currently-operating restaurant, different from the current one and the others already planned that day.
- Same meal type and a similar price range as the one being replaced.
- The "why" must connect the choice to the traveler's stated food preferences and budget.`;
}

export function regenerateRestaurantUserPrompt(
  itinerary: Itinerary,
  preferences: TripPreferences,
  dayNumber: number,
  current: RestaurantRec,
): string {
  const day = itinerary.days[dayNumber - 1];
  return `Trip: ${itinerary.destination} — ${itinerary.tripSummary}

Traveler profile:
${describePreferences(preferences)}

Day ${dayNumber} currently looks like:
${dayContext(day)}

Replace ONLY this restaurant (${current.mealType}): "${current.name}" (${current.cuisine}, ${current.priceRange}).

Return the JSON object only.`;
}
