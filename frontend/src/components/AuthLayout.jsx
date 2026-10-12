import { ArrowLeft } from 'lucide-react';
import { navigate } from '../lib/router.js';
import { LogoMark } from './Logo.jsx';

/** Split sign-in layout: brand panel on large screens, centred card everywhere. */
export function AuthLayout({ eyebrow, title, subtitle, children, footer, aside }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-zinc-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_20%_10%,#1d4ed8_0%,transparent_60%),radial-gradient(60%_60%_at_90%_90%,rgb(16_185_129/0.35)_0%,transparent_60%)]" aria-hidden />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <button onClick={() => navigate('/')} className="flex w-fit items-center gap-2.5" aria-label="FlashCart home">
            <LogoMark className="size-9" />
            <span className="text-lg font-bold tracking-[-0.03em]">FlashCart</span>
          </button>
          <div className="max-w-md">{aside}</div>
          <p className="text-xs text-white/40">© {new Date().getFullYear()} FlashCart · Smart Mall Billing</p>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <button
          onClick={() => navigate('/')}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" /> Home
        </button>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-fade-up">
          <LogoMark className="mb-8 size-11 lg:hidden" />
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>}
          <h1 className="mt-2 text-[28px] font-semibold leading-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        {footer && <div className="mx-auto w-full max-w-sm pb-2 text-center text-sm text-zinc-500">{footer}</div>}
      </main>
    </div>
  );
}

/** Labelled input with an optional leading adornment, styled like the rest of the app. */
export function Field({ label, hint, leading, trailing, error, id, ...inputProps }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-[13px] font-semibold text-zinc-700">{label}</span>
      <span
        className={`mt-1.5 flex h-12 items-center gap-2.5 rounded-xl bg-white px-3.5 shadow-card ring-1 ring-inset transition focus-within:ring-2 focus-within:ring-brand-500 ${error ? 'ring-red-300' : 'ring-zinc-200'}`}
      >
        {leading}
        <input id={id} className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400" {...inputProps} />
        {trailing}
      </span>
      {hint && <span className="mt-1.5 block text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}
