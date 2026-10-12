/** Large rupee amount input used across the cash desk. */
export function AmountInput({ value, onChange, label, autoFocus, tone = 'neutral', inputRef, placeholder = '0' }) {
  const ring = tone === 'warning' ? 'ring-amber-300 focus-within:ring-amber-500' : 'ring-zinc-200 focus-within:ring-brand-500';
  return (
    <label className="block">
      {label && <span className="text-[13px] font-semibold text-zinc-700">{label}</span>}
      <span className={`mt-1.5 flex h-14 items-center gap-2 rounded-2xl bg-white px-4 shadow-card ring-1 ring-inset transition focus-within:ring-2 ${ring}`}>
        <span className="text-xl font-semibold text-zinc-400">₹</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1');
            onChange(cleaned);
          }}
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={label}
          className="h-full min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 tabular-nums"
        />
      </span>
    </label>
  );
}
