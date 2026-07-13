import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { CurrencyError } from '../lib/currency.js';
import { buildBudgetSummary } from '../lib/budget.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

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

    try {
      res.json(await buildBudgetSummary(trip, String(req.query.currency ?? 'INR')));
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
