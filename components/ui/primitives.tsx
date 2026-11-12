'use client';

import * as React from 'react';
import {cva, type VariantProps} from 'class-variance-authority';
import {Loader2} from 'lucide-react';
import {cn} from '@/lib/utils';

/* ------------------------------ Button ------------------------------ */

const buttonStyles = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background,border-color,color,transform,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'bg-gold text-[#1b1305] shadow-[0_14px_34px_-16px_rgba(231,178,95,0.75)] hover:bg-gold-soft active:translate-y-px',
        secondary:
          'border border-line bg-surface-3 text-ink hover:border-line-strong hover:bg-surface-2',
        outline:
          'border border-line-strong bg-transparent text-ink hover:bg-surface-2',
        ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
        danger:
          'border border-danger/35 bg-danger/12 text-danger hover:bg-danger/20',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px]',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {variant: 'primary', size: 'md'},
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles({variant, size}), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

/* ------------------------------ Badge ------------------------------ */

const badgeStyles = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-2 text-muted',
        gold: 'border-gold/35 bg-gold/10 text-gold',
        sage: 'border-sage/35 bg-sage/10 text-sage',
        danger: 'border-danger/35 bg-danger/10 text-danger',
      },
    },
    defaultVariants: {tone: 'neutral'},
  }
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>) {
  return <span className={cn(badgeStyles({tone}), className)} {...props} />;
}

/* ------------------------------ Panel ------------------------------ */

export function Panel({
  className,
  quiet,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {quiet?: boolean}) {
  return <div className={cn(quiet ? 'panel-quiet' : 'panel', className)} {...props} />;
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('eyebrow', className)}>{children}</p>;
}

/* ------------------------------ Inputs ------------------------------ */

const fieldStyles =
  'w-full rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-gold/60 focus:outline-none focus-visible:ring-0';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({className, ...props}, ref) {
  return <input ref={ref} className={cn(fieldStyles, className)} {...props} />;
});

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        fieldStyles,
        'cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23aaa69d\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")] bg-[right_0.9rem_center] bg-no-repeat pr-9',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-2', className)}>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-relaxed text-faint">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------ Toggle ------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3 text-left transition-colors hover:border-line-strong"
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-gold' : 'bg-line-strong'
        )}
        aria-hidden
      >
        <span
          className={cn(
            'h-4 w-4 rounded-full bg-canvas transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-faint">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/* ------------------------------ Progress ------------------------------ */

export function ProgressBar({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label ?? 'Tiến trình'}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft transition-[width] duration-300"
        style={{width: `${pct}%`}}
      />
    </div>
  );
}

/* ------------------------------ Misc ------------------------------ */

export function Skeleton({className}: {className?: string}) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-surface-3/80', className)} />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: {value: T; label: string}[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/70 p-1',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'bg-gold/15 text-gold'
                : 'text-muted hover:text-ink'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 truncate font-mono text-lg text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-faint">{icon}</div> : null}
      <p className="font-display text-xl text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
