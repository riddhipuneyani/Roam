import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppNav } from '../components/AppNav';
import { Button, FadeInUp, Spinner } from '../components/ui';
import { LedgerPanel, type LedgerPanelApi } from '../features/ledger/LedgerPanel';
import { ApiRequestError, budgetApi, expensesApi, tripsApi } from '../lib/api';
import type { Trip } from '../lib/types';

export function TripExpenses() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    tripsApi
      .get(tripId)
      .then(({ trip: loaded }) => setTrip(loaded))
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiRequestError && err.status === 404
            ? 'We couldn’t find that trip — it may have been deleted.'
            : 'We couldn’t load this trip just now. Please try again.',
        );
      });
  }, [tripId]);

  const ledgerApi = useMemo<LedgerPanelApi | null>(
    () =>
      trip
        ? {
            listExpenses: () => expensesApi.list(trip.id),
            createExpense: (input) => expensesApi.create(trip.id, input),
            removeExpense: (expenseId) => expensesApi.remove(trip.id, expenseId),
            summary: (currency) => budgetApi.summary(trip.id, currency),
          }
        : null,
    [trip],
  );

  async function activateHere() {
    if (!trip) return;
    setActivating(true);
    try {
      const { trip: updated } = await tripsApi.activate(trip.id);
      setTrip(updated);
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError ? err.message : 'That didn’t work — please try again.',
      );
    } finally {
      setActivating(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="px-6 py-24 md:px-12 lg:px-24">
          <p className="kicker">Hmm</p>
          <h1 className="mt-3 max-w-xl font-display text-display-md">{loadError}</h1>
          <Button className="mt-8" onClick={() => navigate('/dashboard')}>
            Back to your journeys
          </Button>
        </main>
      </div>
    );
  }

  if (!trip || !ledgerApi) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="flex min-h-[60vh] items-center px-6 md:px-12 lg:px-24">
          <Spinner size="lg" label="Opening the ledger" />
        </div>
      </div>
    );
  }

  /* -------- gate: the ledger only opens once the trip is underway -------- */
  if (trip.status !== 'active') {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="grid gap-10 px-6 py-24 md:px-12 lg:grid-cols-12 lg:px-24">
          <div className="lg:col-span-7">
            <p className="kicker-accent">Not yet underway</p>
            <h1 className="mt-3 max-w-xl font-display text-display-md [text-wrap:balance]">
              The ledger opens when the trip begins.
            </h1>
            <p className="mt-4 max-w-md font-body text-body text-text-muted">
              Expense tracking is for while you’re traveling. Mark{' '}
              <span className="font-medium text-text-primary">{trip.title}</span> as underway and
              this page becomes your running tally against the plan.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {trip.status === 'complete' && (
                <Button onClick={() => void activateHere()} disabled={activating} className="px-7 py-3">
                  {activating ? (
                    <>
                      <Spinner size="sm" className="[&>span]:bg-background/90" /> One moment…
                    </>
                  ) : (
                    'We’re taking this trip'
                  )}
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate(`/itinerary/${trip.id}`)}>
                Open the itinerary
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="px-6 py-12 md:px-12 lg:px-24">
        <FadeInUp>
          <p className="kicker-accent">The ledger · underway</p>
          <h1 className="mt-3 font-display text-display-lg [text-wrap:balance]">
            {trip.destination}
          </h1>
          <p className="mt-2 font-body text-body-sm text-text-muted">
            <Link
              to={`/itinerary/${trip.id}`}
              className="underline decoration-border-strong underline-offset-4 transition-colors hover:text-text-primary"
            >
              ← Back to the itinerary
            </Link>
          </p>
        </FadeInUp>

        <div className="mt-8">
          <LedgerPanel api={ledgerApi} />
        </div>
      </main>
    </div>
  );
}
