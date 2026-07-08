import { Link, useNavigate } from 'react-router-dom';
import { Button, FadeInUp } from '../components/ui';
import { TravelImage } from '../components/TravelImage';
import { destinationImage, SCENES } from '../lib/images';
import { useAuth } from '../hooks/useAuth';

const SEASON_PICKS = [
  { name: 'Lisbon', country: 'Portugal', note: 'Hills, tiles and the best-value table in Europe' },
  { name: 'Kyoto', country: 'Japan', note: 'Gardens and tea houses built for slow mornings' },
  { name: 'Oaxaca', country: 'Mexico', note: 'Markets, mezcal and mole worth the flight alone' },
  { name: 'Ljubljana', country: 'Slovenia', note: 'A calm riverside capital an hour from the Alps' },
];

const STEPS = [
  {
    n: '01',
    title: 'Answer a few quiet questions',
    body: 'Where — or “surprise me.” How long, what pace, who’s coming, what you like to eat. Two minutes, no forms that feel like forms.',
  },
  {
    n: '02',
    title: 'We draft your days',
    body: 'A complete itinerary — mornings, afternoons, evenings, tables worth booking — with real places, honest prices, and the reason behind every single pick.',
  },
  {
    n: '03',
    title: 'Nudge it until it’s yours',
    body: 'Not feeling the Tuesday museum? Swap that one stop and nothing else moves. The plan bends to you, not the other way around.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  function handlePlanTrip() {
    navigate(isAuthenticated ? '/plan' : '/signup');
  }

  return (
    <main className="min-h-screen bg-background">
      {/* ---------------------------------- hero ---------------------------------- */}
      <section className="relative grid min-h-screen lg:grid-cols-12">
        {/* Left: editorial copy, deliberately off-center */}
        <div className="flex flex-col lg:col-span-7">
          <div className="flex items-baseline justify-between px-6 pt-6 md:px-12 lg:pr-16">
            <span className="font-display text-2xl italic tracking-tight">Roam</span>
            <nav className="flex items-baseline gap-6">
              <Link
                to="/login"
                className="font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="font-body text-body-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                Create an account
              </Link>
            </nav>
          </div>

          <div className="flex flex-1 flex-col justify-center px-6 py-20 md:px-12 lg:pl-16 lg:pr-24 xl:pl-24">
            <FadeInUp>
              <p className="kicker-accent">Travel, planned like a letter — not a form</p>
              <h1 className="mt-5 max-w-2xl font-display text-display-lg md:text-display-xl [text-wrap:balance]">
                Go somewhere that feels like you.
              </h1>
              <p className="mt-6 max-w-xl font-body text-body-lg text-text-muted">
                Tell us the shape of the trip you’re dreaming about — the pace, the people, the
                appetite — and we’ll draft every day of it: real places, honest prices, and the
                reasoning behind each choice.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button onClick={handlePlanTrip} className="px-8 py-3 text-body">
                  Plan your trip
                </Button>
                <a
                  href="#how-it-works"
                  className="font-body text-body-sm text-text-muted underline decoration-border-strong underline-offset-4 transition-colors hover:text-text-primary"
                >
                  How it works
                </a>
              </div>
              <p className="mt-14 max-w-md border-l-2 border-accent/60 pl-4 font-display text-lg italic text-text-muted">
                “The best itineraries don’t feel planned. They feel remembered.”
              </p>
            </FadeInUp>
          </div>
        </div>

        {/* Right: full-bleed photography, sharp-edged, bleeding off the viewport */}
        <div className="relative hidden lg:col-span-5 lg:block">
          <TravelImage
            src={SCENES.landingHero}
            alt="Sunlight falling across a mountain valley"
            fallbackSeed="landing-hero"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent" />
          {/* Offset field-notes photo breaking the frame */}
          <div className="absolute -left-16 bottom-16 w-56 rotate-[-2.5deg] border-8 border-background bg-background shadow-soft-md">
            <TravelImage
              src={SCENES.landingDetail}
              alt="A well-worn map and a film camera"
              fallbackSeed="landing-detail"
              className="h-40 w-full object-cover"
            />
            <p className="px-2 py-2 font-body text-caption uppercase tracking-[0.14em] text-text-muted">
              Field notes, not forms
            </p>
          </div>
        </div>

        {/* Mobile hero image */}
        <div className="relative h-72 lg:hidden">
          <TravelImage
            src={SCENES.landingHero}
            alt="Sunlight falling across a mountain valley"
            fallbackSeed="landing-hero"
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      {/* ------------------------------ how it works ------------------------------ */}
      <section id="how-it-works" className="border-t border-border/70 px-6 py-24 md:px-12 lg:px-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="kicker">How it works</p>
            <h2 className="mt-4 font-display text-display-md [text-wrap:balance]">
              Three steps, none of them tedious
            </h2>
            <p className="mt-4 max-w-sm font-body text-body text-text-muted">
              Planning should feel like the first day of the trip — not the last day of work.
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            {STEPS.map((step) => (
              <FadeInUp key={step.n} className="border-t border-border/70 py-8 first:border-t-0 lg:first:border-t">
                <div className="grid gap-4 sm:grid-cols-12">
                  <span className="font-display text-3xl italic text-accent sm:col-span-2">
                    {step.n}
                  </span>
                  <div className="sm:col-span-10">
                    <h3 className="font-display text-display-sm">{step.title}</h3>
                    <p className="mt-2 max-w-xl font-body text-body text-text-muted">{step.body}</p>
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- pull quote ------------------------------- */}
      <section className="grain border-y border-border/70 bg-surface">
        <div className="px-6 py-20 md:px-12 lg:px-24">
          <div className="max-w-3xl">
            <p className="kicker">Why the “why” matters</p>
            <p className="mt-6 font-display text-display-sm italic leading-snug text-text-primary md:text-display-md">
              Every café, trailhead and table we suggest tells you why it made the cut — how it fits
              your pace, your people, and your budget. No mystery picks.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------- seasonal destinations -------------------------- */}
      <section className="px-6 py-24 md:px-12 lg:px-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker">From recent drafts</p>
            <h2 className="mt-4 font-display text-display-md">Where travelers are going</h2>
          </div>
          <Button variant="secondary" onClick={handlePlanTrip}>
            Start with “surprise me”
          </Button>
        </div>
        <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {SEASON_PICKS.map((pick, i) => (
            <FadeInUp key={pick.name} delay={i * 0.07} className={i % 2 === 1 ? 'lg:mt-12' : ''}>
              <button
                type="button"
                onClick={handlePlanTrip}
                className="group block w-full text-left focus-visible:focus-ring"
              >
                <div className="overflow-hidden">
                  <TravelImage
                    src={destinationImage(`${pick.name}, ${pick.country}`)}
                    alt={`${pick.name}, ${pick.country}`}
                    fallbackSeed={pick.name}
                    className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.03]"
                  />
                </div>
                <p className="kicker mt-4">{pick.country}</p>
                <h3 className="mt-1 font-display text-display-sm group-hover:text-accent">
                  {pick.name}
                </h3>
                <p className="mt-1 font-body text-body-sm text-text-muted">{pick.note}</p>
              </button>
            </FadeInUp>
          ))}
        </div>
      </section>

      {/* ---------------------------------- footer --------------------------------- */}
      <footer className="border-t border-border/70 px-6 py-10 md:px-12 lg:px-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <span className="font-display text-xl italic">Roam</span>
          <p className="font-body text-body-sm text-text-muted">
            Made for people who pack light and read menus for fun.
          </p>
          <div className="flex gap-6">
            <Link to="/login" className="font-body text-body-sm text-text-muted hover:text-text-primary">
              Log in
            </Link>
            <Link to="/signup" className="font-body text-body-sm text-text-muted hover:text-text-primary">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
