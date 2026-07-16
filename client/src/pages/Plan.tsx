import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Spinner } from '../components/ui';
import { TravelImage } from '../components/TravelImage';
import { ProgressDots } from '../features/onboarding/components';
import {
  StepBudget,
  StepCompanions,
  StepDestination,
  StepDuration,
  StepFood,
  StepInterests,
  StepReview,
  StepVibe,
  TOTAL_STEPS,
  buildPreferences,
  canContinue,
} from '../features/onboarding/steps';
import { ApiRequestError, generateApi } from '../lib/api';
import {
  EMPTY_ANSWERS,
  clearPlanDraft,
  loadPlanDraft,
  savePlanDraft,
  type OnboardingAnswers,
} from '../lib/draft';
import { destinationImage } from '../lib/images';
import type { DestinationOption } from '../lib/types';

type Phase = 'steps' | 'discover' | 'crafting' | 'failed';

const REVIEW_STEP = TOTAL_STEPS - 1;

const CRAFTING_LINES = [
  'Reading up on neighborhoods…',
  'Pacing big days against slow ones…',
  'Pricing everything to your budget…',
  'Choosing tables worth booking…',
  'Writing down the why for each pick…',
];

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, y: dir >= 0 ? 28 : -28 }),
  center: { opacity: 1, y: 0 },
  exit: (dir: number) => ({ opacity: 0, y: dir >= 0 ? -28 : 28 }),
};

export function Plan() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('steps');
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [options, setOptions] = useState<DestinationOption[] | null>(null);
  const [seenDestinations, setSeenDestinations] = useState<string[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [failedTripId, setFailedTripId] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string>('');
  const [craftingLine, setCraftingLine] = useState(0);
  const restored = useRef(false);

  /* ----- restore + persist the draft so the session can be resumed ----- */
  useEffect(() => {
    const draft = loadPlanDraft();
    if (draft) {
      setAnswers(draft.answers);
      setStep(Math.min(draft.step, REVIEW_STEP));
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (restored.current) {
      savePlanDraft(step, answers);
    }
  }, [step, answers]);

  /* ----------------------- crafting copy rotation ----------------------- */
  useEffect(() => {
    if (phase !== 'crafting') return;
    const timer = setInterval(
      () => setCraftingLine((line) => (line + 1) % CRAFTING_LINES.length),
      3200,
    );
    return () => clearInterval(timer);
  }, [phase]);

  const update = useCallback((patch: Partial<OnboardingAnswers>) => {
    setAnswers((current) => ({ ...current, ...patch }));
  }, []);

  function goTo(next: number) {
    setDirection(next >= step ? 1 : -1);
    setStep(next);
  }

  /* ------------------------------ generation ----------------------------- */

  async function craft(destination?: string) {
    setPhase('crafting');
    try {
      const preferences = buildPreferences(answers, destination);
      // Drafting runs as a background job — this returns in well under a
      // second, and the itinerary page shows the calm waiting state while
      // polling for completion (resilient to closing the tab).
      const { tripId } = await generateApi.itinerary(preferences);
      clearPlanDraft();
      navigate(`/itinerary/${tripId}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : 'We couldn’t finish drafting this itinerary. Please try again in a moment.';
      const tripId =
        err instanceof ApiRequestError &&
        typeof err.data === 'object' &&
        err.data !== null &&
        'tripId' in err.data &&
        typeof err.data.tripId === 'string'
          ? err.data.tripId
          : null;
      setFailureMessage(message);
      setFailedTripId(tripId);
      setPhase('failed');
    }
  }

  async function retryCraft() {
    if (!failedTripId) {
      void craft(answers.destinationKnown ? undefined : answers.destination || undefined);
      return;
    }
    setPhase('crafting');
    try {
      const { tripId } = await generateApi.retryItinerary(failedTripId);
      clearPlanDraft();
      navigate(`/itinerary/${tripId}`, { replace: true });
    } catch (err) {
      setFailureMessage(
        err instanceof ApiRequestError
          ? err.message
          : 'Still no luck — give it another moment and try again.',
      );
      setPhase('failed');
    }
  }

  async function discover(reset: boolean) {
    setPhase('discover');
    setOptions(null);
    setDiscoverError(null);
    const exclude = reset ? [] : seenDestinations;
    try {
      const { options: found } = await generateApi.destinations(
        buildPreferences(answers),
        exclude,
      );
      setOptions(found);
      setSeenDestinations([...exclude, ...found.map((option) => option.name)]);
    } catch (err) {
      setDiscoverError(
        err instanceof ApiRequestError
          ? err.message
          : 'We couldn’t gather destination ideas just now. Please try again.',
      );
    }
  }

  function handleContinue() {
    if (step < REVIEW_STEP) {
      goTo(step + 1);
      return;
    }
    // Review submit
    if (answers.destinationKnown) {
      void craft();
    } else {
      void discover(true);
    }
  }

  function chooseDestination(option: DestinationOption) {
    const label = `${option.name}, ${option.country}`;
    update({ destination: label });
    void craft(label);
  }

  /* -------------------------------- render ------------------------------- */

  if (phase === 'crafting') {
    return (
      <main className="grid min-h-screen bg-background lg:grid-cols-12">
        <div className="flex flex-col justify-center px-6 py-16 md:px-12 lg:col-span-7 lg:px-24">
          <p className="kicker-accent">Drafting your days</p>
          <h1 className="mt-4 max-w-xl font-display text-display-lg [text-wrap:balance]">
            {answers.destinationKnown || answers.destination
              ? `Sketching ${(answers.destination || 'your trip').split(',')[0]}…`
              : 'Sketching your trip…'}
          </h1>
          <div className="mt-10 flex items-center gap-4">
            <Spinner size="lg" />
            <AnimatePresence mode="wait">
              <motion.p
                key={craftingLine}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="font-display text-lg italic text-text-muted"
              >
                {CRAFTING_LINES[craftingLine]}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="mt-14 max-w-sm border-l-2 border-border pl-4 font-body text-body-sm text-text-muted">
            This usually takes under a minute. Every stop will come with the reason it made the
            cut.
          </p>
        </div>
        <div className="relative hidden lg:col-span-5 lg:block">
          <TravelImage
            src={
              answers.destination
                ? destinationImage(answers.destination)
                : destinationImage('somewhere')
            }
            alt="On the way"
            fallbackSeed="crafting"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
        </div>
      </main>
    );
  }

  if (phase === 'failed') {
    return (
      <main className="flex min-h-screen flex-col bg-background px-6 py-6 md:px-12">
        <Link to="/dashboard" className="font-display text-2xl italic tracking-tight">
          Roam
        </Link>
        <div className="my-auto max-w-xl py-16">
          <p className="kicker">A small hitch</p>
          <h1 className="mt-4 font-display text-display-md [text-wrap:balance]">
            The draft didn’t come together.
          </h1>
          <p className="mt-4 font-body text-body text-text-muted">{failureMessage}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button onClick={() => void retryCraft()}>Try again</Button>
            <Button variant="ghost" onClick={() => setPhase('steps')}>
              Back to my answers
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'discover') {
    return (
      <main className="min-h-screen bg-background px-6 py-6 md:px-12 lg:px-24">
        <div className="flex items-baseline justify-between">
          <Link to="/dashboard" className="font-display text-2xl italic tracking-tight">
            Roam
          </Link>
          <button
            type="button"
            onClick={() => setPhase('steps')}
            className="font-body text-body-sm text-text-muted hover:text-text-primary"
          >
            ← Back to my answers
          </button>
        </div>

        <div className="mt-14 max-w-3xl">
          <p className="kicker-accent">A few places that fit</p>
          <h1 className="mt-3 font-display text-display-lg [text-wrap:balance]">
            Where should we point the compass?
          </h1>
          <p className="mt-3 font-body text-body text-text-muted">
            Each of these was picked for your answers — the pace, the company, the budget.
          </p>
        </div>

        {options === null && !discoverError && (
          <div className="mt-16 flex items-center gap-4">
            <Spinner size="lg" />
            <p className="font-display text-lg italic text-text-muted">
              Shortlisting places that match…
            </p>
          </div>
        )}

        {discoverError && (
          <div className="mt-12 max-w-xl">
            <p className="border-l-2 border-accent bg-accent-muted/15 px-4 py-3 font-body text-body-sm text-accent-hover">
              {discoverError}
            </p>
            <Button className="mt-6" onClick={() => void discover(false)}>
              Try again
            </Button>
          </div>
        )}

        {options && (
          <>
            <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {options.map((option, i) => (
                <motion.button
                  key={`${option.name}-${i}`}
                  type="button"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => chooseDestination(option)}
                  className={`group block text-left focus-visible:focus-ring ${i % 2 === 1 ? 'lg:mt-10' : ''}`}
                >
                  <div className="overflow-hidden">
                    <TravelImage
                      src={destinationImage(`${option.name}, ${option.country}`)}
                      alt={`${option.name}, ${option.country}`}
                      fallbackSeed={option.name}
                      className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]"
                    />
                  </div>
                  <p className="kicker mt-4">{option.country}</p>
                  <h2 className="mt-1 font-display text-display-sm transition-colors group-hover:text-accent">
                    {option.name}
                  </h2>
                  <p className="mt-2 font-body text-body-sm text-text-muted">{option.rationale}</p>
                  <p className="mt-3 font-body text-body-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    Draft this trip →
                  </p>
                </motion.button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void discover(false)}
              className="mt-12 font-body text-body-sm text-text-muted underline decoration-border-strong underline-offset-4 hover:text-text-primary"
            >
              None of these — show me different places
            </button>
          </>
        )}
      </main>
    );
  }

  /* ------------------------------ steps phase ----------------------------- */

  const isReview = step === REVIEW_STEP;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Top bar: back / progress / save & exit */}
      <div className="flex items-center justify-between px-6 py-5 md:px-12">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            className="font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
          >
            ← Back
          </button>
        ) : (
          <Link
            to="/dashboard"
            className="font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
          >
            ← Your journeys
          </Link>
        )}
        <ProgressDots total={TOTAL_STEPS} current={step} />
        <Link
          to="/dashboard"
          className="font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
        >
          Save & exit
        </Link>
      </div>

      {/* Step body */}
      <div className="flex flex-1 items-start px-6 py-10 md:items-center md:px-12 lg:px-24">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {step === 0 && <StepDestination answers={answers} update={update} />}
            {step === 1 && <StepVibe answers={answers} update={update} />}
            {step === 2 && <StepDuration answers={answers} update={update} />}
            {step === 3 && <StepBudget answers={answers} update={update} />}
            {step === 4 && <StepCompanions answers={answers} update={update} />}
            {step === 5 && <StepFood answers={answers} update={update} />}
            {step === 6 && <StepInterests answers={answers} update={update} />}
            {step === 7 && <StepReview answers={answers} onEdit={goTo} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-border/70 px-6 py-5 md:px-12">
        <p className="hidden font-body text-body-sm text-text-muted sm:block">
          {isReview
            ? 'Your answers are saved as you go.'
            : `Question ${step + 1} of ${TOTAL_STEPS - 1}`}
        </p>
        <Button
          onClick={handleContinue}
          disabled={!canContinue(step, answers)}
          className="min-w-[200px] px-8 py-3"
        >
          {isReview
            ? answers.destinationKnown
              ? 'Draft my itinerary'
              : 'Find my destination'
            : 'Continue'}
        </Button>
      </div>
    </main>
  );
}
