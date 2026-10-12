import { LoaderCircle } from 'lucide-react';

export const Spinner = ({ className = 'size-4' }) => <LoaderCircle className={`${className} animate-spin`} aria-hidden />;

export const Card = ({ className = '', children, ...props }) => (
  <div className={`rounded-2xl border border-zinc-200/80 bg-white shadow-card ${className}`} {...props}>
    {children}
  </div>
);

export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-lg bg-zinc-200/60 ${className}`} />;

export const Kbd = ({ children }) => (
  <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-500">
    {children}
  </kbd>
);

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-white text-zinc-400 shadow-card ring-1 ring-zinc-200/80">
          <Icon className="size-6" strokeWidth={1.8} />
        </div>
      )}
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-zinc-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Small uppercase eyebrow label used above section headings. */
export const Eyebrow = ({ children, className = '' }) => (
  <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 ${className}`}>{children}</p>
);
