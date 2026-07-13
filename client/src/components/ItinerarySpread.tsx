import { AnimatePresence, motion } from 'framer-motion';
import { Badge, Spinner } from './ui';
import { DayMap } from './DayMap';
import type { ActivityBlock, ActivitySlot, Itinerary, RestaurantRec } from '../lib/types';

/**
 * The magazine day-spreads + closing spread, shared by the owner's
 * itinerary page and the public shared view. When the regeneration
 * handlers are omitted the spread renders fully read-only — no swap
 * icons, no owner controls.
 */

export function parseCost(value: string): number | null {
  const match = value.replace(/,/g, '').match(/[$₹]\s?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

const SLOT_LABELS: Record<ActivitySlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

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

function ActivityCard({
  slot,
  block,
  busy,
  onRegen,
}: {
  slot: ActivitySlot;
  block: ActivityBlock;
  busy: boolean;
  onRegen?: () => void;
}) {
  return (
    <div className="border-t border-border/70 py-7">
      <div className="grid gap-5 md:grid-cols-12">
        <div className="flex items-start justify-between md:col-span-2 md:block">
          <p className="kicker-accent">{SLOT_LABELS[slot]}</p>
          {onRegen && (
            <div className="md:mt-3">
              <RegenButton busy={busy} onClick={onRegen} label={`Swap the ${slot} plan`} />
            </div>
          )}
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

function RestaurantCard({
  restaurant,
  busy,
  onRegen,
}: {
  restaurant: RestaurantRec;
  busy: boolean;
  onRegen?: () => void;
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
          {onRegen && <RegenButton busy={busy} onClick={onRegen} label={`Swap ${restaurant.name}`} />}
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

export interface ItinerarySpreadProps {
  itinerary: Itinerary;
  busySlot?: string | null;
  onRegenActivity?: (dayNumber: number, slot: ActivitySlot) => void;
  onRegenRestaurant?: (dayNumber: number, index: number) => void;
  registerDayRef?: (dayNumber: number, el: HTMLElement | null) => void;
}

export function ItinerarySpread({
  itinerary,
  busySlot = null,
  onRegenActivity,
  onRegenRestaurant,
  registerDayRef,
}: ItinerarySpreadProps) {
  const dayCosts = itinerary.days.map((d) => parseCost(d.dailyBudgetEstimate));
  const maxCost = Math.max(...dayCosts.map((c) => c ?? 0), 1);

  return (
    <>
      {itinerary.days.map((day) => {
        const cost = dayCosts[day.dayNumber - 1];
        return (
          <section
            key={day.dayNumber}
            data-day={day.dayNumber}
            ref={(el) => registerDayRef?.(day.dayNumber, el)}
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

                  <DayMap day={day} />

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
                    onRegen={
                      onRegenActivity ? () => onRegenActivity(day.dayNumber, slot) : undefined
                    }
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
                        onRegen={
                          onRegenRestaurant
                            ? () => onRegenRestaurant(day.dayNumber, i)
                            : undefined
                        }
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
      <section id="closing-spread" className="scroll-mt-16 border-t border-border/70 py-16">
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
      </section>
    </>
  );
}
