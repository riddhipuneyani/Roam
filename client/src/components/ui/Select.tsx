import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/** The <select> sibling of Input — identical styling contract, plus a chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-body-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 pr-10',
            'font-body text-body text-text-primary',
            'shadow-soft-inner transition-all duration-200 ease-soft',
            'hover:border-border-strong',
            'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201.5l5%205%205-5%22%20fill%3D%22none%22%20stroke%3D%22%237A6B5C%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')]",
            'bg-[length:12px_8px] bg-[position:right_1rem_center] bg-no-repeat',
            error && 'border-accent focus-visible:border-accent focus-visible:ring-accent/25',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p role="alert" className="text-body-sm text-accent">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
