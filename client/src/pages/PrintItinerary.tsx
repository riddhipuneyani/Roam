import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TravelImage } from '../components/TravelImage';
import { tripsApi } from '../lib/api';
import { destinationImage } from '../lib/images';
import type { ActivitySlot, Trip } from '../lib/types';

/**
 * Print-optimized itinerary, rendered headlessly by the PDF export endpoint.
 * Same palette, faces and voice as the on-screen page, recomposed for A4:
 * a cover page, then one day per page, then the practical closing page.
 * Nothing interactive survives here — no nav, no swap icons, no maps.
 *
 * The root carries data-print-ready once trip data, webfonts and imagery
 * have all settled, which is what Puppeteer waits for.
 */

const SLOT_LABELS: Record<ActivitySlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export function PrintItinerary() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    tripsApi
      .get(tripId)
      .then(({ trip: loaded }) => {
        if (loaded.itinerary) setTrip(loaded);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [tripId]);

  /* Flip the ready flag only after fonts and every image have settled. */
  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(
        images.map(
          (img) =>
            img.complete ||
            new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            }),
        ),
      );
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [trip]);

  if (failed) {
    return <div data-print-ready="true" data-print-failed="true" className="p-10 font-body" />;
  }
  if (!trip?.itinerary) {
    return <div className="p-10 font-body text-body-sm text-text-muted">Setting the type…</div>;
  }

  const itinerary = trip.itinerary;
  const prefs = trip.preferences;

  return (
    <div
      data-print-ready={ready}
      className="print-root bg-background font-body text-[12px] leading-relaxed text-text-primary"
    >
      {/* --------------------------------- cover --------------------------------- */}
      <section className="px-14 pb-10 pt-4">
        <div className="flex items-baseline justify-between pb-4">
          <span className="font-display text-xl italic">Roam</span>
          <span className="kicker !text-[9px]">A journey, set in print</span>
        </div>
        <div className="relative h-[430px] overflow-hidden">
          <TravelImage
            src={destinationImage(itinerary.destination)}
            alt={itinerary.destination}
            fallbackSeed={trip.id}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <p className="kicker !text-[9px] !text-background/80">
              {prefs.duration} days · {prefs.companions} · {prefs.budgetTier}
            </p>
            <h1 className="mt-2 font-display text-[44px] leading-none text-background [text-wrap:balance]">
              {itinerary.destination}
            </h1>
          </div>
        </div>
        <p className="mt-6 max-w-[60ch] font-display text-[15px] italic leading-normal text-text-primary">
          {itinerary.tripSummary}
        </p>
        <div className="mt-6 flex items-baseline gap-6 border-t border-border pt-4">
          <p>
            <span className="kicker !text-[9px]">Estimated budget</span>
            <span className="ml-3 font-body text-[13px] font-medium text-secondary-accent-hover">
              {itinerary.estimatedTotalBudget}
            </span>
          </p>
        </div>
        {/* contents */}
        <div className="mt-8">
          <p className="kicker !text-[9px]">The days ahead</p>
          <div className="mt-3 columns-2 gap-10">
            {itinerary.days.map((day) => (
              <p key={day.dayNumber} className="flex gap-3 border-b border-dotted border-border-strong py-1.5 [break-inside:avoid]">
                <span className="font-display italic text-accent">{day.dayNumber}</span>
                <span className="font-display text-[13px]">{day.theme}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------- days --------------------------------- */}
      {itinerary.days.map((day) => (
        <section key={day.dayNumber} className="print-break px-14 py-6">
          <div className="border-b-2 border-primary pb-3">
            <p className="kicker-accent !text-[9px]">Day {day.dayNumber}</p>
            <h2 className="mt-1 font-display text-[26px] leading-tight [text-wrap:balance]">
              {day.theme}
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-12 gap-6 border-b border-border pb-4">
            <div className="col-span-5">
              <p className="kicker !text-[8px]">Getting around</p>
              <p className="mt-0.5 text-[10.5px] text-text-muted">{day.transport}</p>
            </div>
            <div className="col-span-2">
              <p className="kicker !text-[8px]">Day budget</p>
              <p className="mt-0.5 text-[11px] font-medium text-secondary-accent-hover">
                {day.dailyBudgetEstimate}
              </p>
            </div>
            <div className="col-span-5">
              <p className="kicker !text-[8px]">Worth knowing</p>
              <p className="mt-0.5 font-display text-[10.5px] italic text-text-muted">{day.tip}</p>
            </div>
          </div>

          {(['morning', 'afternoon', 'evening'] as const).map((slot) => {
            const block = day[slot];
            return (
              <div key={slot} className="grid grid-cols-12 gap-5 border-b border-border/70 py-4 [break-inside:avoid]">
                <p className="kicker-accent col-span-2 !text-[9px]">{SLOT_LABELS[slot]}</p>
                <div className="col-span-7">
                  <h3 className="font-display text-[16px] leading-snug">{block.activity}</h3>
                  <p className="mt-1 text-[10.5px] text-text-muted">{block.description}</p>
                  <p className="mt-2 border-l-2 border-accent/70 pl-3 font-display text-[11px] italic leading-normal">
                    {block.why}
                  </p>
                </div>
                <div className="col-span-3 border-l border-border/70 pl-4">
                  <p className="kicker !text-[8px]">Where</p>
                  <p className="mt-0.5 text-[10px]">{block.location}</p>
                  <p className="kicker mt-2 !text-[8px]">Cost</p>
                  <p className="mt-0.5 text-[10px] font-medium text-secondary-accent-hover">
                    {block.estimatedCost}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="pt-4 [break-inside:avoid]">
            <p className="kicker-accent !text-[9px]">At the table</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {day.restaurants.map((restaurant, i) => (
                <div key={`${restaurant.name}-${i}`} className="grain border border-border bg-surface p-3">
                  <h4 className="font-display text-[13px] leading-snug">{restaurant.name}</h4>
                  <p className="kicker mt-1 !text-[7.5px] !tracking-[0.1em]">
                    {restaurant.mealType} · {restaurant.cuisine} · {restaurant.priceRange}
                  </p>
                  <p className="mt-1.5 text-[9.5px] italic leading-normal text-text-muted">
                    {restaurant.why}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ----------------------------- closing spread ----------------------------- */}
      <section className="print-break px-14 py-6">
        <div className="border-b-2 border-primary pb-3">
          <p className="kicker-accent !text-[9px]">Before you go</p>
          <h2 className="mt-1 font-display text-[26px] leading-tight">The practical part</h2>
        </div>

        <div className="mt-5 grid grid-cols-12 gap-8">
          <div className="col-span-4">
            <h3 className="font-display text-[15px]">What to pack</h3>
            <ul className="mt-2 space-y-1.5">
              {itinerary.packingList.map((item) => (
                <li key={item} className="flex items-baseline gap-2 text-[10.5px]">
                  <span className="h-1.5 w-1.5 flex-none border border-border-strong" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-4">
            <h3 className="font-display text-[15px]">Worth knowing</h3>
            <ul className="mt-2 space-y-2">
              {itinerary.practicalTips.map((tip) => (
                <li key={tip} className="flex items-baseline gap-2 text-[10.5px] text-text-muted">
                  <span className="font-display italic leading-none text-accent">*</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-4">
            <h3 className="font-display text-[15px]">Budget at a glance</h3>
            <div className="mt-2 space-y-1.5">
              {itinerary.days.map((day) => (
                <div key={day.dayNumber} className="flex items-baseline justify-between gap-3 border-b border-dotted border-border-strong pb-1">
                  <span className="kicker !text-[8px]">Day {day.dayNumber}</span>
                  <span className="text-[10.5px] [font-variant-numeric:tabular-nums]">
                    {day.dailyBudgetEstimate}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-right text-[11px] font-medium">
                {itinerary.estimatedTotalBudget}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-12 border-t border-border pt-4 text-center font-display text-[13px] italic text-text-muted">
          Planned with Roam — go somewhere that feels like you.
        </p>
      </section>
    </div>
  );
}
