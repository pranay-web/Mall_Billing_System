export function LogoMark({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="fc-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3D85FF" />
          <stop offset="1" stopColor="#0052D6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#fc-logo-g)" />
      <path d="M36.5 10 18 36h12l-3 18 19-27H33.5z" fill="#fff" />
    </svg>
  );
}

export function Logo({ suffix, onClick }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-2.5 rounded-xl" aria-label="FlashCart home">
      <LogoMark className="size-8 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span className="flex items-baseline gap-2">
        <span className="text-[17px] font-bold tracking-[-0.03em] text-zinc-900">FlashCart</span>
        {suffix && (
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:inline">{suffix}</span>
        )}
      </span>
    </button>
  );
}
