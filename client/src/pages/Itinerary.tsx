import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppNav } from '../components/AppNav';
import { ItinerarySpread } from '../components/ItinerarySpread';
import { TravelImage } from '../components/TravelImage';
import { Badge, Button, FadeInUp, Spinner } from '../components/ui';
import { ApiRequestError, generateApi, tripsApi } from '../lib/api';
import { destinationImage } from '../lib/images';
import type { ActivitySlot, Trip } from '../lib/types';

export function Itinerary() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const dayRefs = useRef<Record<number, HTMLElement | null>>({});

  // sharing
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    tripsApi
      .get(tripId)
      .then(({ trip: loaded }) => {
        setTrip(loaded);
        if (loaded.shareToken) {
          setShareUrl(`${window.location.origin}/shared/${loaded.shareToken}`);
        }
      })
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiRequestError && err.status === 404
            ? 'We couldn’t find that trip — it may have been deleted.'
            : 'We couldn’t load this trip just now. Please try again.',
        );
      });
  }, [tripId]);

  /* While the drafting job runs, poll its status. Closing the tab and
     reopening the trip lands back here and picks up wherever the job is. */
  useEffect(() => {
    if (!trip || trip.status !== 'generating') return;
    const timer = setInterval(async () => {
      try {
        const result = await tripsApi.status(trip.id);
        if ((result.status === 'complete' || result.status === 'active') && result.trip) {
          setTrip(result.trip);
        } else if (result.status === 'failed') {
          setTrip((current) =>
            current
              ? { ...current, status: 'failed', generationError: result.error ?? null }
              : current,
          );
        }
      } catch {
        /* transient poll failure — the next tick tries again */
      }
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.status, trip?.id]);

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
      setBusySlot(`${dayNumber}-${slot}`);
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
      setBusySlot(`${dayNumber}-restaurant-${index}`);
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

  async function markUnderway() {
    if (!trip) return;
    setActivating(true);
    try {
      const { trip: updated } = await tripsApi.activate(trip.id);
      setTrip(updated);
      setToast('Bon voyage — the ledger is open for this trip.');
    } catch (err) {
      setToast(
        err instanceof ApiRequestError ? err.message : 'That didn’t work — please try again.',
      );
    } finally {
      setActivating(false);
    }
  }

  async function enableSharing() {
    if (!trip) return;
    setShareBusy(true);
    try {
      const { shareUrl: url } = await tripsApi.share(trip.id);
      setShareUrl(url);
    } catch (err) {
      setToast(
        err instanceof ApiRequestError ? err.message : 'Sharing didn’t switch on — please try again.',
      );
    } finally {
      setShareBusy(false);
    }
  }

  async function revokeSharing() {
    if (!trip) return;
    setShareBusy(true);
    try {
      await tripsApi.unshare(trip.id);
      setShareUrl(null);
      setConfirmRevoke(false);
      setToast('Sharing is off — the old link no longer works for anyone.');
    } catch (err) {
      setToast(
        err instanceof ApiRequestError ? err.message : 'That didn’t work — please try again.',
      );
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setToast('Couldn’t reach the clipboard — select the link and copy it by hand.');
    }
  }

  async function downloadPdf() {
    if (!trip || exporting) return;
    setExporting(true);
    try {
      // The signed URL already carries a content-disposition with the
      // filename, so a plain anchor click downloads it correctly.
      const { url } = await tripsApi.exportPdf(trip.id);
      const anchor = document.createElement('a');
      anchor.href = url;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setToast(
        err instanceof ApiRequestError
          ? err.message
          : 'The PDF didn’t come together — please try again in a moment.',
      );
    } finally {
      setExporting(false);
    }
  }

  async function retryDraft() {
    if (!trip) return;
    setRetrying(true);
    try {
      await generateApi.retryItinerary(trip.id);
      // Back into the drafting state — the poll above takes it from here.
      setTrip((current) =>
        current ? { ...current, status: 'generating', generationError: null } : current,
      );
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

  /* The calm waiting room: the drafting job is running server-side and the
     poll above will flip this view the moment it settles. Safe to close. */
  if (trip.status === 'generating') {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="grid min-h-[70vh] gap-10 px-6 py-16 md:px-12 lg:grid-cols-12 lg:px-24">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="kicker-accent">Drafting your days</p>
            <h1 className="mt-4 max-w-xl font-display text-display-lg [text-wrap:balance]">
              Sketching {trip.destination.split(',')[0]}…
            </h1>
            <div className="mt-10 flex items-center gap-4">
              <Spinner size="lg" />
              <p className="font-display text-lg italic text-text-muted">
                Real places, honest prices, and the why behind each pick.
              </p>
            </div>
            <p className="mt-14 max-w-sm border-l-2 border-border pl-4 font-body text-body-sm text-text-muted">
              This usually takes a minute or two. You can close this tab — the draft keeps
              working, and this page picks it up whenever you come back.
            </p>
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
      </div>
    );
  }

  if (!trip.itinerary) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="grid gap-10 px-6 py-24 md:px-12 lg:grid-cols-12 lg:px-24">
          <div className="lg:col-span-6">
            <p className="kicker-accent">
              {trip.status === 'failed' ? 'A small hitch' : 'Still a sketch'}
            </p>
            <h1 className="mt-3 font-display text-display-md [text-wrap:balance]">
              {trip.title} hasn’t been drafted yet.
            </h1>
            <p className="mt-4 max-w-md font-body text-body text-text-muted">
              {trip.generationError ??
                'Your answers are saved. Give the draft another go and we’ll lay out every day — places, prices, and the why behind each pick.'}
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
  const prefs = trip.preferences;

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------------------------- hero ---------------------------------- */}
      {/* Flex flow (not stacked absolutes): the hero grows with its content,
          so the wordmark row and the kicker/title block can never overlap,
          whatever the title length or viewport. */}
      <header className="relative flex min-h-[58vh] flex-col">
        <TravelImage
          src={destinationImage(itinerary.destination)}
          alt={itinerary.destination}
          fallbackSeed={trip.id}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/25 to-primary/20" />
        <div className="relative z-10 flex items-baseline justify-between gap-4 px-6 py-5 md:px-12">
          <Link to="/dashboard" className="font-display text-2xl italic text-background">
            Roam
          </Link>
          <Link
            to="/dashboard"
            className="whitespace-nowrap font-body text-body-sm text-background/80 transition-colors hover:text-background"
          >
            ← Your journeys
          </Link>
        </div>
        <div className="relative z-10 mt-auto px-6 pb-10 pt-10 md:px-12 lg:px-24">
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
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <p className="inline-block border border-background/50 px-4 py-1.5 font-body text-body-sm text-background">
                Est. budget · {itinerary.estimatedTotalBudget}
              </p>
              {trip.status === 'complete' && (
                <Button
                  onClick={() => void markUnderway()}
                  disabled={activating}
                  className="!bg-accent px-6 hover:!bg-accent-hover"
                >
                  {activating ? (
                    <>
                      <Spinner size="sm" className="[&>span]:bg-background/90" /> One moment…
                    </>
                  ) : (
                    'We’re taking this trip'
                  )}
                </Button>
              )}
              {trip.status === 'active' && (
                <>
                  <Badge variant="sage">Underway</Badge>
                  <Link
                    to={`/trip/${trip.id}/expenses`}
                    className="font-body text-body-sm font-medium text-background underline decoration-background/50 underline-offset-4 transition-colors hover:decoration-background"
                  >
                    Open the ledger →
                  </Link>
                </>
              )}
              {!shareUrl && (
                <button
                  type="button"
                  onClick={() => void enableSharing()}
                  disabled={shareBusy}
                  className="border border-background/50 px-4 py-1.5 font-body text-body-sm text-background transition-colors hover:border-background hover:bg-background/10"
                >
                  {shareBusy ? 'Switching on…' : 'Share this trip'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={exporting}
                className="inline-flex items-center gap-2 border border-background/50 px-4 py-1.5 font-body text-body-sm text-background transition-colors hover:border-background hover:bg-background/10 disabled:opacity-70"
              >
                {exporting ? (
                  <>
                    <Spinner size="sm" className="[&>span]:bg-background/90" />
                    Setting the type…
                  </>
                ) : (
                  'Download PDF'
                )}
              </button>
            </div>
          </FadeInUp>
        </div>
      </header>

      {/* ------------------------------- share strip ------------------------------- */}
      {shareUrl && (
        <div className="grain border-b border-border/70 bg-surface">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4 md:px-12 lg:px-24">
            <p className="kicker-accent whitespace-nowrap">Shared with your travel party</p>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                aria-label="Shareable link"
                className="min-w-0 flex-1 border-b border-border-strong bg-transparent px-1 py-1 font-body text-body-sm text-text-muted focus:outline-none"
              />
              <Button variant="secondary" onClick={() => void copyShareUrl()} className="px-4 py-1.5">
                {copied ? 'Copied ✓' : 'Copy link'}
              </Button>
            </div>
            {confirmRevoke ? (
              <span className="flex items-center gap-3 font-body text-body-sm">
                <span className="text-text-muted">The link stops working for everyone.</span>
                <button
                  type="button"
                  onClick={() => void revokeSharing()}
                  disabled={shareBusy}
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  Stop sharing
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  Keep it live
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                className="whitespace-nowrap font-body text-body-sm text-text-muted transition-colors hover:text-accent"
              >
                Stop sharing…
              </button>
            )}
            <p className="w-full font-body text-caption text-text-muted">
              Anyone with the link can read the itinerary and add to the shared expense ledger — no
              account needed.
            </p>
          </div>
        </div>
      )}

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
                document.getElementById('closing-spread')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-4 font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
            >
              <span className="font-display italic">Before you go</span>
            </button>
            {trip.status === 'active' && (
              <Link
                to={`/trip/${trip.id}/expenses`}
                className="whitespace-nowrap border-b-2 border-transparent px-4 py-4 font-body text-body-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                <span className="font-display italic">The ledger →</span>
              </Link>
            )}
          </div>
          {/* Lightweight, always-visible estimate — the full dashboard lives on the ledger page */}
          <p className="hidden items-center gap-2 whitespace-nowrap border-l border-border/70 pl-5 font-body text-body-sm text-text-muted lg:flex">
            <span className="kicker">Est. budget</span>
            <span className="font-medium text-secondary-accent-hover">
              {itinerary.estimatedTotalBudget}
            </span>
          </p>
        </div>
      </nav>

      {/* -------------------------------- day spreads ------------------------------- */}
      <main className="px-6 md:px-12 lg:px-24">
        <ItinerarySpread
          itinerary={itinerary}
          busySlot={busySlot}
          onRegenActivity={(dayNumber, slot) => void regenActivity(dayNumber, slot)}
          onRegenRestaurant={(dayNumber, index) => void regenRestaurant(dayNumber, index)}
          registerDayRef={(dayNumber, el) => {
            dayRefs.current[dayNumber] = el;
          }}
        />

        <div className="flex flex-wrap items-center gap-4 border-t border-border/70 py-10">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            ← Back to your journeys
          </Button>
          <Button variant="ghost" onClick={() => navigate('/plan')}>
            Sketch another trip
          </Button>
        </div>
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
