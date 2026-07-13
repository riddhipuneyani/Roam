import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Badge, Button, Card, FadeInUp, Input, Select, Spinner } from '../../components/ui';
import { ApiRequestError, budgetApi } from '../../lib/api';
import type {
  BudgetSummary,
  ExpenseCategory,
  ExpenseInput,
  TripExpense,
} from '../../lib/types';

/**
 * The complete expense ledger — bottom-line band, log form, entry list,
 * category breakdown, currency picker. Used by the owner's ledger page and
 * (via a token-scoped API adapter) the public shared view. One ledger,
 * two doors.
 */

export interface LedgerPanelApi {
  listExpenses: () => Promise<{ expenses: TripExpense[] }>;
  createExpense: (input: ExpenseInput) => Promise<{ expense: TripExpense }>;
  removeExpense: (expenseId: string) => Promise<unknown>;
  summary: (currency: string) => Promise<BudgetSummary>;
}

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
const SHARED_NAME_KEY = 'roam.sharedName';

function loadDisplayCurrency(): string {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY);
    return saved && /^[A-Z]{3}$/.test(saved) ? saved : 'INR';
  } catch {
    return 'INR';
  }
}

function loadSharedName(): string {
  try {
    return sessionStorage.getItem(SHARED_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' || currency === 'INR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export function LedgerPanel({ api, askName = false }: { api: LedgerPanelApi; askName?: boolean }) {
  const [displayCurrency, setDisplayCurrency] = useState(loadDisplayCurrency);
  const [currencies, setCurrencies] = useState<Record<string, string>>({
    INR: 'Indian Rupee',
    USD: 'US Dollar',
    EUR: 'Euro',
  });
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
  const [visitorName, setVisitorName] = useState(loadSharedName);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refreshSummary = useCallback(async () => {
    setSummaryBusy(true);
    try {
      setSummary(await api.summary(displayCurrency));
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
  }, [api, displayCurrency]);

  useEffect(() => {
    api
      .listExpenses()
      .then(({ expenses: list }) => setExpenses(list))
      .catch(() => setExpenses([]));
    budgetApi
      .currencies()
      .then(({ currencies: list }) => setCurrencies(list))
      .catch(() => {
        /* the seeded INR/USD/EUR options keep the pickers usable */
      });
  }, [api]);

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
    if (askName && !visitorName.trim()) {
      setFormError('Tell us who you are — first name is plenty.');
      return;
    }
    setSaving(true);
    try {
      const { expense } = await api.createExpense({
        category,
        label: label.trim(),
        amount: numericAmount,
        currency: expenseCurrency,
        date,
        notes: notes.trim() || undefined,
        ...(askName ? { addedByName: visitorName.trim() } : {}),
      });
      if (askName) {
        try {
          sessionStorage.setItem(SHARED_NAME_KEY, visitorName.trim());
        } catch {
          /* best effort */
        }
      }
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
      await api.removeExpense(expenseId);
      await refreshSummary();
    } catch {
      setExpenses(previous ?? null);
      setError('Couldn’t remove that entry — please try again.');
    }
  }

  const overBudget = summary !== null && summary.remaining !== null && summary.remaining < 0;
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

  const needsName = askName && !visitorName.trim();

  return (
    <div>
      <div className="flex justify-end">
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

      {/* ----------------------- the bottom line, front and center ----------------------- */}
      <FadeInUp className="mt-6">
        <div
          className={`grain border border-border bg-surface transition-opacity ${summaryBusy ? 'opacity-60' : ''}`}
        >
          {summary === null ? (
            <div className="flex min-h-[180px] items-center px-8">
              <Spinner size="lg" label="Totaling the ledger" />
            </div>
          ) : (
            <div className="grid gap-8 px-8 py-8 md:px-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="flex items-baseline gap-3">
                  <p className="kicker">{overBudget ? 'Over by' : 'Still to spend'}</p>
                  <Badge variant={overBudget ? 'clay' : 'sage'}>
                    {overBudget ? 'Over budget' : 'On track'}
                  </Badge>
                </div>
                <p
                  className={`mt-2 font-display text-[3.4rem] leading-none [font-variant-numeric:tabular-nums] md:text-[4.2rem] ${
                    overBudget ? 'text-accent-hover' : 'text-secondary-accent-hover'
                  }`}
                >
                  {summary.remaining !== null
                    ? money(Math.abs(summary.remaining), summary.displayCurrency)
                    : '—'}
                </p>
                {summary.plannedBudget !== null && (
                  <div className="mt-5 h-1.5 w-full max-w-sm rounded-full bg-border">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        overBudget ? 'bg-accent' : 'bg-secondary-accent'
                      }`}
                      style={{ width: `${Math.max(spentShare * 100, 2)}%` }}
                    />
                  </div>
                )}
                {overBudget && (
                  <p className="mt-3 font-body text-body-sm text-text-muted">
                    Worth a look — but some trips are worth going over for.
                  </p>
                )}
              </div>
              <dl className="space-y-3 self-center [font-variant-numeric:tabular-nums] lg:col-span-4">
                <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2">
                  <dt className="kicker">
                    Planned{summary.budgetTier ? ` · ${summary.budgetTier}` : ''}
                  </dt>
                  <dd className="font-body text-body font-medium">
                    {summary.plannedBudget !== null
                      ? money(summary.plannedBudget, summary.displayCurrency)
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2">
                  <dt className="kicker">Itinerary estimate</dt>
                  <dd className="font-body text-body text-text-muted">
                    {summary.estimatedTotal !== null
                      ? money(summary.estimatedTotal, summary.displayCurrency)
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="kicker">Spent · {summary.expenseCount} entries</dt>
                  <dd className="font-body text-body font-medium">
                    {money(summary.actualTotal, summary.displayCurrency)}
                  </dd>
                </div>
              </dl>
              <div className="self-end lg:col-span-3 lg:text-right">
                <p className="font-body text-caption text-text-muted">
                  Rates from {summary.rateDate}
                  <br />
                  European Central Bank via Frankfurter
                </p>
              </div>
            </div>
          )}
        </div>
      </FadeInUp>

      {/* ------------------------------ form + records ------------------------------ */}
      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card padding="lg">
            <h2 className="font-display text-display-sm">Log an expense</h2>
            {askName && needsName && (
              <p className="mt-2 font-body text-body-sm text-text-muted">
                First, tell us who you are — your entries will carry your name for the whole
                travel party to see.
              </p>
            )}
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              {askName && (
                <div className="sm:col-span-2">
                  <Input
                    label="Your name"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="Priya"
                    required
                    maxLength={60}
                  />
                </div>
              )}
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
                      <span className="block font-body text-caption text-text-muted">
                        Added by {expense.addedByName}
                        {expense.notes ? ` · ${expense.notes}` : ''}
                      </span>
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

        {/* --------------------------- category breakdown --------------------------- */}
        <div className="lg:col-span-4 lg:col-start-9">
          <h2 className="font-display text-display-sm">Where it’s going</h2>
          {summary !== null && summary.expenseCount > 0 ? (
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
          ) : (
            <p className="mt-5 font-body text-body-sm text-text-muted">
              The breakdown appears once you’ve logged something.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
