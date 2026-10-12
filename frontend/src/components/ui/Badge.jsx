import { GST_TONES } from '../../lib/catalogMeta.js';

const TONES = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-500/10',
  brand: 'bg-brand-50 text-brand-700 ring-brand-500/15',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  dark: 'bg-zinc-900 text-white ring-zinc-900',
};

const DOTS = {
  neutral: 'bg-zinc-400',
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  dark: 'bg-white',
};

export function Badge({ tone = 'neutral', dot = false, pulse = false, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${DOTS[tone]}`} />}
          <span className={`relative inline-flex size-1.5 rounded-full ${DOTS[tone]}`} />
        </span>
      )}
      {children}
    </span>
  );
}

export const GstTag = ({ rate, className = '' }) => (
  <span
    className={`inline-flex items-center rounded-md px-1.5 py-px font-mono text-[10.5px] font-semibold tracking-tight ring-1 ring-inset ${GST_TONES[rate] ?? TONES.neutral} ${className}`}
  >
    GST {rate}%
  </span>
);

const STATUS = {
  paid: { tone: 'success', label: 'Paid' },
  awaiting_payment: { tone: 'warning', label: 'Pay cash at desk' },
};

export const TransactionStatusBadge = ({ status, className = '' }) => {
  const s = STATUS[status] ?? { tone: 'neutral', label: status };
  return (
    <Badge tone={s.tone} dot pulse={status === 'awaiting_payment'} className={className}>
      {s.label}
    </Badge>
  );
};
