import { navigate } from '../lib/router.js';
import { Logo } from './Logo.jsx';

/** Sticky glass header shared by every surface. */
export function AppHeader({ suffix, center, right, maxWidth = 'max-w-6xl' }) {
  return (
    <header className="glass sticky top-0 z-40 border-b border-zinc-200/70 pt-[env(safe-area-inset-top)] print:hidden">
      <div className={`mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 ${maxWidth}`}>
        <Logo suffix={suffix} onClick={() => navigate('/')} />
        {center && <div className="hidden flex-1 justify-center md:flex">{center}</div>}
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

/** iOS-style segmented control. */
export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl bg-zinc-100/80 p-1 ring-1 ring-inset ring-zinc-200/60">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-current={active ? 'page' : undefined}
            className={`relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition ${active ? 'bg-white text-zinc-900 shadow-card ring-1 ring-zinc-900/5' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            {opt.icon && <opt.icon className="size-3.5" strokeWidth={2.2} />}
            {opt.label}
            {opt.badge ? (
              <span className="ml-0.5 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold leading-4 text-white tabular-nums">{opt.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
