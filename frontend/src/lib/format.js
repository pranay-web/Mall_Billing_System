const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** ₹1,234.50 — or ₹1,235 with `{ whole: true }` when the value has no paise. */
export const formatINR = (value, { whole = false } = {}) => {
  const n = Number(value) || 0;
  if (whole && Number.isInteger(n)) return inrWhole.format(n);
  return inr.format(n);
};

/** Signed amount for round-off lines: +₹0.50 / −₹0.25. */
export const formatSignedINR = (value) => {
  const n = Number(value) || 0;
  if (n === 0) return inr.format(0);
  return `${n > 0 ? '+' : '−'}${inr.format(Math.abs(n))}`;
};

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '—';

export const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

export const timeAgo = (iso, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

const METHOD_LABELS = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net Banking',
  wallet: 'Wallet',
  emi: 'EMI',
  online: 'Online',
  cash: 'Cash',
};

export const paymentMethodLabel = (payment) => {
  if (!payment) return '—';
  const base = METHOD_LABELS[payment.method] ?? payment.method;
  const d = payment.details;
  if (payment.method === 'upi' && d?.vpa) return `${base} · ${d.vpa}`;
  if (payment.method === 'card' && d?.cardLast4) return `${d.cardNetwork ?? 'Card'} •••• ${d.cardLast4}`;
  return base;
};

export const pluralize = (count, word, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;

/** `+919876543210` → `+91 98765 43210`. */
export const formatPhone = (e164) => {
  const digits = String(e164 ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : e164 ?? '';
};

const NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];

/** Splits an amount of change into Indian notes/coins, largest first: [{ value, count }]. */
export const changeBreakdown = (amount) => {
  let rest = Math.floor(Math.max(0, Number(amount) || 0));
  const out = [];
  for (const value of NOTES) {
    const count = Math.floor(rest / value);
    if (count) {
      out.push({ value, count });
      rest -= count * value;
    }
  }
  return out;
};
