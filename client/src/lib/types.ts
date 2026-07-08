export type BudgetTier = 'budget' | 'comfortable' | 'luxury';
export type Companions = 'solo' | 'partner' | 'friends' | 'family';
export type TripVibe =
  | 'relaxation'
  | 'adventure'
  | 'culture'
  | 'romance'
  | 'food'
  | 'family'
  | 'solo-reset';

export interface TripPreferences {
  duration: number;
  budgetTier: BudgetTier;
  budgetEstimate: number;
  destinationKnown: boolean;
  destination: string | null;
  vibe: TripVibe[];
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

export interface Trip {
  id: string;
  userId: string;
  title: string;
  destination: string;
  status: 'draft' | 'complete';
  preferences: TripPreferences;
  itinerary: Itinerary | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripSummary {
  id: string;
  title: string;
  destination: string;
  status: 'draft' | 'complete';
  preferences: TripPreferences;
  createdAt: string;
  updatedAt: string;
}
