import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppNav } from '../components/AppNav';
import { TravelImage } from '../components/TravelImage';
import { Badge, Button, FadeInUp, Spinner } from '../components/ui';
import { ApiRequestError, tripsApi } from '../lib/api';
import { loadPlanDraft, type PlanDraft } from '../lib/draft';
import { destinationImage, SCENES } from '../lib/images';
import type { TripSummary } from '../lib/types';
import { useAuth } from '../hooks/useAuth';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function TripTile({
  trip,
  featured,
  onDuplicate,
  onDelete,
}: {
  trip: TripSummary;
  featured: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const isDraft = trip.status === 'draft';

  return (
    <article className={featured ? 'sm:col-span-2' : ''}>
      <button
        type="button"
        onClick={() => navigate(`/itinerary/${trip.id}`)}
        className="group block w-full text-left focus-visible:focus-ring"
      >
        <div className="relative overflow-hidden">
          <TravelImage
            src={destinationImage(trip.destination)}
            alt={trip.destination}
            fallbackSeed={trip.id}
            className={`w-full object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.03] ${
              featured ? 'aspect-[21/10]' : 'aspect-[4/3]'
            }`}
          />
          {isDraft && (
            <div className="absolute left-3 top-3">
              <Badge variant="clay">Draft</Badge>
            </div>
          )}
          {trip.status === 'active' && (
            <div className="absolute left-3 top-3">
              <Badge variant="sage">Underway</Badge>
            </div>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-3 pt-4">
          <div>
            <h3 className="font-display text-display-sm transition-colors group-hover:text-accent">
              {trip.title}
            </h3>
            <p className="kicker mt-1">
              {trip.destination} · {formatDate(trip.updatedAt)}
            </p>
          </div>
        </div>
      </button>
      <div className="flex items-center gap-4 pt-2 font-body text-body-sm">
        <button
          type="button"
          onClick={() => navigate(`/itinerary/${trip.id}`)}
          className="text-text-muted transition-colors hover:text-text-primary"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(trip.id)}
          className="text-text-muted transition-colors hover:text-text-primary"
        >
          Duplicate
        </button>
        {confirming ? (
          <span className="flex items-center gap-3">
            <span className="text-text-muted">Delete this trip?</span>
            <button
              type="button"
              onClick={() => onDelete(trip.id)}
              className="font-medium text-accent hover:text-accent-hover"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-text-muted hover:text-text-primary"
            >
              Keep it
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-text-muted transition-colors hover:text-accent"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);

  useEffect(() => {
    setDraft(loadPlanDraft());
    tripsApi
      .list()
      .then(({ trips: list }) => setTrips(list))
      .catch((err: unknown) => {
        setError(
          err instanceof ApiRequestError ? err.message : 'We couldn’t load your journeys just now.',
        );
        setTrips([]);
      });
  }, []);

  async function handleDuplicate(id: string) {
    try {
      const { trip } = await tripsApi.duplicate(id);
      const { trips: list } = await tripsApi.list();
      setTrips(list);
      navigate(`/itinerary/${trip.id}`);
    } catch {
      setError('Couldn’t duplicate that trip. Please try again.');
    }
  }

  async function handleDelete(id: string) {
    const previous = trips;
    setTrips((current) => current?.filter((t) => t.id !== id) ?? null);
    try {
      await tripsApi.remove(id);
    } catch {
      setTrips(previous ?? null);
      setError('Couldn’t delete that trip. Please try again.');
    }
  }

  const hasTrips = trips !== null && trips.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="px-6 py-14 md:px-12 lg:px-24">
        {/* Editorial header — asymmetric, with the CTA on the baseline */}
        <FadeInUp className="flex flex-wrap items-end justify-between gap-6 border-b border-border/70 pb-10">
          <div>
            <p className="kicker">Your journeys</p>
            <h1 className="mt-3 font-display text-display-lg [text-wrap:balance]">
              Where to next{user ? `, ${user.name.split(' ')[0]}` : ''}?
            </h1>
          </div>
          <Button onClick={() => navigate('/plan')} className="px-7 py-3">
            Plan a new trip
          </Button>
        </FadeInUp>

        {error && (
          <div
            role="alert"
            className="mt-8 border-l-2 border-accent bg-accent-muted/15 px-4 py-3 font-body text-body-sm text-accent-hover"
          >
            {error}
          </div>
        )}

        {/* Resume strip for an unfinished onboarding session */}
        {draft && (
          <FadeInUp delay={0.05} className="grain mt-10 border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-8">
              <div>
                <p className="kicker-accent">In progress</p>
                <p className="mt-1 font-display text-display-sm">
                  {draft.answers.destinationKnown && draft.answers.destination
                    ? `Your ${draft.answers.destination} trip is half-sketched`
                    : 'A trip is half-sketched'}
                </p>
                <p className="mt-1 font-body text-body-sm text-text-muted">
                  Saved {formatDate(draft.savedAt)} — your answers are kept.
                </p>
              </div>
              <Button variant="secondary" onClick={() => navigate('/plan')}>
                Pick up planning →
              </Button>
            </div>
          </FadeInUp>
        )}

        {/* Library */}
        <section className="mt-12">
          {trips === null ? (
            <div className="flex min-h-[30vh] items-center justify-start">
              <Spinner size="lg" label="Loading your journeys" />
            </div>
          ) : hasTrips ? (
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip, i) => (
                <FadeInUp key={trip.id} delay={Math.min(i * 0.06, 0.3)}>
                  <TripTile
                    trip={trip}
                    featured={i === 0}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                </FadeInUp>
              ))}
            </div>
          ) : (
            /* Empty state — a split invitation, not a centered card */
            <FadeInUp className="grid overflow-hidden border border-border lg:grid-cols-12">
              <div className="grain flex flex-col justify-center bg-surface px-8 py-14 lg:col-span-7 lg:px-14">
                <p className="kicker">An empty shelf, for now</p>
                <h2 className="mt-4 max-w-md font-display text-display-md [text-wrap:balance]">
                  Every good trip starts as a rough sketch.
                </h2>
                <p className="mt-4 max-w-md font-body text-body text-text-muted">
                  Answer a few quiet questions — two minutes, honestly — and we’ll draft your days:
                  places, prices, and the why behind each one.
                </p>
                <div className="mt-8">
                  <Button onClick={() => navigate('/plan')} className="px-7 py-3">
                    Sketch your first trip
                  </Button>
                </div>
              </div>
              <div className="relative hidden min-h-[320px] lg:col-span-5 lg:block">
                <TravelImage
                  src={SCENES.emptyShelf}
                  alt="A quiet road disappearing into morning mist"
                  fallbackSeed="empty-shelf"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </FadeInUp>
          )}
        </section>

        {trips !== null && trips.some((t) => t.status === 'draft') && (
          <p className="mt-10 font-body text-body-sm text-text-muted">
            Drafts are trips whose itinerary isn’t finished yet — open one to pick up where it
            stopped, or{' '}
            <Link to="/plan" className="text-accent hover:text-accent-hover">
              start fresh
            </Link>
            .
          </p>
        )}
      </main>
    </div>
  );
}
