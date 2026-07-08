import { cn } from '../../lib/cn';

type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const sizeStyles: Record<SpinnerSize, { container: string; dot: string }> = {
  sm: { container: 'gap-1', dot: 'h-1.5 w-1.5' },
  md: { container: 'gap-1.5', dot: 'h-2 w-2' },
  lg: { container: 'gap-2', dot: 'h-2.5 w-2.5' },
};

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  const styles = sizeStyles[size];

  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center', styles.container, className)}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'rounded-full bg-accent/70 animate-soft-pulse',
            styles.dot,
          )}
          style={{ animationDelay: `${index * 0.2}s` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingOverlay({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-4">
      <Spinner size="lg" label={label} />
      <p className="animate-gentle-breathe font-body text-body-sm text-text-muted">{label}</p>
    </div>
  );
}
