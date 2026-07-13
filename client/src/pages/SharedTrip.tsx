import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ItinerarySpread } from '../components/ItinerarySpread';
import { TravelImage } from '../components/TravelImage';
import { FadeInUp, Spinner } from '../components/ui';
import { LedgerPanel, type LedgerPanelApi } from '../features/ledger/LedgerPanel';
import { sharedApi } from '../lib/api';
import { destinationImage } from '../lib/images';
import type { SharedTripData } from '../lib/types';

/**
 * The public shared-trip view: read-only itinerary (no swap icons, no owner
 * controls) plus the collaboratively editable ledger. No login anywhere —
 * the URL's token is the whole key.
 */
export function SharedTrip() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [trip, setTrip] = useState<SharedTripData | null>(null);
  const [gone, setGone] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const dayRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    if (!shareToken) return;
    sharedApi
      .get(shareToken)
      .then(({ trip: loaded }) => setTrip(loaded))
      .catch((err: unknown) => {
        void err;
        setGone(true);
      });
  }, [shareToken]);

  useEffect(() => {
    if (!trip?.itinerary) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const day = Number(entry.target.getAttribute('data-day'));
            if (day) setActiveDay(day);
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    Object.values(dayRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [trip?.itinerary]);

  const ledgerApi = useMemo<LedgerPanelApi | null>(
    () =>
      shareToken
        ? {
            listExpenses: () => sharedApi.listExpenses(shareToken),
            createExpense: (input) => sharedApi.createExpense(shareToken, input),
            removeExpense: (expenseId) => sharedApi.removeExpense(shareToken, expenseId),
            summary: (currency) => sharedApi.summary(shareToken, currency),
          }
        : null,
    [shareToken],
  );

  if (gone) {
    return (
      <main className="flex min-h-screen flex-col bg-background px-6 py-6 md:px-12">
        <Link to="/" className="font-display text-2xl italic tracking-tight">
          Roam
        </Link>
        <div className="my-auto max-w-xl py-16">
          <p className="kicker">This door is closed</p>
          <h1 className="mt-4 font-display text-display-md [text-wrap:balance]">
            This link is no longer active.
          </h1>
          <p className="mt-4 font-body text-body text-text-muted">
            The trip’s owner has stopped sharing it. If you were following along, ask them for a
            fresh link — or{' '}
            <Link to="/" className="text-accent transition-colors hover:text-accent-hover">
              plan a journey of your own
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  if (!trip || !ledgerApi) {
    return (
      <div className="flex min-h-screen items-center bg-background px-6 md:px-12 lg:px-24">
        <Spinner size="lg" label="Opening the shared trip" />
      </div>
    );
  }

  const itinerary = trip.itinerary;

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------------------------- hero ---------------------------------- */}
      <header className="relative h-[52vh] min-h-[400px]">
        <TravelImage
          src={destinationImage(trip.destination)}
          alt={trip.destination}
          fallbackSeed={trip.destination}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/25 to-primary/20" />
        <div className="absolute left-0 right-0 top-0 flex items-baseline justify-between px-6 py-5 md:px-12">
          <Link to="/" className="font-display text-2xl italic text-background">
            Roam
          </Link>
          <p className="font-body text-body-sm text-background/80">A shared journey</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 md:px-12 lg:px-24">
          <FadeInUp>
            <p className="kicker !text-background/75">
              {trip.preferences.duration ? `${trip.preferences.duration} days` : 'A trip'}
              {trip.preferences.companions ? ` · ${trip.preferences.companions}` : ''}
              {trip.preferences.budgetTier ? ` · ${trip.preferences.budgetTier}` : ''}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-display-lg text-background md:text-display-xl [text-wrap:balance]">
              {itinerary ? itinerary.destination : trip.destination}
            </h1>
            {itinerary && (
              <>
                <p className="mt-4 max-w-2xl font-body text-body-lg text-background/90">
                  {itinerary.tripSummary}
                </p>
                <p className="mt-5 inline-block border border-background/50 px-4 py-1.5 font-body text-body-sm text-background">
                  Est. budget · {itinerary.estimatedTotalBudget}
                </p>
              </>
            )}
          </FadeInUp>
        </div>
      </header>

      {/* The one honest disclosure: this page is a shared, editable ledger */}
      <div className="grain border-b border-border/70 bg-surface">
        <p className="px-6 py-3 font-body text-body-sm text-text-muted md:px-12 lg:px-24">
          You’re viewing a shared trip. The itinerary is read-only, but{' '}
          <span className="font-medium text-text-primary">
            anyone with this link can add to the expense ledger below
          </span>{' '}
          — it’s the whole travel party’s running tally.
        </p>
      </div>

      {itinerary ? (
        <>
          {/* ------------------------- sticky chapter navigation ------------------------ */}
          <nav className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
            <div className="flex items-stretch justify-between px-6 md:px-12 lg:px-24">
              <div className="flex flex-1 gap-1 overflow-x-auto">
                {itinerary.days.map((day) => (
                  <button
                    key={day.dayNumber}
                    type="button"
                    onClick={() =>
                      dayRefs.current[day.dayNumber]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className={`whitespace-nowrap border-b-2 px-4 py-4 font-body text-body-sm transition-colors duration-200 ${
                      activeDay === day.dayNumber
                        ? 'border-accent font-medium text-text-primary'
                        : 'border-transparent text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className="font-display italic">Day {day.dayNumber}</span>
                    <span className="ml-2 hidden md:inline">{day.theme}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('shared-ledger')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="whitespace-nowrap border-b-2 border-transparent px-4 py-4 font-body text-body-sm font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  <span className="font-display italic">The ledger →</span>
                </button>
              </div>
              <p className="hidden items-center gap-2 whitespace-nowrap border-l border-border/70 pl-5 font-body text-body-sm text-text-muted lg:flex">
                <span className="kicker">Est. budget</span>
                <span className="font-medium text-secondary-accent-hover">
                  {itinerary.estimatedTotalBudget}
                </span>
              </p>
            </div>
          </nav>

          {/* ------------------------ read-only day spreads ------------------------ */}
          <main className="px-6 md:px-12 lg:px-24">
            <ItinerarySpread
              itinerary={itinerary}
              registerDayRef={(dayNumber, el) => {
                dayRefs.current[dayNumber] = el;
              }}
            />

            {/* ------------------------------ shared ledger ------------------------------ */}
            <section id="shared-ledger" className="scroll-mt-16 border-t border-border/70 py-16">
              <p className="kicker-accent">The ledger · shared</p>
              <h2 className="mt-3 font-display text-display-md">The travel party’s tally</h2>
              <p className="mt-3 max-w-xl font-body text-body text-text-muted">
                Log what you spend and it lands on everyone’s copy instantly — each entry carries
                the name of whoever added it.
              </p>
              <div className="mt-8">
                <LedgerPanel api={ledgerApi} askName />
              </div>
            </section>
          </main>
        </>
      ) : (
        <main className="px-6 py-20 md:px-12 lg:px-24">
          <p className="max-w-xl font-display text-lg italic text-text-muted">
            This trip’s itinerary hasn’t been drafted yet — check back once its owner finishes
            planning.
          </p>
        </main>
      )}

      {/* ---------------------------------- footer --------------------------------- */}
      <footer className="border-t border-border/70 px-6 py-10 md:px-12 lg:px-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <span className="font-display text-xl italic">Roam</span>
          <p className="font-body text-body-sm text-text-muted">
            This journey was planned with Roam.{' '}
            <Link to="/" className="text-accent transition-colors hover:text-accent-hover">
              Plan one that feels like you →
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
