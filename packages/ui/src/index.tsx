import * as React from 'react';

type Div = React.HTMLAttributes<HTMLDivElement>;

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, ...props }: Div) {
  return (
    <div
      className={cx('rounded-xl border border-gray-200 bg-white p-4 shadow-sm', className)}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-brand text-brand-fg hover:opacity-90'
      : 'bg-transparent text-brand hover:bg-brand-muted';
  return <button className={cx(base, styles, className)} {...props} />;
}

// MasteryBadge — maps a PBD-style band to a colour chip.
export function MasteryBadge({ band }: { band: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const map: Record<string, string> = {
    NONE: 'bg-gray-100 text-gray-600',
    LOW: 'bg-red-100 text-red-700',
    MEDIUM: 'bg-amber-100 text-amber-800',
    HIGH: 'bg-green-100 text-green-700',
  };
  return (
    <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', map[band])}>
      {band.toLowerCase()}
    </span>
  );
}

// CitationPill — renders a grounded source reference under a tutor answer.
export function CitationPill({ id, locator }: { id: string; locator?: string | null }) {
  return (
    <span
      title={locator ?? id}
      className="mr-1 inline-flex items-center rounded border border-brand/30 bg-brand-muted px-1.5 py-0.5 text-[11px] text-brand"
    >
      🔗 {id.slice(0, 8)}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      {...props}
    />
  );
}
