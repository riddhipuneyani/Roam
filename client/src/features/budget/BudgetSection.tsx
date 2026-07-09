import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Badge, Button, Card, Input, Select, Spinner } from '../../components/ui';
import { ApiRequestError, budgetApi, expensesApi } from '../../lib/api';
import type {
  BudgetSummary,
  ExpenseCategory,
  Trip,
  TripExpense,
} from '../../lib/types';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  accommodation: 'Accommodation',
  food: 'Food & drink',
  activity: 'Activities',
  transport: 'Getting around',
  shopping: 'Shopping',
  other: 'Everything else',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

const CURRENCY_KEY = 'roam.displayCurrency';

function loadDisplayCurrency(): string {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY);
    return saved && /^[A-Z]{3}$/.test(saved) ? saved : 'USD';
  } catch {
    return 'USD';
  }
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BudgetSection({ trip }: { trip: Trip }) {
  const [displayCurrency, setDisplayCurrency] = useState(loadDisplayCurrency);
  const [currencies, setCurrencies] = useState<Record<string, string>>({ USD: 'US Dollar', EUR: 'Euro' });
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [expenses, setExpenses] = useState<TripExpense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState(loadDisplayCurrency);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refreshSummary = useCallback(async () => {
    setSummaryBusy(true);
    try {
      setSummary(await budgetApi.summary(trip.id, displayCurrency));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'We couldn’t total things up just now — the numbers below may be out of date.',
      );
    } finally {
      setSummaryBusy(false);
    }
  }, [trip.id, displayCurrency]);

  useEffect(() => {
    expensesApi
      .list(trip.id)
      .then(({ expenses: list }) => setExpenses(list))
      .catch(() => setExpenses([]));
    budgetApi
      .currencies()
      .then(({ currencies: list }) => setCurrencies(list))
      .catch(() => {
        /* the fallback USD/EUR pair keeps the pickers usable */
      });
  }, [trip.id]);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCY_KEY, displayCurrency);
    } catch {
      /* best effort */
    }
  }, [displayCurrency]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const numericAmount = Number(amount);
    if (!label.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Give it a name and a positive amount.');
      return;
    }
    setSaving(true);
    try {
      const { expense } = await expensesApi.create(trip.id, {
        category,
        label: label.trim(),
        amount: numericAmount,
        currency: expenseCurrency,
        date,
        notes: notes.trim() || undefined,
      });
      setExpenses((current) => [expense, ...(current ?? [])]);
      setLabel('');
      setAmount('');
      setNotes('');
      await refreshSummary();
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError ? err.message : 'That didn’t save — please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expenseId: string) {
    const previous = expenses;
    setExpenses((current) => current?.filter((e) => e.id !== expenseId) ?? null);
    try {
      await expensesApi.remove(trip.id, expenseId);
      await refreshSummary();
    } catch {
      setExpenses(previous ?? null);
      setError('Couldn’t remove that entry — please try again.');
    }
  }

  const overBudget = summary?.remaining !== null && summary !== null && summary.remaining < 0;
  const spentShare =
    summary && summary.plannedBudget && summary.plannedBudget > 0
      ? Math.min(summary.actualTotal / summary.plannedBudget, 1)
      : 0;
  const maxCategory = useMemo(
    () => Math.max(...(summary?.byCategory.map((c) => c.actual) ?? [0]), 1),
    [summary],
  );

  const currencyOptions = useMemo(
    () =>
      Object.entries(currencies)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, name]) => (
          <option key={code} value={code}>
            {code} — {name}
          </option>
        )),
    [currencies],
  );

  return (
    <section id="budget-section" className="scroll-mt-16 border-t border-border/70 py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="kicker-accent">The ledger</p>
          <h2 className="mt-3 font-display text-display-md">Money, while you travel</h2>
          <p className="mt-3 max-w-xl font-body text-body text-text-muted">
            Log what you actually spend, in whatever currency you spend it — we’ll keep the
            running total against your plan.
          </p>
        </div>
        <div className="w-56">
          <Select
            label="Show everything in"
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
          >
            {currencyOptions}
          </Select>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 max-w-xl border-l-2 border-accent bg-accent-muted/15 px-4 py-3 font-body text-body-sm text-accent-hover"
        >
          {error}
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        {/* ------------------------- left: the accounting ------------------------- */}
        <div className="lg:col-span-5">
          <Card padding="lg" className={summaryBusy ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {summary === null ? (
              <div className="flex min-h-[200px] items-center">
                <Spinner size="lg" label="Totaling the ledger" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-display-sm">The bottom line</h3>
                  <Badge variant={overBudget ? 'clay' : 'sage'}>
                    {overBudget ? 'Over budget' : 'On track'}
                  </Badge>
                </div>

                <dl className="mt-6 space-y-3 [font-variant-numeric:tabular-nums]">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="kicker">
                      Planned budget{summary.budgetTier ? ` · ${summary.budgetTier}` : ''}
                    </dt>
                    <dd className="font-body text-body font-medium">
                      {summary.plannedBudget !== null
                        ? money(summary.plannedBudget, summary.displayCurrency)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="kicker">Itinerary estimate</dt>
                    <dd className="font-body text-body text-text-muted">
                      {summary.estimatedTotal !== null
                        ? money(summary.estimatedTotal, summary.displayCurrency)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="kicker">Spent so far · {summary.expenseCount} entries</dt>
                    <dd className="font-body text-body font-medium">
                      {money(summary.actualTotal, summary.displayCurrency)}
                    </dd>
                  </div>
                </dl>

                {summary.plannedBudget !== null && (
                  <div className="mt-5 h-1.5 w-full rounded-full bg-border">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        overBudget ? 'bg-accent' : 'bg-secondary-accent'
                      }`}
                      style={{ width: `${Math.max(spentShare * 100, 2)}%` }}
                    />
                  </div>
                )}

                <div className="mt-6 border-t border-border/70 pt-5">
                  <p className="kicker">{overBudget ? 'Over by' : 'Still to spend'}</p>
                  <p
                    className={`mt-1 font-display text-display-md [font-variant-numeric:tabular-nums] ${
                      overBudget ? 'text-accent-hover' : 'text-secondary-accent-hover'
                    }`}
                  >
                    {summary.remaining !== null
                      ? money(Math.abs(summary.remaining), summary.displayCurrency)
                      : '—'}
                  </p>
                  {overBudget && (
                    <p className="mt-2 font-body text-body-sm text-text-muted">
                      Worth a look — but some trips are worth going over for.
                    </p>
                  )}
                </div>

                <p className="mt-6 font-body text-caption text-text-muted">
                  Rates from {summary.rateDate} · European Central Bank via Frankfurter
                </p>
              </>
            )}
          </Card>

          {/* Category breakdown */}
          {summary !== null && summary.expenseCount > 0 && (
            <div className="mt-8">
              <h3 className="font-display text-display-sm">Where it’s going</h3>
              <div className="mt-5 space-y-3">
                {summary.byCategory
                  .filter((entry) => entry.count > 0)
                  .sort((a, b) => b.actual - a.actual)
                  .map((entry) => (
                    <div key={entry.category} className="grid grid-cols-12 items-center gap-3">
                      <span className="kicker col-span-4">{CATEGORY_LABELS[entry.category]}</span>
                      <div className="col-span-5 h-1.5 rounded-full bg-border">
                        <div
                          className="h-1.5 rounded-full bg-secondary-accent transition-all duration-500"
                          style={{ width: `${Math.max((entry.actual / maxCategory) * 100, 4)}%` }}
                        />
                      </div>
                      <span className="col-span-3 text-right font-body text-body-sm [font-variant-numeric:tabular-nums]">
                        {money(entry.actual, summary.displayCurrency)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* --------------------------- right: the logging --------------------------- */}
        <div className="lg:col-span-7">
          <Card padding="lg">
            <h3 className="font-display text-display-sm">Log an expense</h3>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </Select>
              <Input
                label="What was it?"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Dinner at the night market"
                required
              />
              <Input
                label="Amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
              <Select
                label="Currency"
                value={expenseCurrency}
                onChange={(e) => setExpenseCurrency(e.target.value)}
              >
                {currencyOptions}
              </Select>
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <Input
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Split with Maya"
              />
              {formError && (
                <p role="alert" className="font-body text-body-sm text-accent sm:col-span-2">
                  {formError}
                </p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving} className="px-7">
                  {saving ? (
                    <>
                      <Spinner size="sm" className="[&>span]:bg-background/90" /> Logging…
                    </>
                  ) : (
                    'Log this expense'
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Expense list */}
          <div className="mt-8">
            {expenses === null ? (
              <Spinner label="Loading expenses" />
            ) : expenses.length === 0 ? (
              <p className="border-l-2 border-border pl-4 font-display text-base italic text-text-muted">
                Nothing logged yet — the first coffee of the trip counts.
              </p>
            ) : (
              <ul>
                {expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="grid grid-cols-12 items-baseline gap-3 border-t border-border/70 py-3.5"
                  >
                    <span className="kicker col-span-3 sm:col-span-2">
                      {new Date(expense.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="col-span-5 font-body text-body-sm sm:col-span-6">
                      {expense.label}
                      <span className="ml-2 text-text-muted">
                        {CATEGORY_LABELS[expense.category].toLowerCase()}
                      </span>
                      {expense.notes && (
                        <span className="block font-body text-caption text-text-muted">
                          {expense.notes}
                        </span>
                      )}
                    </span>
                    <span className="col-span-3 text-right font-body text-body-sm font-medium [font-variant-numeric:tabular-nums]">
                      {money(Number(expense.amount), expense.currency)}
                    </span>
                    <span className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(expense.id)}
                        aria-label={`Delete ${expense.label}`}
                        className="text-text-muted/60 transition-colors hover:text-accent"
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
