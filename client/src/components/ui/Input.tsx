import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-body-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border border-border bg-background px-4 py-2.5',
            'font-body text-body text-text-primary placeholder:text-text-muted/70',
            'shadow-soft-inner transition-all duration-200 ease-soft',
            'hover:border-border-strong',
            'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-accent focus-visible:border-accent focus-visible:ring-accent/25',
            className,
          )}
          {...props}
        />
        {error && (
          <p role="alert" className="text-body-sm text-accent">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
