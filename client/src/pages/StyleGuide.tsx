import { type ReactNode } from 'react';
import { Badge, Button, Card, CardDescription, CardTitle, FadeInUp, Input, LoadingOverlay, Spinner } from '../components/ui';

const colorSwatches = [
  { name: 'background', token: 'bg-background', hex: '#F6F1E8', description: 'Warm ivory page background' },
  { name: 'surface', token: 'bg-surface', hex: '#EBE3D6', description: 'Sand/beige cards & panels' },
  { name: 'primary', token: 'bg-primary', hex: '#3A2A1E', description: 'Espresso — text & primary buttons' },
  { name: 'accent', token: 'bg-accent', hex: '#B8674A', description: 'Terracotta — CTAs & highlights' },
  { name: 'secondary-accent', token: 'bg-secondary-accent', hex: '#718264', description: 'Sage — tags & success' },
  { name: 'text-muted', token: 'bg-text-muted', hex: '#7A6B5C', description: 'Muted body copy' },
  { name: 'border', token: 'bg-border', hex: '#D9CEBF', description: 'Warm dividers & outlines' },
];

const typeScale = [
  { label: 'Display XL', className: 'font-display text-display-xl', sample: 'Wander slowly' },
  { label: 'Display LG (h1)', className: 'font-display text-display-lg', sample: 'Plan with intention' },
  { label: 'Display MD (h2)', className: 'font-display text-display-md', sample: 'Your next chapter' },
  { label: 'Display SM (h3)', className: 'font-display text-display-sm', sample: 'Morning in Lisbon' },
  { label: 'Body LG', className: 'font-body text-body-lg', sample: 'A calm space to sketch the trip you actually want.' },
  { label: 'Body', className: 'font-body text-body', sample: 'Notes, places, and small discoveries along the way.' },
  { label: 'Body SM', className: 'font-body text-body-sm', sample: 'Secondary details and supporting copy.' },
  { label: 'Caption', className: 'font-body text-caption uppercase', sample: 'Travel journal' },
];

function Section({
  title,
  description,
  children,
  delay = 0,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <FadeInUp delay={delay} className="space-y-6">
      <div>
        <h2>{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-text-muted">{description}</p>}
      </div>
      {children}
    </FadeInUp>
  );
}

function Swatch({ name, token, hex, description }: (typeof colorSwatches)[number]) {
  const isDark = name === 'primary';

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-soft">
      <div className={`h-24 ${token} ${isDark ? 'border-b border-border' : ''}`} />
      <div className="space-y-1 p-4">
        <p className="font-body text-body-sm font-medium text-text-primary">{name}</p>
        <p className="font-body text-caption text-text-muted">{hex}</p>
        <p className="font-body text-body-sm text-text-muted">{description}</p>
      </div>
    </div>
  );
}

export function StyleGuide() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16 md:px-10 md:py-20">
        <FadeInUp>
          <p className="font-body text-caption uppercase tracking-[0.12em] text-text-muted">
            Roam design system · Phase 2
          </p>
          <h1 className="mt-3 max-w-3xl">Style guide</h1>
          <p className="mt-4 max-w-2xl text-text-muted">
            Fraunces &amp; Sora · warm ivory, espresso, terracotta, and sage. Review everything here
            before we apply it to real pages.
          </p>
        </FadeInUp>

        <div className="mt-16 space-y-20">
          <Section
            title="Typography"
            description="Fraunces for editorial headings. Sora for readable body text, labels, and buttons."
            delay={0.05}
          >
            <div className="space-y-8 rounded-2xl border border-border bg-surface/50 p-6 md:p-8">
              {typeScale.map((item) => (
                <div key={item.label} className="border-b border-border/60 pb-6 last:border-0 last:pb-0">
                  <p className="mb-3 font-body text-caption uppercase tracking-wide text-text-muted">
                    {item.label}
                  </p>
                  <p className={item.className}>{item.sample}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Color palette"
            description="Semantic tokens defined in tailwind.config.js — reuse these, not one-off hex values."
            delay={0.1}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colorSwatches.map((swatch) => (
                <Swatch key={swatch.name} {...swatch} />
              ))}
            </div>
          </Section>

          <Section title="Buttons" description="Soft hover shifts and a gentle press scale." delay={0.15}>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
          </Section>

          <Section title="Cards" description="Base surface for onboarding and itinerary blocks later." delay={0.2}>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardTitle>Weekend in the hills</CardTitle>
                <CardDescription>
                  A slow itinerary with room to wander — markets, viewpoints, and one long lunch.
                </CardDescription>
              </Card>
              <Card padding="lg">
                <CardTitle>Travel vibes</CardTitle>
                <CardDescription className="mb-4">
                  Tags and mood labels use the sage secondary accent.
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge>Slow travel</Badge>
                  <Badge variant="clay">Food-first</Badge>
                  <Badge variant="neutral">Draft</Badge>
                </div>
              </Card>
            </div>
          </Section>

          <Section title="Inputs" description="Warm focus ring in terracotta — no default blue outline." delay={0.25}>
            <div className="grid max-w-md gap-6">
              <Input label="Destination" placeholder="Where are you dreaming of?" />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                defaultValue="not-an-email"
                error="Please enter a valid email address"
              />
            </div>
          </Section>

          <Section title="Badges" description="Pill tags for interests, vibes, and status." delay={0.3}>
            <div className="flex flex-wrap gap-2">
              <Badge>Culture</Badge>
              <Badge variant="clay">Coastal</Badge>
              <Badge variant="neutral">Archived</Badge>
            </div>
          </Section>

          <Section
            title="Loading"
            description="Soft pulsing dots — calm, not a spinning wheel."
            delay={0.35}
          >
            <Card className="max-w-sm">
              <LoadingOverlay label="Gathering inspiration" />
            </Card>
            <div className="mt-4 flex items-center gap-6">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
            </div>
          </Section>

          <Section
            title="Motion"
            description="FadeInUp wrapper for page and section entrances."
            delay={0.4}
          >
            <FadeInUp delay={0.1}>
              <Card>
                <CardTitle>Animated entrance</CardTitle>
                <CardDescription>
                  This card uses the reusable FadeInUp component from framer-motion.
                </CardDescription>
              </Card>
            </FadeInUp>
          </Section>
        </div>
      </div>
    </div>
  );
}
