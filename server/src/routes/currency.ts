import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import {
  CurrencyError,
  convertAmount,
  getCurrencies,
  getRates,
  round2,
} from '../lib/currency.js';

const router = Router();

router.use(requireAuth);

function handleCurrencyError(res: Response, error: unknown): void {
  if (error instanceof CurrencyError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  throw error;
}

/** Supported currencies, for populating pickers. */
router.get(
  '/currencies',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      res.json({ currencies: await getCurrencies() });
    } catch (error) {
      handleCurrencyError(res, error);
    }
  }),
);

/** Cached exchange rates (EUR base) with their reference date. */
router.get(
  '/rates',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const { rates, date } = await getRates();
      res.json({ base: 'EUR', date, rates });
    } catch (error) {
      handleCurrencyError(res, error);
    }
  }),
);

/** One-off conversion: /api/currency/convert?amount=25&from=EUR&to=JPY */
router.get(
  '/convert',
  asyncHandler(async (req: Request, res: Response) => {
    const amount = Number(req.query.amount);
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    if (!Number.isFinite(amount) || amount < 0 || !/^[A-Za-z]{3}$/.test(from) || !/^[A-Za-z]{3}$/.test(to)) {
      res.status(400).json({ error: 'Provide amount, from and to (3-letter codes)' });
      return;
    }
    try {
      const { rates, date } = await getRates();
      res.json({
        amount,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        converted: round2(convertAmount(amount, from, to, rates)),
        date,
      });
    } catch (error) {
      handleCurrencyError(res, error);
    }
  }),
);

export default router;
