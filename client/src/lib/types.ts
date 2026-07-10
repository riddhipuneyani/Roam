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
  /** Currency of budgetEstimate and generated prices; older trips (USD era) may lack it. */
  currency?: string;
  destinationKnown: boolean;
  destination: string | null;
  vibe: TripVibe[];
  companions: Companions;
  foodPreferences: string[];
  customInterests: string[];
}

export type TripStatus = 'draft' | 'complete' | 'active';

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
  status: TripStatus;
  preferences: TripPreferences;
  itinerary: Itinerary | null;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'accommodation'
  | 'food'
  | 'activity'
  | 'transport'
  | 'shopping'
  | 'other';

export interface TripExpense {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  label: string;
  /** Prisma Decimal serializes as a string. */
  amount: string;
  currency: string;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface BudgetCategoryBreakdown {
  category: ExpenseCategory;
  actual: number;
  count: number;
}

export interface BudgetSummary {
  displayCurrency: string;
  /** The currency the trip's own numbers are denominated in (INR default, USD for older trips). */
  sourceCurrency: string;
  rateDate: string;
  budgetTier: BudgetTier | null;
  plannedBudget: number | null;
  estimatedTotal: number | null;
  actualTotal: number;
  remaining: number | null;
  expenseCount: number;
  byCategory: BudgetCategoryBreakdown[];
}

export interface ExpenseInput {
  category: ExpenseCategory;
  label: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
}

export interface TripSummary {
  id: string;
  title: string;
  destination: string;
  status: TripStatus;
  preferences: TripPreferences;
  createdAt: string;
  updatedAt: string;
}
