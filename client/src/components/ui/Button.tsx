import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-background hover:bg-primary-hover active:scale-[0.98] shadow-soft hover:shadow-soft-md',
  secondary:
    'bg-surface text-text-primary border border-border hover:bg-background hover:border-border-strong active:scale-[0.98] shadow-soft-inner',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface/80 active:scale-[0.98]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', type = 'button', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5',
          'font-body text-body-sm font-medium tracking-wide',
          'transition-all duration-200 ease-soft',
          'focus-visible:focus-ring',
          'disabled:pointer-events-none disabled:opacity-45',
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
