import { ArrowRight, Check, CircleCheck, Phone, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, Eyebrow } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { scanFeedback } from '../../lib/feedback.js';
import { changeBreakdown, formatINR, formatTime, paymentMethodLabel, pluralize } from '../../lib/format.js';
import { AmountInput } from './AmountInput.jsx';

/** Suggested "customer handed over" amounts: exact, then the next round notes. */
const quickAmounts = (due) => {
  const options = [due, ...[100, 500, 1000, 2000, 5000].map((step) => Math.ceil(due / step) * step)];
  return [...new Set(options)].filter((v) => v >= due).slice(0, 4);
};

/** The heart of the desk: amount due → cash received → change to return. */
export function CollectCash({ bill, onCollected, onClose }) {
  const [received, setReceived] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const due = bill.amountDue;
  const amount = received === '' ? null : Number(received);
  const change = amount === null ? null : Math.round((amount - due) * 100) / 100;
  const quick = useMemo(() => quickAmounts(due), [due]);

  if (bill.status === 'paid') {
    return (
      <Card className="p-6 animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <BillMeta bill={bill} />
          <CloseButton onClick={onClose} />
        </div>
        <Alert tone="info" title="Nothing to collect" className="mt-5">
          This bill is already paid ({paymentMethodLabel({ method: bill.paymentMethod })}
          {bill.collection ? ` at ${formatTime(bill.collection.collectedAt)}` : ''}).
        </Alert>
      </Card>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (change === null || change < 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.pos.collect(bill.transactionId, amount);
      scanFeedback('success');
      onCollected(res);
    } catch (err) {
      scanFeedback('error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden animate-fade-up">
      <form onSubmit={submit}>
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <BillMeta bill={bill} />
          <CloseButton onClick={onClose} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 p-6 md:grid-cols-2">
          <div>
            <Eyebrow>Amount due</Eyebrow>
            <p className="mt-1 text-[44px] font-semibold leading-none tracking-tight text-zinc-900 tabular-nums">{formatINR(due)}</p>

            <div className="mt-6">
              <AmountInput label="Cash received from customer" value={received} onChange={setReceived} autoFocus />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quick.map((v, i) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setReceived(String(v))}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-200 tabular-nums"
                >
                  {i === 0 ? 'Exact' : formatINR(v, { whole: true })}
                </button>
              ))}
            </div>
          </div>

          <ChangePanel change={change} />
        </div>

        {error && <Alert tone="error" className="mx-6 mb-4">{error}</Alert>}

        <div className="border-t border-zinc-100 bg-zinc-50/60 p-4">
          <Button type="submit" variant="success" size="xl" className="w-full" icon={Check} loading={loading} disabled={change === null || change < 0}>
            {change !== null && change >= 0 ? `Cash received — return ${formatINR(change)}` : 'Enter cash received'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Big, unmissable "change to return" with a suggested note/coin split. */
function ChangePanel({ change }) {
  if (change === null) {
    return (
      <div className="grid place-items-center rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-zinc-400">Change to return</p>
          <p className="mt-1 text-xs text-zinc-400">Enter the cash the customer handed over</p>
        </div>
      </div>
    );
  }
  if (change < 0) {
    return (
      <div className="flex flex-col justify-center rounded-2xl bg-red-50 p-6 ring-1 ring-inset ring-red-200 animate-fade-in">
        <p className="text-sm font-semibold text-red-700">Not enough cash</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-red-600 tabular-nums">{formatINR(-change)}</p>
        <p className="mt-2 text-sm text-red-700/80">more is needed from the customer</p>
      </div>
    );
  }
  const notes = changeBreakdown(change);
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-emerald-50 p-6 ring-1 ring-inset ring-emerald-200 animate-fade-in">
      <p className="text-sm font-semibold text-emerald-800">Change to return</p>
      <p key={change} className="mt-1 text-[44px] font-semibold leading-none tracking-tight text-emerald-600 tabular-nums animate-pop">
        {formatINR(change)}
      </p>
      {notes.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {notes.map((n) => (
            <span key={n.value} className="rounded-lg bg-white px-2 py-1 text-[12.5px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 tabular-nums">
              ₹{n.value} × {n.count}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-emerald-800/80">Exact amount — no change needed.</p>
      )}
    </div>
  );
}

/** Shown right after a successful collection so the cashier hands back the right change. */
export function CollectedCard({ result, onNext }) {
  const notes = changeBreakdown(result.change);
  return (
    <Card className="overflow-hidden animate-fade-up">
      <div className="flex flex-col items-center bg-emerald-50 px-6 py-10 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-emerald-500 text-white shadow-success animate-pop">
          <CircleCheck className="size-7" />
        </div>
        <p className="mt-4 text-sm font-semibold text-emerald-800">
          Bill {result.bill.invoiceNumber} paid · received {formatINR(result.bill.collection.received)}
        </p>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700/70">Return to customer</p>
        <p className="mt-1 text-6xl font-semibold tracking-tight text-emerald-600 tabular-nums">{formatINR(result.change)}</p>
        {notes.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {notes.map((n) => (
              <span key={n.value} className="rounded-lg bg-white px-2.5 py-1 text-[13px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 tabular-nums">
                ₹{n.value} × {n.count}
              </span>
            ))}
          </div>
        )}
        <Button variant="dark" size="lg" className="mt-8" iconRight={ArrowRight} onClick={onNext} autoFocus>
          Next customer
        </Button>
      </div>
    </Card>
  );
}

function BillMeta({ bill }) {
  return (
    <div className="min-w-0">
      <Eyebrow>Cash bill</Eyebrow>
      <p className="mt-1 font-mono text-[15px] font-semibold text-zinc-900">{bill.invoiceNumber}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
        {bill.customerPhone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="size-3.5" /> {bill.customerPhone}
          </span>
        )}
        <span>
          {pluralize(bill.units, 'item')} · {pluralize(bill.stores.length, 'store')}
        </span>
        <span>{formatTime(bill.issuedAt)}</span>
      </p>
    </div>
  );
}

const CloseButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
    aria-label="Close bill"
  >
    <X className="size-5" />
  </button>
);
