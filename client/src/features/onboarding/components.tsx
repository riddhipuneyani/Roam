import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { TravelImage } from '../../components/TravelImage';

/* ------------------------------ progress dots ----------------------------- */

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300 ease-soft',
            i === current ? 'w-6 bg-accent' : i < current ? 'w-1.5 bg-accent/50' : 'w-1.5 bg-border-strong',
          )}
        />
      ))}
    </div>
  );
}

/* -------------------------------- step shell ------------------------------ */

export function StepShell({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <p className="kicker-accent">{kicker}</p>
      <h1 className="mt-3 font-display text-display-md md:text-display-lg [text-wrap:balance]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 max-w-xl font-body text-body text-text-muted">{subtitle}</p>
      )}
      <div className="mt-10">{children}</div>
    </div>
  );
}

/* ---------------------------- image choice tile --------------------------- */

export function ImageTile({
  image,
  label,
  description,
  selected,
  onClick,
  seed,
  aspect = 'aspect-[4/3]',
}: {
  image: string;
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  seed: string;
  aspect?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group relative block w-full overflow-hidden text-left transition-all duration-200 ease-soft focus-visible:focus-ring',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
      )}
    >
      <TravelImage
        src={image}
        alt={label}
        fallbackSeed={seed}
        className={cn(
          aspect,
          'w-full object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]',
          selected && 'scale-[1.02]',
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/15 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="font-display text-xl text-background">{label}</p>
        {description && (
          <p className="mt-0.5 font-body text-caption text-background/80">{description}</p>
        )}
      </div>
      {/* Selection stamp */}
      <span
        className={cn(
          'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200',
          selected
            ? 'rotate-3 border-secondary-accent bg-secondary-accent text-background opacity-100'
            : 'border-background/60 bg-primary/20 text-background/0 opacity-70',
        )}
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 7.5l3 3 6-7" />
        </svg>
      </span>
    </button>
  );
}

/* ----------------------------- text option card --------------------------- */

export function OptionCard({
  title,
  description,
  meta,
  selected,
  onClick,
  icon,
}: {
  title: string;
  description?: string;
  meta?: string;
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'grain relative block w-full border bg-surface p-5 text-left transition-all duration-200 ease-soft focus-visible:focus-ring md:p-6',
        selected
          ? 'border-accent shadow-soft-md'
          : 'border-border hover:border-border-strong hover:shadow-soft',
      )}
    >
      {icon && <div className={cn('mb-4', selected ? 'text-accent' : 'text-text-muted')}>{icon}</div>}
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-display-sm">{title}</span>
        {meta && <span className="kicker whitespace-nowrap">{meta}</span>}
      </div>
      {description && (
        <p className="mt-2 font-body text-body-sm text-text-muted">{description}</p>
      )}
      <span
        className={cn(
          'absolute right-4 top-4 h-2.5 w-2.5 rounded-full transition-all duration-200',
          selected ? 'bg-accent' : 'bg-border',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

/* ---------------------------------- chip ---------------------------------- */

export function Chip({
  label,
  onRemove,
  onClick,
  tone = 'solid',
}: {
  label: string;
  onRemove?: () => void;
  onClick?: () => void;
  tone?: 'solid' | 'outline';
}) {
  const base =
    'inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-body text-body-sm transition-all duration-200 ease-soft';
  if (onRemove) {
    return (
      <span className={cn(base, 'bg-primary text-background')}>
        {label}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="text-background/70 transition-colors hover:text-background"
        >
          ×
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        base,
        tone === 'outline'
          ? 'border border-border bg-transparent text-text-muted hover:border-border-strong hover:text-text-primary'
          : 'bg-surface text-text-primary hover:shadow-soft',
      )}
    >
      + {label}
    </button>
  );
}
