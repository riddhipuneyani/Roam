import type {
  ActivityBlock,
  ActivitySlot,
  DestinationOption,
  Itinerary,
  ItineraryDay,
  RestaurantRec,
  TripPreferences,
} from './itinerary.js';

/**
 * Dev-only fallback used when GEMINI_API_KEY is empty, so the whole product
 * flow can be exercised without a key. The server logs loudly whenever this
 * is used. The data below is a real, realistic Lisbon itinerary bank; for
 * other destinations the place names stay honest about being samples.
 */

const COST_FACTOR: Record<TripPreferences['budgetTier'], number> = {
  budget: 0.7,
  comfortable: 1,
  luxury: 1.9,
};

function cost(base: number, preferences: TripPreferences): string {
  if (base === 0) return 'Free';
  return `$${Math.round(base * COST_FACTOR[preferences.budgetTier])}`;
}

interface SampleDayBank {
  theme: string;
  morning: [string, string, string, number];
  afternoon: [string, string, string, number];
  evening: [string, string, string, number];
  restaurants: Array<[string, string, string, string]>;
  transport: string;
  tip: string;
}

const LISBON_BANK: SampleDayBank[] = [
  {
    theme: 'Arrival & the old hillside',
    morning: ['Wander the Alfama lanes', 'Lose the map in Lisbon’s oldest district — laundry lines, azulejo facades, and miradouros around every third corner. Start at Miradouro de Santa Luzia.', 'Alfama', 0],
    afternoon: ['São Jorge Castle', 'Moorish ramparts with the best panorama of the terracotta rooftops and the Tagus. Go after 15:00 when the tour groups thin out.', 'Castelo', 15],
    evening: ['Fado at a small casa', 'Live fado in a candlelit room — the melancholic soundtrack this city invented. A Tasca do Chico is the unfussy classic.', 'Bairro Alto', 25],
    restaurants: [
      ['Ta-Daí', 'Modern Portuguese', '$$ · ~$20/person', 'lunch'],
      ['A Tasca do Chico', 'Petiscos', '$ · ~$15/person', 'dinner'],
    ],
    transport: 'On foot plus tram 28 for the steep stretches — buy a 24h Carris pass (~$7).',
    tip: 'Wear real shoes: Alfama’s calçada cobbles are beautiful and treacherously slick.',
  },
  {
    theme: 'Belém & the golden age',
    morning: ['Jerónimos Monastery', 'Manueline architecture at its most extravagant — the cloisters are the part worth the queue. Arrive at opening (09:30).', 'Belém', 12],
    afternoon: ['MAAT & the riverside walk', 'The undulating white museum roof doubles as a viewpoint; stroll the Tagus promenade to the Belém Tower afterwards.', 'Belém', 10],
    evening: ['Sunset at Ponto Final', 'Take the ferry to Cacilhas and walk the river path to the yellow tables at the water’s edge — the classic view back at the city.', 'Almada', 5],
    restaurants: [
      ['Pastéis de Belém', 'Pastelaria', '$ · ~$6/person', 'breakfast'],
      ['Ponto Final', 'Portuguese', '$$ · ~$30/person', 'dinner'],
    ],
    transport: 'Tram 15E to Belém; ferry from Cais do Sodré to Cacilhas in the evening.',
    tip: 'At Pastéis de Belém, skip the takeaway line — table service inside is faster and the tarts arrive warm.',
  },
  {
    theme: 'Markets, hills & hidden viewpoints',
    morning: ['Feira da Ladra flea market', 'Lisbon’s centuries-old thieves’ market: azulejo fragments, vinyl, old postcards. Haggle gently.', 'Campo de Santa Clara', 0],
    afternoon: ['LX Factory', 'A former industrial complex under the bridge, now the city’s best cluster of studios, bookshops (Ler Devagar) and cafés.', 'Alcântara', 8],
    evening: ['Miradouro da Senhora do Monte', 'The highest viewpoint in the city for golden hour — locals bring a bottle and watch the light go pink over the castle.', 'Graça', 0],
    restaurants: [
      ['Time Out Market', 'Market hall', '$$ · ~$18/person', 'lunch'],
      ['Cervejaria Ramiro', 'Seafood', '$$$ · ~$45/person', 'dinner'],
    ],
    transport: 'Metro green line plus one scenic ride on the Glória funicular.',
    tip: 'At Ramiro, order the garlic prawns and finish with a prego steak sandwich — the local way.',
  },
  {
    theme: 'A day in Sintra',
    morning: ['Pena Palace', 'The technicolor Romanticist palace in the Sintra hills — book the first timed slot (09:30) online to beat the crowds.', 'Sintra', 20],
    afternoon: ['Quinta da Regaleira', 'Gothic gardens riddled with tunnels and the famous initiation well — the most atmospheric hour in Portugal.', 'Sintra', 15],
    evening: ['Return & Pink Street aperitivo', 'Back in Lisbon, an easy evening around Cais do Sodré’s pink-painted strip.', 'Cais do Sodré', 12],
    restaurants: [
      ['Piriquita', 'Pastelaria', '$ · ~$5/person', 'breakfast'],
      ['Taberna da Rua das Flores', 'Petiscos', '$$ · ~$28/person', 'dinner'],
    ],
    transport: 'Direct train from Rossio to Sintra (~40 min, ~$5 return); bus 434 loops the palaces.',
    tip: 'Buy Sintra train tickets the night before — the morning queue at Rossio eats your palace slot.',
  },
  {
    theme: 'Art, gardens & a slow goodbye',
    morning: ['Calouste Gulbenkian Museum', 'One of Europe’s great private collections — Lalique jewellery to Rembrandt — in a brutalist garden pavilion.', 'Avenidas Novas', 12],
    afternoon: ['Estrela & the basilica gardens', 'A quiet, local afternoon: the Estrela basilica dome, then reading under the banyans in the Jardim da Estrela.', 'Estrela', 0],
    evening: ['Last-night petiscos crawl', 'Graze through Bairro Alto’s tascas: cured cheese, tinned fish done properly, vinho verde by the glass.', 'Bairro Alto', 30],
    restaurants: [
      ['Manteigaria', 'Pastelaria', '$ · ~$4/person', 'breakfast'],
      ['Sol e Pesca', 'Tinned seafood', '$$ · ~$20/person', 'dinner'],
    ],
    transport: 'Metro plus tram 25 to Estrela.',
    tip: 'Manteigaria vs Pastéis de Belém is Lisbon’s great debate — settle it yourself with one of each.',
  },
];

function whyFor(preferences: TripPreferences, angle: string): string {
  const vibe = preferences.vibe[0] ?? 'the trip';
  return `${angle} It fits the ${vibe} pace you asked for and sits comfortably inside a ${preferences.budgetTier} budget${
    preferences.companions !== 'solo' ? `, and it works well when traveling with ${preferences.companions}` : ''
  }.`;
}

function toBlock(
  [activity, description, location, baseCost]: [string, string, string, number],
  preferences: TripPreferences,
  angle: string,
): ActivityBlock {
  return {
    activity,
    description,
    why: whyFor(preferences, angle),
    estimatedCost: cost(baseCost, preferences),
    location,
  };
}

function toRestaurant(
  [name, cuisine, priceRange, mealType]: [string, string, string, string],
  preferences: TripPreferences,
): RestaurantRec {
  const food = preferences.foodPreferences[0];
  return {
    name,
    cuisine,
    priceRange,
    mealType,
    why: `A local standby rather than a tourist trap${
      food ? `, and a natural fit for your taste for ${food.toLowerCase()}` : ''
    } — portions and prices match a ${preferences.budgetTier} budget.`,
  };
}

export function sampleItinerary(
  destination: string,
  preferences: TripPreferences,
): Itinerary {
  const isLisbon = destination.toLowerCase().includes('lisbon');
  const label = isLisbon ? destination : `${destination} (sample data)`;

  const days: ItineraryDay[] = Array.from({ length: preferences.duration }, (_, i) => {
    const bank = LISBON_BANK[i % LISBON_BANK.length];
    const angles = [
      'A gentle first look at the city.',
      'The one unmissable set piece, timed to avoid the crowds.',
      'A slower stretch to balance the pace.',
    ];
    return {
      dayNumber: i + 1,
      theme: bank.theme,
      morning: toBlock(bank.morning, preferences, angles[0]),
      afternoon: toBlock(bank.afternoon, preferences, angles[1]),
      evening: toBlock(bank.evening, preferences, angles[2]),
      restaurants: bank.restaurants.map((r) => toRestaurant(r, preferences)),
      transport: bank.transport,
      dailyBudgetEstimate: cost(110, preferences),
      tip: bank.tip,
    };
  });

  const total = Math.round(
    110 * COST_FACTOR[preferences.budgetTier] * preferences.duration,
  );

  return {
    destination: isLisbon ? 'Lisbon, Portugal' : label,
    tripSummary: `${preferences.duration} unhurried days built around ${preferences.vibe.join(
      ' and ',
    )}, pacing big set pieces with slow neighborhood time, at a ${preferences.budgetTier} budget.`,
    estimatedTotalBudget: `~$${total.toLocaleString()} excluding flights`,
    days,
    packingList: [
      'Comfortable walking shoes with grip (cobblestones)',
      'A light layer for evening river wind',
      'Sunscreen and sunglasses',
      'A tote for market finds',
      'Power adapter (type F, 230V)',
    ],
    practicalTips: [
      'Buy a rechargeable Viva Viagem card for all trams, metro and ferries.',
      'Lunch menus (prato do dia) are the budget-friendly way to eat very well.',
      'Most museums close Mondays — plan the Sintra day accordingly.',
      'Tipping: round up or ~5-10% at dinner; it is appreciated, not expected.',
    ],
  };
}

export function sampleDestinations(preferences: TripPreferences): DestinationOption[] {
  const why = (fit: string) =>
    `${fit} A strong match for ${preferences.vibe.join(' + ')} at a ${preferences.budgetTier} budget over ${preferences.duration} days.`;
  return [
    { name: 'Lisbon', country: 'Portugal', rationale: why('Hills, tiled facades, and Europe’s best-value food scene.') },
    { name: 'Kyoto', country: 'Japan', rationale: why('Temples, tea houses and gardens built for slow mornings.') },
    { name: 'Oaxaca', country: 'Mexico', rationale: why('Markets, mezcal and the most celebrated food culture in the Americas.') },
    { name: 'Ljubljana', country: 'Slovenia', rationale: why('A calm riverside capital with alps and caves within an hour.') },
  ];
}

export function sampleActivity(
  slot: ActivitySlot,
  preferences: TripPreferences,
): ActivityBlock {
  const options: Record<ActivitySlot, [string, string, string, number]> = {
    morning: ['Mercado de Campo de Ourique', 'A neighborhood food market locals actually use — coffee first, then graze the stalls.', 'Campo de Ourique', 6],
    afternoon: ['Museu Nacional do Azulejo', 'Five centuries of Portuguese tilework inside a former convent, ending with a 23-meter panorama of pre-earthquake Lisbon.', 'Xabregas', 9],
    evening: ['River sunset sail', 'A two-hour small-group sail on the Tagus past Belém as the light goes gold.', 'Doca de Santo Amaro', 35],
  };
  return toBlock(options[slot], preferences, 'A fresh alternative with the same energy.');
}

export function sampleRestaurant(preferences: TripPreferences, mealType: string): RestaurantRec {
  return toRestaurant(['O Velho Eurés', 'Traditional Portuguese', '$$ · ~$22/person', mealType], preferences);
}
