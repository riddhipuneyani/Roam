import { ExpenseCategory, type Trip, type TripExpense } from '@prisma/client';
import { convertAmount, getRates, isSupported, round2, CurrencyError } from './currency.js';
import type { Itinerary } from './itinerary.js';

/**
 * Budget summary computation, shared by the authenticated dashboard and the
 * public shared-link view — one ledger, one set of numbers.
 */

function parseCost(value: string): number | null {
  const match = value.replace(/,/g, '').match(/[$₹]\s?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/**
 * Which currency the trip's own numbers (budgetEstimate, AI costs) are in.
 * New trips record it in preferences; older trips are detected from the
 * itinerary's cost strings ($ era vs ₹ era), falling back to INR.
 */
function tripSourceCurrency(
  preferences: { currency?: unknown },
  itinerary: Itinerary | null,
): string {
  if (typeof preferences.currency === 'string' && /^[A-Za-z]{3}$/.test(preferences.currency)) {
    return preferences.currency.toUpperCase();
  }
  if (itinerary) {
    const sample = [
      itinerary.estimatedTotalBudget,
      itinerary.days[0]?.dailyBudgetEstimate ?? '',
      itinerary.days[0]?.morning.estimatedCost ?? '',
    ].join(' ');
    if (sample.includes('₹')) return 'INR';
    if (sample.includes('$')) return 'USD';
  }
  return 'INR';
}

/** Sum the AI's own per-day estimates; fall back to its trip total. */
function estimateItineraryTotal(itinerary: Itinerary | null): number | null {
  if (!itinerary) return null;
  const dayCosts = itinerary.days
    .map((day) => parseCost(day.dailyBudgetEstimate))
    .filter((cost): cost is number => cost !== null);
  if (dayCosts.length > 0) {
    return dayCosts.reduce((sum, cost) => sum + cost, 0);
  }
  return parseCost(itinerary.estimatedTotalBudget);
}

export interface BudgetSummary {
  displayCurrency: string;
  sourceCurrency: string;
  rateDate: string;
  budgetTier: string | null;
  plannedBudget: number | null;
  estimatedTotal: number | null;
  actualTotal: number;
  remaining: number | null;
  expenseCount: number;
  byCategory: Array<{ category: ExpenseCategory; actual: number; count: number }>;
}

/** Throws CurrencyError (status 400/502) for bad currencies or rate outages. */
export async function buildBudgetSummary(
  trip: Trip & { expenses: TripExpense[] },
  displayCurrency: string,
): Promise<BudgetSummary> {
  const display = displayCurrency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(display)) {
    throw new CurrencyError('currency must be a 3-letter code', 400);
  }

  const { rates, date } = await getRates();
  if (!isSupported(display, rates)) {
    throw new CurrencyError(`Unsupported display currency: ${display}`, 400);
  }

  const toDisplay = (amount: number, from: string) => convertAmount(amount, from, display, rates);

  // Planned budget comes from the onboarding budget tier, denominated in
  // the trip's own currency (INR for new trips, USD for the earlier era).
  const prefs = trip.preferences as {
    budgetEstimate?: unknown;
    budgetTier?: unknown;
    currency?: unknown;
  };
  const itinerary = trip.itinerary as Itinerary | null;
  const sourceCurrency = tripSourceCurrency(prefs, itinerary);
  const plannedSource =
    typeof prefs.budgetEstimate === 'number' && prefs.budgetEstimate > 0
      ? prefs.budgetEstimate
      : null;

  const estimatedSource = estimateItineraryTotal(itinerary);

  const byCategory = Object.values(ExpenseCategory).map((category) => ({
    category,
    actual: 0,
    count: 0,
  }));
  const categoryIndex = new Map(byCategory.map((entry) => [entry.category, entry]));

  let actualTotal = 0;
  for (const expense of trip.expenses) {
    const converted = toDisplay(Number(expense.amount), expense.currency);
    actualTotal += converted;
    const bucket = categoryIndex.get(expense.category)!;
    bucket.actual += converted;
    bucket.count += 1;
  }

  const plannedBudget = plannedSource !== null ? toDisplay(plannedSource, sourceCurrency) : null;
  const estimatedTotal =
    estimatedSource !== null ? toDisplay(estimatedSource, sourceCurrency) : null;

  return {
    displayCurrency: display,
    sourceCurrency,
    rateDate: date,
    budgetTier: typeof prefs.budgetTier === 'string' ? prefs.budgetTier : null,
    plannedBudget: plannedBudget !== null ? round2(plannedBudget) : null,
    estimatedTotal: estimatedTotal !== null ? round2(estimatedTotal) : null,
    actualTotal: round2(actualTotal),
    remaining: plannedBudget !== null ? round2(plannedBudget - actualTotal) : null,
    expenseCount: trip.expenses.length,
    byCategory: byCategory.map((entry) => ({ ...entry, actual: round2(entry.actual) })),
  };
}
