import { ArrowRight, Banknote, Check, CircleCheck, CreditCard, Minus, Phone, Plus, RotateCcw, Sparkles, Utensils, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShowroomIcon } from '../../components/ProductTile.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, Eyebrow, Spinner } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { scanFeedback } from '../../lib/feedback.js';
import { changeBreakdown, formatDateTime, formatINR, formatTime, paymentMethodLabel, pluralize } from '../../lib/format.js';

const REASONS = ['Wrong size / fit', 'Damaged or defective', 'Not as described', 'Changed my mind', 'Duplicate purchase', 'Other'];

/**
 * Returns on a paid bill: pick items and quantities, choose cash or refund-to-source,
 * see the credit note the server will issue, then process it.
 */
export function ReturnItems({ bill, drawer, onReturned, onClose }) {
  const [qty, setQty] = useState({});
  const [method, setMethod] = useState(bill.paymentChannel === 'razorpay' ? 'original' : 'cash');
  const [reason, setReason] = useState(REASONS[0]);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const items = useMemo(() => Object.entries(qty).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity })), [qty]);
  const returnableItems = bill.items.filter((i) => i.returnableQuantity > 0);

  // Re-quote whenever the selection changes so the cashier always sees the live refund amount.
  useEffect(() => {
    clearTimeout(timer.current);
    if (items.length === 0) {
      setQuote(null);
      setError(null);
      return undefined;
    }
    setQuoting(true);
    timer.current = setTimeout(async () => {
      try {
        const { quote: q } = await api.pos.quoteReturn(bill.transactionId, { items, method, reason });
        setQuote(q);
        setError(null);
      } catch (err) {
        setQuote(null);
        setError(err.message);
      } finally {
        setQuoting(false);
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [items, method, reason, bill.transactionId]);

  const set = (itemId, value, max) => setQty((q) => ({ ...q, [itemId]: Math.max(0, Math.min(max, value)) }));
  const selectAll = () => setQty(Object.fromEntries(returnableItems.map((i) => [i.itemId, i.returnableQuantity])));

  const submit = async (e) => {
    e.preventDefault();
    if (!quote) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.pos.processReturn(bill.transactionId, { items, method, reason });
      scanFeedback('success');
      onReturned(res);
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
          <div className="min-w-0">
            <Eyebrow>Paid bill · returns</Eyebrow>
            <p className="mt-1 font-mono text-[15px] font-semibold text-zinc-900">{bill.invoiceNumber}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
              {bill.customerPhone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" /> {bill.customerPhone}
                </span>
              )}
              <span>
                Paid {formatINR(bill.amountDue)} by {paymentMethodLabel({ method: bill.paymentMethod })}
                {bill.collection ? ` at ${formatTime(bill.collection.collectedAt)}` : bill.paidAt ? ` at ${formatTime(bill.paidAt)}` : ''}
              </span>
              {bill.pointsValue > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <Sparkles className="size-3.5" /> {formatINR(bill.pointsValue, { whole: true })} in points
                </span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900" aria-label="Close bill">
            <X className="size-5" />
          </button>
        </div>

        {!bill.returnable ? (
          <Alert tone="warning" title="Returns closed" className="m-6">
            This bill is past the return window ({formatDateTime(bill.returnWindowClosesAt)}).
          </Alert>
        ) : returnableItems.length === 0 ? (
          <Alert tone="info" title="Nothing left to return" className="m-6">
            Every returnable item on this bill has already been refunded{bill.refunds.length ? ` (${bill.refunds.map((r) => r.creditNoteNumber).join(', ')})` : ''}.
          </Alert>
        ) : (
          <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">Items being returned</p>
                <button type="button" onClick={selectAll} className="text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                  Return everything
                </button>
              </div>
              <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200/80">
                {bill.items.map((item) => {
                  const chosen = qty[item.itemId] ?? 0;
                  const disabled = item.returnableQuantity === 0;
                  return (
                    <li key={item.itemId} className={`flex items-center gap-3 px-4 py-3 ${disabled ? 'opacity-60' : ''}`}>
                      <ShowroomIcon showroomId={item.showroomId} className="size-9" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900">{item.name}</p>
                        <p className="text-xs text-zinc-500">
                          {formatINR(item.unitMrp, { whole: true })} × {item.quantity}
                          {item.returnedQuantity > 0 && ` · ${item.returnedQuantity} already returned`}
                        </p>
                      </div>
                      {item.nonReturnable ? (
                        <Badge tone="neutral">
                          <Utensils className="size-3" /> Food · no returns
                        </Badge>
                      ) : disabled ? (
                        <Badge tone="neutral">Returned</Badge>
                      ) : (
                        <div className="inline-flex items-center rounded-xl bg-zinc-100/80 p-0.5 ring-1 ring-inset ring-zinc-200/60">
                          <Step onClick={() => set(item.itemId, chosen - 1, item.returnableQuantity)} disabled={chosen === 0} label={`Fewer ${item.name}`}>
                            <Minus className="size-3.5" strokeWidth={2.5} />
                          </Step>
                          <span className="w-9 text-center text-sm font-semibold text-zinc-900 tabular-nums">{chosen}</span>
                          <Step onClick={() => set(item.itemId, chosen + 1, item.returnableQuantity)} disabled={chosen >= item.returnableQuantity} label={`More ${item.name}`}>
                            <Plus className="size-3.5" strokeWidth={2.5} />
                          </Step>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-semibold text-zinc-700">Reason</span>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl bg-white px-3 text-sm text-zinc-900 shadow-card ring-1 ring-inset ring-zinc-200 outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend className="text-[13px] font-semibold text-zinc-700">Refund to</legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <MethodChip active={method === 'cash'} onClick={() => setMethod('cash')} icon={Banknote} label="Cash" hint="from your drawer" />
                    <MethodChip
                      active={method === 'original'}
                      onClick={() => setMethod('original')}
                      icon={CreditCard}
                      label="Card / UPI"
                      hint={bill.paymentChannel === 'razorpay' ? 'via Razorpay' : 'paid in cash'}
                      disabled={bill.paymentChannel !== 'razorpay'}
                    />
                  </div>
                </fieldset>
              </div>
            </div>

            <QuotePanel quote={quote} quoting={quoting} count={items.length} method={method} drawerCash={drawer?.cashInDrawer} />
          </div>
        )}

        {error && <Alert tone="error" className="mx-6 mb-4">{error}</Alert>}

        {bill.returnable && returnableItems.length > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50/60 p-4">
            <Button type="submit" size="xl" className="w-full" icon={Check} loading={loading} disabled={!quote || quoting}>
              {quote ? `Accept return — ${method === 'cash' ? 'hand back' : 'refund'} ${formatINR(quote.summary.refundAmount)}` : 'Choose items to return'}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function QuotePanel({ quote, quoting, count, method, drawerCash }) {
  if (count === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center">
        <div>
          <RotateCcw className="mx-auto size-6 text-zinc-300" />
          <p className="mt-2 text-sm font-semibold text-zinc-400">Refund to give</p>
          <p className="mt-1 text-xs text-zinc-400">Pick the items the customer is returning</p>
        </div>
      </div>
    );
  }
  if (!quote) {
    return (
      <div className="grid place-items-center rounded-2xl bg-zinc-50 p-6 text-zinc-400">
        <Spinner className="size-5" />
      </div>
    );
  }
  const s = quote.summary;
  return (
    <div className={`flex flex-col justify-center rounded-2xl bg-brand-50/70 p-5 ring-1 ring-inset ring-brand-200/70 transition ${quoting ? 'opacity-60' : ''}`}>
      <p className="text-sm font-semibold text-brand-900">{method === 'cash' ? 'Cash to hand back' : 'Refund to card / UPI'}</p>
      <p key={s.refundAmount} className="mt-1 text-[40px] font-semibold leading-none tracking-tight text-brand-700 tabular-nums animate-pop">
        {formatINR(s.refundAmount)}
      </p>
      <dl className="mt-4 space-y-1.5 text-[12.5px] text-brand-900/80">
        <div className="flex justify-between">
          <dt>{pluralize(s.units, 'item')} · value incl. GST</dt>
          <dd className="tabular-nums">{formatINR(s.grandTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>GST credited (CGST + SGST)</dt>
          <dd className="tabular-nums">{formatINR(s.totalTax)}</dd>
        </div>
        {s.pointsReturned > 0 && (
          <div className="flex justify-between">
            <dt>Back as points instead of cash</dt>
            <dd className="tabular-nums">{s.pointsReturned} pts</dd>
          </div>
        )}
        {s.pointsReversed > 0 && (
          <div className="flex justify-between">
            <dt>Points earned on these, reversed</dt>
            <dd className="tabular-nums">−{s.pointsReversed} pts</dd>
          </div>
        )}
      </dl>
      {method === 'cash' && s.refundAmount > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {changeBreakdown(s.refundAmount).map((n) => (
            <span key={n.value} className="rounded-lg bg-white px-2 py-1 text-[12px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200/70 tabular-nums">
              ₹{n.value} × {n.count}
            </span>
          ))}
        </div>
      )}
      {method === 'cash' && drawerCash != null && s.refundAmount > drawerCash && (
        <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200/70">
          Your drawer only holds {formatINR(drawerCash)}. Refund to card / UPI instead, or top up the drawer.
        </p>
      )}
      <p className="mt-3 text-[11.5px] text-brand-900/60">{quote.refundStatusAfter === 'full' ? 'This completes the return of the whole bill.' : 'The rest of the bill stays as it is.'}</p>
    </div>
  );
}

/** Shown right after a return is processed so the cashier hands back the right cash. */
export function ReturnedCard({ result, onNext }) {
  const { creditNote } = result;
  const cash = creditNote.method === 'cash';
  const notes = cash ? changeBreakdown(creditNote.summary.refundAmount) : [];
  return (
    <Card className="overflow-hidden animate-fade-up">
      <div className="flex flex-col items-center bg-brand-50/70 px-6 py-10 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-brand-500 text-white shadow-brand animate-pop">
          <CircleCheck className="size-7" />
        </div>
        <p className="mt-4 text-sm font-semibold text-brand-900">
          Credit note {creditNote.creditNoteNumber} · {pluralize(creditNote.summary.units, 'item')} back in stock
        </p>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-brand-700/70">{cash ? 'Hand back to customer' : 'Refunded to card / UPI'}</p>
        <p className="mt-1 text-6xl font-semibold tracking-tight text-brand-700 tabular-nums">{formatINR(creditNote.summary.refundAmount)}</p>
        {notes.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {notes.map((n) => (
              <span key={n.value} className="rounded-lg bg-white px-2.5 py-1 text-[13px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200/70 tabular-nums">
                ₹{n.value} × {n.count}
              </span>
            ))}
          </div>
        )}
        {!cash && creditNote.gateway?.refundId && <p className="mt-3 font-mono text-[12px] text-brand-900/60">Gateway ref. {creditNote.gateway.refundId}</p>}
        {creditNote.summary.pointsReturned > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12.5px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/70">
            <Sparkles className="size-3.5 text-amber-500" /> {creditNote.summary.pointsReturned} points credited back to the customer
          </p>
        )}
        <Button variant="dark" size="lg" className="mt-8" iconRight={ArrowRight} onClick={onNext} autoFocus>
          Next customer
        </Button>
      </div>
    </Card>
  );
}

const Step = ({ children, label, ...props }) => (
  <button
    type="button"
    aria-label={label}
    className="grid size-8 place-items-center rounded-[10px] bg-white text-zinc-700 shadow-card ring-1 ring-zinc-900/5 transition hover:text-zinc-900 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
    {...props}
  >
    {children}
  </button>
);

const MethodChip = ({ active, onClick, icon: Icon, label, hint, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-brand-500 bg-brand-50/60 shadow-[0_0_0_3px_rgb(0_102_255/0.12)]' : 'border-zinc-200/80 bg-white hover:border-zinc-300'}`}
  >
    <Icon className={`size-4 ${active ? 'text-brand-600' : 'text-zinc-500'}`} />
    <span className="min-w-0">
      <span className="block text-[13px] font-semibold text-zinc-900">{label}</span>
      <span className="block text-[11px] text-zinc-500">{hint}</span>
    </span>
  </button>
);
