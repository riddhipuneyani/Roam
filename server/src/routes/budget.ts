import { Router, type Request, type Response } from 'express';
import { ExpenseCategory } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import {
  CurrencyError,
  convertAmount,
  getRates,
  isSupported,
  round2,
} from '../lib/currency.js';
import type { Itinerary } from '../lib/itinerary.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

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

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params as { tripId: string };
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.id },
      include: { expenses: true },
    });
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    const display = String(req.query.currency ?? 'INR').toUpperCase();
    if (!/^[A-Z]{3}$/.test(display)) {
      res.status(400).json({ error: 'currency must be a 3-letter code' });
      return;
    }

    try {
      const { rates, date } = await getRates();
      if (!isSupported(display, rates)) {
        res.status(400).json({ error: `Unsupported display currency: ${display}` });
        return;
      }

      const toDisplay = (amount: number, from: string) =>
        convertAmount(amount, from, display, rates);

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

      const plannedBudget =
        plannedSource !== null ? toDisplay(plannedSource, sourceCurrency) : null;
      const estimatedTotal =
        estimatedSource !== null ? toDisplay(estimatedSource, sourceCurrency) : null;

      res.json({
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
      });
    } catch (error) {
      if (error instanceof CurrencyError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);

export default router;
