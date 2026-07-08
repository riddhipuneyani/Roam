import { useState, type KeyboardEvent } from 'react';
import { Chip, ImageTile, OptionCard, StepShell } from './components';
import { TravelImage } from '../../components/TravelImage';
import type { OnboardingAnswers } from '../../lib/draft';
import { SCENES, VIBE_IMAGES, destinationImage } from '../../lib/images';
import type { BudgetTier, Companions, TripPreferences, TripVibe } from '../../lib/types';

/* ------------------------------ configuration ----------------------------- */

export const TOTAL_STEPS = 8; // 7 questions + review

export const VIBE_OPTIONS: Array<{ id: TripVibe; label: string; blurb: string }> = [
  { id: 'relaxation', label: 'Relaxation', blurb: 'Slow mornings, long lunches' },
  { id: 'adventure', label: 'Adventure', blurb: 'Trails, water, tired legs' },
  { id: 'culture', label: 'Culture', blurb: 'Museums, markets, old streets' },
  { id: 'romance', label: 'Romance', blurb: 'Golden hours, tables for two' },
  { id: 'food', label: 'Food', blurb: 'Eat first, plan around it' },
  { id: 'family', label: 'Family', blurb: 'Something for every age' },
  { id: 'solo-reset', label: 'Solo reset', blurb: 'Time that belongs to you' },
];

export const BUDGET_TIERS: Array<{
  id: BudgetTier;
  label: string;
  perDay: [number, number];
  blurb: string;
}> = [
  { id: 'budget', label: 'Budget', perDay: [60, 120], blurb: 'Simple stays, street food and markets, free wonders first.' },
  { id: 'comfortable', label: 'Comfortable', perDay: [150, 300], blurb: 'Boutique stays, a proper dinner most nights, the odd splurge.' },
  { id: 'luxury', label: 'Luxury', perDay: [350, 700], blurb: 'Beautiful hotels, chef’s counters, a guide when it counts.' },
];

const COMPANION_OPTIONS: Array<{ id: Companions; label: string; blurb: string; heads: number }> = [
  { id: 'solo', label: 'Just me', blurb: 'Your pace, your rules', heads: 1 },
  { id: 'partner', label: 'With a partner', blurb: 'Two seats, one window', heads: 2 },
  { id: 'friends', label: 'With friends', blurb: 'Group chat, realized', heads: 3 },
  { id: 'family', label: 'With family', blurb: 'All ages aboard', heads: 4 },
];

const FOOD_OPTIONS = [
  'Street food & markets',
  'A few special dinners',
  'Café culture',
  'Seafood',
  'Vegetarian-friendly',
  'Local classics',
  'Sweet tooth',
  'No fuss — anything good',
];

const INTEREST_SUGGESTIONS = [
  'architecture',
  'photography',
  'hiking',
  'museums',
  'live music',
  'wine',
  'design',
  'history',
  'wellness',
  'bookshops',
];

export function canContinue(step: number, a: OnboardingAnswers): boolean {
  switch (step) {
    case 0:
      return a.destinationKnown === false || (a.destinationKnown === true && a.destination.trim().length > 0);
    case 1:
      return a.vibe.length > 0;
    case 2:
      return a.duration >= 1;
    case 3:
      return a.budgetTier !== null;
    case 4:
      return a.companions !== null;
    case 5:
      return a.foodPreferences.length > 0;
    case 6:
      return true; // interests are optional
    default:
      return true;
  }
}

export function buildPreferences(a: OnboardingAnswers, chosenDestination?: string): TripPreferences {
  const tier = BUDGET_TIERS.find((t) => t.id === a.budgetTier) ?? BUDGET_TIERS[1];
  const midPerDay = (tier.perDay[0] + tier.perDay[1]) / 2;
  const destination = chosenDestination ?? (a.destinationKnown ? a.destination.trim() : null);
  return {
    duration: a.duration,
    budgetTier: tier.id,
    budgetEstimate: Math.round(midPerDay * a.duration),
    destinationKnown: a.destinationKnown === true,
    destination,
    vibe: a.vibe,
    companions: a.companions ?? 'solo',
    foodPreferences: a.foodPreferences,
    customInterests: a.customInterests,
  };
}

interface StepProps {
  answers: OnboardingAnswers;
  update: (patch: Partial<OnboardingAnswers>) => void;
}

/* ------------------------------ 01 destination ----------------------------- */

export function StepDestination({ answers, update }: StepProps) {
  return (
    <StepShell
      kicker="01 · Destination"
      title="Do you already know where?"
      subtitle="Either answer is a good answer."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <ImageTile
            image={SCENES.known}
            seed="known"
            label="I know where I’m going"
            description="Name it, we’ll shape it"
            selected={answers.destinationKnown === true}
            onClick={() => update({ destinationKnown: true })}
            aspect="aspect-[16/10]"
          />
          {answers.destinationKnown === true && (
            <input
              type="text"
              autoFocus
              value={answers.destination}
              onChange={(e) => update({ destination: e.target.value })}
              placeholder="Lisbon, Kyoto, anywhere…"
              aria-label="Destination"
              className="mt-4 w-full border-0 border-b-2 border-border bg-transparent px-1 pb-2 font-display text-display-sm italic placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
            />
          )}
        </div>
        <ImageTile
          image={SCENES.surprise}
          seed="surprise"
          label="Surprise me"
          description="We’ll propose a few places that fit"
          selected={answers.destinationKnown === false}
          onClick={() => update({ destinationKnown: false, destination: '' })}
          aspect="aspect-[16/10]"
        />
      </div>
    </StepShell>
  );
}

/* --------------------------------- 02 vibe -------------------------------- */

export function StepVibe({ answers, update }: StepProps) {
  function toggle(vibe: TripVibe) {
    update({
      vibe: answers.vibe.includes(vibe)
        ? answers.vibe.filter((v) => v !== vibe)
        : [...answers.vibe, vibe],
    });
  }
  return (
    <StepShell
      kicker="02 · The feel of it"
      title="What kind of trip is calling?"
      subtitle="Pick as many as ring true."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {VIBE_OPTIONS.map((option) => (
          <ImageTile
            key={option.id}
            image={VIBE_IMAGES[option.id]}
            seed={option.id}
            label={option.label}
            description={option.blurb}
            selected={answers.vibe.includes(option.id)}
            onClick={() => toggle(option.id)}
          />
        ))}
      </div>
    </StepShell>
  );
}

/* ------------------------------- 03 duration ------------------------------ */

export function StepDuration({ answers, update }: StepProps) {
  const days = answers.duration;
  const label =
    days <= 3 ? 'A long weekend' : days <= 7 ? 'The classic week' : days <= 10 ? 'Room to wander' : 'The full immersion';
  return (
    <StepShell kicker="03 · Time" title="How long do you have?">
      <div className="max-w-2xl">
        <p className="font-display text-[5rem] leading-none text-text-primary md:text-[7rem]">
          {days}
          <span className="ml-3 font-display text-display-sm italic text-text-muted">
            {days === 1 ? 'day' : 'days'}
          </span>
        </p>
        <p className="kicker-accent mt-2">{label}</p>
        <input
          type="range"
          min={2}
          max={14}
          step={1}
          value={days}
          onChange={(e) => update({ duration: Number(e.target.value) })}
          className="roam-range mt-10"
          aria-label="Trip length in days"
        />
        <div className="mt-3 flex justify-between font-body text-caption text-text-muted">
          <span>2 — a quick escape</span>
          <span>7 — one week</span>
          <span>14 — two weeks</span>
        </div>
      </div>
    </StepShell>
  );
}

/* -------------------------------- 04 budget ------------------------------- */

export function StepBudget({ answers, update }: StepProps) {
  const days = answers.duration;
  return (
    <StepShell
      kicker="04 · Money, honestly"
      title="What should it feel like to spend?"
      subtitle="Rough daily figures per person, before flights. Every recommendation will respect this."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {BUDGET_TIERS.map((tier) => (
          <OptionCard
            key={tier.id}
            title={tier.label}
            meta={`$${tier.perDay[0]}–${tier.perDay[1]}/day`}
            description={tier.blurb}
            selected={answers.budgetTier === tier.id}
            onClick={() => update({ budgetTier: tier.id })}
          />
        ))}
      </div>
      {answers.budgetTier && (
        <p className="mt-8 border-l-2 border-secondary-accent pl-4 font-display text-lg italic text-text-muted">
          For {days} days, plan on roughly{' '}
          {(() => {
            const tier = BUDGET_TIERS.find((t) => t.id === answers.budgetTier)!;
            return `$${(tier.perDay[0] * days).toLocaleString()}–$${(tier.perDay[1] * days).toLocaleString()}`;
          })()}{' '}
          per person.
        </p>
      )}
    </StepShell>
  );
}

/* ------------------------------ 05 companions ----------------------------- */

function Heads({ count }: { count: number }) {
  return (
    <svg width="64" height="28" viewBox="0 0 64 28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`translate(${i * 15}, 0)`}>
          <circle cx="7" cy="7" r="4.4" />
          <path d="M1 26c0-5 2.8-8.5 6-8.5s6 3.5 6 8.5" />
        </g>
      ))}
    </svg>
  );
}

export function StepCompanions({ answers, update }: StepProps) {
  return (
    <StepShell kicker="05 · Company" title="Who’s coming along?">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {COMPANION_OPTIONS.map((option) => (
          <OptionCard
            key={option.id}
            title={option.label}
            description={option.blurb}
            selected={answers.companions === option.id}
            onClick={() => update({ companions: option.id })}
            icon={<Heads count={option.heads} />}
          />
        ))}
      </div>
    </StepShell>
  );
}

/* --------------------------------- 06 food -------------------------------- */

export function StepFood({ answers, update }: StepProps) {
  function toggle(item: string) {
    update({
      foodPreferences: answers.foodPreferences.includes(item)
        ? answers.foodPreferences.filter((f) => f !== item)
        : [...answers.foodPreferences, item],
    });
  }
  return (
    <StepShell
      kicker="06 · Appetite"
      title="How do you like to eat when you travel?"
      subtitle="Choose everything that sounds right."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {FOOD_OPTIONS.map((item) => (
          <OptionCard
            key={item}
            title={item}
            selected={answers.foodPreferences.includes(item)}
            onClick={() => toggle(item)}
          />
        ))}
      </div>
    </StepShell>
  );
}

/* ------------------------------- 07 interests ------------------------------ */

export function StepInterests({ answers, update }: StepProps) {
  const [input, setInput] = useState('');

  function add(raw: string) {
    const value = raw.trim().toLowerCase();
    if (!value || answers.customInterests.includes(value)) return;
    update({ customInterests: [...answers.customInterests, value] });
    setInput('');
  }

  function remove(value: string) {
    update({ customInterests: answers.customInterests.filter((i) => i !== value) });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && input === '' && answers.customInterests.length > 0) {
      remove(answers.customInterests[answers.customInterests.length - 1]);
    }
  }

  const remaining = INTEREST_SUGGESTIONS.filter((s) => !answers.customInterests.includes(s));

  return (
    <StepShell
      kicker="07 · The particulars"
      title="Anything you’re especially into?"
      subtitle="Optional — but this is where itineraries get personal."
    >
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-border pb-3 focus-within:border-accent">
          {answers.customInterests.map((interest) => (
            <Chip key={interest} label={interest} onRemove={() => remove(interest)} />
          ))}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => add(input)}
            placeholder={answers.customInterests.length === 0 ? 'Type one and press Enter — “ceramics”, “jazz bars”…' : 'Add another…'}
            aria-label="Add an interest"
            className="min-w-[220px] flex-1 border-0 bg-transparent px-1 py-1.5 font-body text-body placeholder:text-text-muted/60 focus:outline-none"
          />
        </div>
        {remaining.length > 0 && (
          <div className="mt-6">
            <p className="kicker mb-3">Or borrow one of ours</p>
            <div className="flex flex-wrap gap-2">
              {remaining.map((suggestion) => (
                <Chip key={suggestion} label={suggestion} tone="outline" onClick={() => add(suggestion)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </StepShell>
  );
}

/* --------------------------------- review --------------------------------- */

export function StepReview({
  answers,
  onEdit,
}: {
  answers: OnboardingAnswers;
  onEdit: (step: number) => void;
}) {
  const tier = BUDGET_TIERS.find((t) => t.id === answers.budgetTier);
  const companion = COMPANION_OPTIONS.find((c) => c.id === answers.companions);

  const rows: Array<{ label: string; value: string; step: number }> = [
    {
      label: 'Destination',
      value: answers.destinationKnown ? answers.destination : 'Surprise me',
      step: 0,
    },
    {
      label: 'The feel',
      value: answers.vibe.map((v) => VIBE_OPTIONS.find((o) => o.id === v)?.label ?? v).join(', '),
      step: 1,
    },
    { label: 'Time', value: `${answers.duration} days`, step: 2 },
    {
      label: 'Budget',
      value: tier ? `${tier.label} · $${tier.perDay[0]}–${tier.perDay[1]}/day` : '—',
      step: 3,
    },
    { label: 'Company', value: companion?.label ?? '—', step: 4 },
    { label: 'Appetite', value: answers.foodPreferences.join(', ') || '—', step: 5 },
    {
      label: 'Particulars',
      value: answers.customInterests.join(', ') || 'None — keep it classic',
      step: 6,
    },
  ];

  return (
    <StepShell
      kicker="One last look"
      title="Here’s the trip you described."
      subtitle="Change anything — nothing is locked."
    >
      <div className="grid gap-12 lg:grid-cols-12">
        <dl className="lg:col-span-7">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-12 items-baseline gap-3 border-t border-border/70 py-4"
            >
              <dt className="kicker col-span-4 sm:col-span-3">{row.label}</dt>
              <dd className="col-span-6 font-display text-lg sm:col-span-7">{row.value}</dd>
              <div className="col-span-2 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(row.step)}
                  className="font-body text-body-sm text-accent transition-colors hover:text-accent-hover"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </dl>
        <div className="hidden lg:col-span-5 lg:block">
          <TravelImage
            src={
              answers.destinationKnown && answers.destination
                ? destinationImage(answers.destination)
                : SCENES.surprise
            }
            alt={answers.destinationKnown ? answers.destination : 'Somewhere new'}
            fallbackSeed="review"
            className="aspect-[4/5] w-full object-cover"
          />
          <p className="kicker mt-3">
            {answers.destinationKnown && answers.destination
              ? answers.destination
              : 'Destination: to be discovered'}
          </p>
        </div>
      </div>
    </StepShell>
  );
}
