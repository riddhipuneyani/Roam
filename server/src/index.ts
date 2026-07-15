import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import generateRoutes from './routes/generate.js';
import expenseRoutes from './routes/expenses.js';
import budgetRoutes from './routes/budget.js';
import currencyRoutes from './routes/currency.js';
import sharedRoutes from './routes/shared.js';
import { clientUrls } from './lib/config.js';

const app = express();

const PORT = Number(process.env.PORT) || 3001;

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// CLIENT_URL may list several allowed origins (prod + previews), comma-separated.
app.use(
  cors({
    origin: clientUrls(),
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/trips/:tripId/expenses', expenseRoutes);
app.use('/api/trips/:tripId/budget', budgetRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/shared/:shareToken', sharedRoutes);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
