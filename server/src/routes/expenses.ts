import { Router, type Request, type Response } from 'express';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

const CATEGORIES = Object.values(ExpenseCategory);

interface ExpenseInput {
  category: ExpenseCategory;
  label: string;
  amount: number;
  currency: string;
  date: Date;
  notes: string | null;
}

function parseExpenseBody(body: unknown): { ok: true; value: ExpenseInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  if (typeof b.category !== 'string' || !CATEGORIES.includes(b.category as ExpenseCategory)) {
    errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (typeof b.label !== 'string' || b.label.trim().length === 0 || b.label.length > 120) {
    errors.push('label is required (up to 120 characters)');
  }
  const amount = typeof b.amount === 'string' ? Number(b.amount) : b.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount >= 1e9) {
    errors.push('amount must be a positive number');
  }
  if (typeof b.currency !== 'string' || !/^[A-Za-z]{3}$/.test(b.currency)) {
    errors.push('currency must be a 3-letter code');
  }
  const date = typeof b.date === 'string' || b.date instanceof Date ? new Date(b.date as string) : null;
  if (!date || Number.isNaN(date.getTime())) {
    errors.push('date must be a valid date');
  }
  if (b.notes !== undefined && b.notes !== null && typeof b.notes !== 'string') {
    errors.push('notes must be a string');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      category: b.category as ExpenseCategory,
      label: (b.label as string).trim(),
      amount: Math.round((amount as number) * 100) / 100,
      currency: (b.currency as string).toUpperCase(),
      date: date as Date,
      notes: typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null,
    },
  };
}

/** Every route below is scoped to a trip the signed-in user owns. */
async function ownedTrip(req: Request): Promise<{ id: string } | null> {
  const { tripId } = req.params as { tripId: string };
  return prisma.trip.findFirst({
    where: { id: tripId, userId: req.user!.id },
    select: { id: true },
  });
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await ownedTrip(req);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    const expenses = await prisma.tripExpense.findMany({
      where: { tripId: trip.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ expenses });
  }),
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await ownedTrip(req);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    const parsed = parseExpenseBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: 'Invalid expense', details: parsed.errors });
      return;
    }
    const expense = await prisma.tripExpense.create({
      data: {
        tripId: trip.id,
        ...parsed.value,
        amount: new Prisma.Decimal(parsed.value.amount),
      },
    });
    res.status(201).json({ expense });
  }),
);

router.put(
  '/:expenseId',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await ownedTrip(req);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    const parsed = parseExpenseBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: 'Invalid expense', details: parsed.errors });
      return;
    }
    const { expenseId } = req.params as { expenseId: string };
    const existing = await prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId: trip.id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const expense = await prisma.tripExpense.update({
      where: { id: existing.id },
      data: { ...parsed.value, amount: new Prisma.Decimal(parsed.value.amount) },
    });
    res.json({ expense });
  }),
);

router.delete(
  '/:expenseId',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await ownedTrip(req);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    const { expenseId } = req.params as { expenseId: string };
    const existing = await prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId: trip.id },
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

export default router;
