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

/**
 * The itinerary prompt asks for USD prices ("$18", "$40 for two", "Free"),
 * so AI estimates are treated as USD and converted from there.
 */
const ITINERARY_CURRENCY = 'USD';

function parseCost(value: string): number | null {
  const match = value.replace(/,/g, '').match(/\$\s?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/** Sum the AI's own per-day estimates; fall back to its trip total. */
function estimateItineraryTotalUsd(itinerary: Itinerary | null): number | null {
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

    const display = String(req.query.currency ?? ITINERARY_CURRENCY).toUpperCase();
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

      // Planned budget comes from the onboarding budget tier (USD).
      const prefs = trip.preferences as { budgetEstimate?: unknown; budgetTier?: unknown };
      const plannedUsd =
        typeof prefs.budgetEstimate === 'number' && prefs.budgetEstimate > 0
          ? prefs.budgetEstimate
          : null;

      const estimatedUsd = estimateItineraryTotalUsd(trip.itinerary as Itinerary | null);

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

      const plannedBudget = plannedUsd !== null ? toDisplay(plannedUsd, ITINERARY_CURRENCY) : null;
      const estimatedTotal =
        estimatedUsd !== null ? toDisplay(estimatedUsd, ITINERARY_CURRENCY) : null;

      res.json({
        displayCurrency: display,
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
