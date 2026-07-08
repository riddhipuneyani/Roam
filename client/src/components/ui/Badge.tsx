import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type BadgeVariant = 'sage' | 'clay' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  sage: 'bg-secondary-accent-muted/35 text-secondary-accent-hover border-secondary-accent/20',
  clay: 'bg-accent-muted/30 text-accent-hover border-accent/20',
  neutral: 'bg-surface text-text-muted border-border',
};

export function Badge({
  className,
  variant = 'sage',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1',
        'font-body text-caption font-medium tracking-wide',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
