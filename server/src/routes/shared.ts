import { Router, type NextFunction, type Request, type Response } from 'express';
import { Prisma, type Trip, type TripExpense } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { CurrencyError } from '../lib/currency.js';
import { buildBudgetSummary } from '../lib/budget.js';
import { parseExpenseBody } from './expenses.js';

/**
 * Public shared-link API. NO user authentication anywhere here — a valid
 * shareToken is the sole authorization, and everything is scoped to the
 * single trip that token belongs to. Revoking the token (owner action)
 * immediately 404s every route below.
 */

const router = Router({ mergeParams: true });

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

interface SharedLocals {
  sharedTrip: Trip & { expenses: TripExpense[] };
}

router.use(
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { shareToken } = req.params as { shareToken: string };
    if (!TOKEN_SHAPE.test(shareToken)) {
      res.status(404).json({ error: 'This link is no longer active' });
      return;
    }
    const trip = await prisma.trip.findUnique({
      where: { shareToken },
      include: { expenses: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] } },
    });
    if (!trip) {
      res.status(404).json({ error: 'This link is no longer active' });
      return;
    }
    (res.locals as SharedLocals).sharedTrip = trip;
    next();
  }),
);

const tripOf = (res: Response) => (res.locals as SharedLocals).sharedTrip;

/** Read-only trip view: only what the shared page needs, nothing about the
 *  owner's account or other trips, and not the trip's internal id. */
router.get('/', (_req: Request, res: Response) => {
  const trip = tripOf(res);
  const prefs = trip.preferences as Record<string, unknown>;
  res.json({
    trip: {
      title: trip.title,
      destination: trip.destination,
      status: trip.status,
      itinerary: trip.itinerary,
      preferences: {
        duration: prefs.duration ?? null,
        budgetTier: prefs.budgetTier ?? null,
        companions: prefs.companions ?? null,
        currency: prefs.currency ?? null,
      },
    },
  });
});

/* ------------------------------ shared ledger ------------------------------ */

router.get('/expenses', (_req: Request, res: Response) => {
  res.json({ expenses: tripOf(res).expenses });
});

router.post(
  '/expenses',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = parseExpenseBody(req.body, { requireAddedBy: true });
    if (!parsed.ok) {
      res.status(400).json({ error: 'Invalid expense', details: parsed.errors });
      return;
    }
    const expense = await prisma.tripExpense.create({
      data: {
        tripId: tripOf(res).id,
        ...parsed.value,
        addedByName: parsed.value.addedByName!,
        amount: new Prisma.Decimal(parsed.value.amount),
      },
    });
    res.status(201).json({ expense });
  }),
);

router.put(
  '/expenses/:expenseId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = parseExpenseBody(req.body, { requireAddedBy: true });
    if (!parsed.ok) {
      res.status(400).json({ error: 'Invalid expense', details: parsed.errors });
      return;
    }
    const { expenseId } = req.params as { expenseId: string };
    const existing = await prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId: tripOf(res).id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const expense = await prisma.tripExpense.update({
      where: { id: existing.id },
      data: {
        ...parsed.value,
        addedByName: parsed.value.addedByName!,
        amount: new Prisma.Decimal(parsed.value.amount),
      },
    });
    res.json({ expense });
  }),
);

router.delete(
  '/expenses/:expenseId',
  asyncHandler(async (req: Request, res: Response) => {
    const { expenseId } = req.params as { expenseId: string };
    const existing = await prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId: tripOf(res).id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    await prisma.tripExpense.delete({ where: { id: existing.id } });
    res.json({ message: 'Expense deleted' });
  }),
);

/* --------------------------- live budget summary --------------------------- */

router.get(
  '/budget',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      res.json(await buildBudgetSummary(tripOf(res), String(req.query.currency ?? 'INR')));
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
