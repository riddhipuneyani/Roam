import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppNav } from '../components/AppNav';
import { TravelImage } from '../components/TravelImage';
import { Badge, Button, FadeInUp, Spinner } from '../components/ui';
import { ApiRequestError, generateApi, tripsApi } from '../lib/api';
import { destinationImage } from '../lib/images';
import type { ActivityBlock, ActivitySlot, RestaurantRec, Trip } from '../lib/types';

/* --------------------------------- helpers -------------------------------- */

function parseCost(value: string): number | null {
  const match = value.replace(/,/g, '').match(/\$\s?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

const SLOT_LABELS: Record<ActivitySlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

/* ------------------------------ regen button ------------------------------ */

function RegenButton({
  busy,
  onClick,
  label,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  if (busy) {
    return <Spinner size="sm" label={label} />;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Not feeling it? Swap this one pick"
      className="text-text-muted/60 transition-colors duration-200 hover:text-accent focus-visible:focus-ring"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
        <path d="M13.7 1.8v2.7h-2.7" />
      </svg>
    </button>
  );
}

/* ------------------------------ activity card ----------------------------- */

function ActivityCard({
  slot,
  block,
  busy,
  onRegen,
}: {
  slot: ActivitySlot;
  block: ActivityBlock;
  busy: boolean;
  onRegen: () => void;
}) {
  return (
    <div className="border-t border-border/70 py-7">
      <div className="grid gap-5 md:grid-cols-12">
        <div className="flex items-start justify-between md:col-span-2 md:block">
          <p className="kicker-accent">{SLOT_LABELS[slot]}</p>
          <div className="md:mt-3">
            <RegenButton busy={busy} onClick={onRegen} label={`Swap the ${slot} plan`} />
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={block.activity}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="md:col-span-10"
          >
            <div className="grid gap-6 md:grid-cols-12">
              <div className="md:col-span-8">
                <h4 className="font-display text-display-sm">{block.activity}</h4>
                <p className="mt-2 font-body text-body text-text-muted">{block.description}</p>
                <p className="mt-4 border-l-2 border-accent/70 pl-4 font-display text-lg italic leading-normal text-text-primary">
                  {block.why}
                </p>
              </div>
              <div className="md:col-span-4 md:border-l md:border-border/70 md:pl-6">
                <p className="kicker">Where</p>
                <p className="mt-1 font-body text-body-sm">{block.location}</p>
                <p className="kicker mt-4">Cost</p>
                <p className="mt-1 font-body text-body-sm font-medium text-secondary-accent-hover">
                  {block.estimatedCost}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ----------------------------- restaurant card ---------------------------- */

function RestaurantCard({
  restaurant,
  busy,
  onRegen,
}: {
  restaurant: RestaurantRec;
  busy: boolean;
  onRegen: () => void;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={restaurant.name}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="grain flex h-full flex-col border border-border bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h5 className="font-display text-xl">{restaurant.name}</h5>
          <RegenButton busy={busy} onClick={onRegen} label={`Swap ${restaurant.name}`} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="sage">{restaurant.cuisine}</Badge>
          <Badge variant="clay">{restaurant.mealType}</Badge>
          <Badge variant="neutral">{restaurant.priceRange}</Badge>
        </div>
        <p className="mt-4 font-body text-body-sm italic leading-relaxed text-text-muted">
          {restaurant.why}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

/* --------------------------------- the page -------------------------------- */

export function Itinerary() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const dayRefs = useRef<Record<number, HTMLElement | null>>({});

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

  /* Track which day chapter is in view for the sticky nav */
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const regenActivity = useCallback(
    async (dayNumber: number, slot: ActivitySlot) => {
      if (!trip) return;
      const key = `${dayNumber}-${slot}`;
      setBusySlot(key);
      try {
        const { trip: updated } = await tripsApi.regenerateActivity(trip.id, dayNumber, slot);
        setTrip(updated);
      } catch (err) {
        setToast(
          err instanceof ApiRequestError
            ? err.message
            : 'We couldn’t find a fresh alternative just now — the current pick is untouched.',
        );
      } finally {
        setBusySlot(null);
      }
    },
    [trip],
  );

  const regenRestaurant = useCallback(
    async (dayNumber: number, index: number) => {
      if (!trip) return;
      const key = `${dayNumber}-restaurant-${index}`;
      setBusySlot(key);
      try {
        const { trip: updated } = await tripsApi.regenerateRestaurant(trip.id, dayNumber, index);
        setTrip(updated);
      } catch (err) {
        setToast(
          err instanceof ApiRequestError
            ? err.message
            : 'We couldn’t find a fresh alternative just now — the current pick is untouched.',
        );
      } finally {
        setBusySlot(null);
      }
    },
    [trip],
  );

  async function retryDraft() {
    if (!trip) return;
    setRetrying(true);
    try {
      const { trip: updated } = await generateApi.retryItinerary(trip.id);
      setTrip(updated);
    } catch (err) {
      setToast(
        err instanceof ApiRequestError
          ? err.message
          : 'The draft didn’t come together — please try again in a moment.',
      );
    } finally {
      setRetrying(false);
    }
  }

  /* ------------------------------ empty states ----------------------------- */

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

  if (!trip) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="flex min-h-[60vh] items-center px-6 md:px-12 lg:px-24">
          <Spinner size="lg" label="Opening your itinerary" />
        </div>
      </div>
    );
  }

  if (!trip.itinerary) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="grid gap-10 px-6 py-24 md:px-12 lg:grid-cols-12 lg:px-24">
          <div className="lg:col-span-6">
            <p className="kicker-accent">Still a sketch</p>
            <h1 className="mt-3 font-display text-display-md [text-wrap:balance]">
              {trip.title} hasn’t been drafted yet.
            </h1>
            <p className="mt-4 max-w-md font-body text-body text-text-muted">
              Your answers are saved. Give the draft another go and we’ll lay out every day —
              places, prices, and the why behind each pick.
            </p>
            <Button className="mt-8 px-7 py-3" onClick={() => void retryDraft()} disabled={retrying}>
              {retrying ? (
                <>
                  <Spinner size="sm" className="[&>span]:bg-background/90" /> Drafting…
                </>
              ) : (
                'Draft this itinerary'
              )}
            </Button>
          </div>
          <div className="hidden lg:col-span-5 lg:col-start-8 lg:block">
            <TravelImage
              src={destinationImage(trip.destination)}
              alt={trip.destination}
              fallbackSeed={trip.id}
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
        </main>
        {toast && <ToastStrip message={toast} />}
      </div>
    );
  }

  const itinerary = trip.itinerary;
  const dayCosts = itinerary.days.map((d) => parseCost(d.dailyBudgetEstimate));
  const maxCost = Math.max(...dayCosts.map((c) => c ?? 0), 1);
  const prefs = trip.preferences;

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------------------------- hero ---------------------------------- */}
      <header className="relative h-[58vh] min-h-[420px]">
        <TravelImage
          src={destinationImage(itinerary.destination)}
          alt={itinerary.destination}
          fallbackSeed={trip.id}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/25 to-primary/20" />
        <div className="absolute left-0 right-0 top-0 flex items-baseline justify-between px-6 py-5 md:px-12">
          <Link to="/dashboard" className="font-display text-2xl italic text-background">
            Roam
          </Link>
          <Link
            to="/dashboard"
            className="font-body text-body-sm text-background/80 transition-colors hover:text-background"
          >
            ← Your journeys
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 md:px-12 lg:px-24">
          <FadeInUp>
            <p className="kicker !text-background/75">
              {prefs.duration} days · {prefs.companions} · {prefs.budgetTier}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-display-lg text-background md:text-display-xl [text-wrap:balance]">
              {itinerary.destination}
            </h1>
            <p className="mt-4 max-w-2xl font-body text-body-lg text-background/90">
              {itinerary.tripSummary}
            </p>
            <p className="mt-5 inline-block border border-background/50 px-4 py-1.5 font-body text-body-sm text-background">
              {itinerary.estimatedTotalBudget}
            </p>
          </FadeInUp>
        </div>
      </header>

      {/* ------------------------- sticky chapter navigation ------------------------ */}
      <nav className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto px-6 md:px-12 lg:px-24">
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
              document.getElementById('closing-spread')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="whitespace-nowrap border-b-2 border-transparent px-4 py-4 font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
          >
            <span className="font-display italic">Before you go</span>
          </button>
        </div>
      </nav>

      {/* -------------------------------- day spreads ------------------------------- */}
      <main className="px-6 md:px-12 lg:px-24">
        {itinerary.days.map((day) => {
          const cost = dayCosts[day.dayNumber - 1];
          return (
            <section
              key={day.dayNumber}
              data-day={day.dayNumber}
              ref={(el) => {
                dayRefs.current[day.dayNumber] = el;
              }}
              className="scroll-mt-16 border-b border-border/70 py-16"
            >
              <div className="grid gap-10 lg:grid-cols-12">
                {/* Day rail */}
                <aside className="lg:col-span-3">
                  <div className="lg:sticky lg:top-24">
                    <p className="kicker-accent">Day {day.dayNumber}</p>
                    <h2 className="mt-2 font-display text-display-md [text-wrap:balance]">
                      {day.theme}
                    </h2>

                    <div className="mt-8 border-t border-border/70 pt-4">
                      <p className="kicker">Getting around</p>
                      <p className="mt-1 font-body text-body-sm text-text-muted">{day.transport}</p>
                    </div>

                    <div className="mt-5 border-t border-border/70 pt-4">
                      <p className="kicker">Day budget</p>
                      <p className="mt-1 font-body text-body font-medium text-secondary-accent-hover">
                        {day.dailyBudgetEstimate}
                      </p>
                      {cost !== null && (
                        <div className="mt-2 h-1.5 w-full rounded-full bg-border">
                          <div
                            className="h-1.5 rounded-full bg-secondary-accent transition-all duration-500"
                            style={{ width: `${Math.max((cost / maxCost) * 100, 6)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <p className="mt-8 border-l-2 border-accent/60 pl-4 font-display text-base italic text-text-muted">
                      {day.tip}
                    </p>
                  </div>
                </aside>

                {/* Day content */}
                <div className="lg:col-span-9">
                  {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
                    <ActivityCard
                      key={slot}
                      slot={slot}
                      block={day[slot]}
                      busy={busySlot === `${day.dayNumber}-${slot}`}
                      onRegen={() => void regenActivity(day.dayNumber, slot)}
                    />
                  ))}

                  <div className="border-t border-border/70 py-7">
                    <p className="kicker-accent">At the table</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {day.restaurants.map((restaurant, i) => (
                        <RestaurantCard
                          key={`${restaurant.name}-${i}`}
                          restaurant={restaurant}
                          busy={busySlot === `${day.dayNumber}-restaurant-${i}`}
                          onRegen={() => void regenRestaurant(day.dayNumber, i)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* ------------------------------ closing spread ------------------------------ */}
        <section id="closing-spread" className="scroll-mt-16 py-16">
          <p className="kicker-accent">Before you go</p>
          <h2 className="mt-3 font-display text-display-md">The practical part</h2>

          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h3 className="font-display text-display-sm">What to pack</h3>
              <ul className="mt-5 space-y-3">
                {itinerary.packingList.map((item) => (
                  <li key={item} className="flex items-baseline gap-3 font-body text-body-sm">
                    <span className="h-2 w-2 flex-none translate-y-[-1px] border border-border-strong" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-4">
              <h3 className="font-display text-display-sm">Worth knowing</h3>
              <ul className="mt-5 space-y-4">
                {itinerary.practicalTips.map((tip) => (
                  <li key={tip} className="flex items-baseline gap-3 font-body text-body-sm text-text-muted">
                    <span className="font-display text-lg italic leading-none text-accent">*</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-4">
              <h3 className="font-display text-display-sm">Budget at a glance</h3>
              <div className="mt-5 space-y-3">
                {itinerary.days.map((day, i) => {
                  const cost = dayCosts[i];
                  return (
                    <div key={day.dayNumber} className="grid grid-cols-12 items-center gap-3">
                      <span className="kicker col-span-2">D{day.dayNumber}</span>
                      <div className="col-span-7 h-1.5 rounded-full bg-border">
                        <div
                          className="h-1.5 rounded-full bg-secondary-accent"
                          style={{ width: cost !== null ? `${Math.max((cost / maxCost) * 100, 6)}%` : '6%' }}
                        />
                      </div>
                      <span className="col-span-3 text-right font-body text-body-sm text-text-muted">
                        {day.dailyBudgetEstimate}
                      </span>
                    </div>
                  );
                })}
                <p className="border-t border-border/70 pt-3 text-right font-body text-body-sm font-medium">
                  {itinerary.estimatedTotalBudget}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-wrap items-center gap-4 border-t border-border/70 pt-8">
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              ← Back to your journeys
            </Button>
            <Button variant="ghost" onClick={() => navigate('/plan')}>
              Sketch another trip
            </Button>
          </div>
        </section>
      </main>

      {toast && <ToastStrip message={toast} />}
    </div>
  );
}

function ToastStrip({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="grain fixed bottom-6 left-6 z-50 max-w-sm border border-border bg-surface px-5 py-4 shadow-soft-md"
      role="status"
    >
      <p className="font-body text-body-sm text-text-primary">{message}</p>
    </motion.div>
  );
}
