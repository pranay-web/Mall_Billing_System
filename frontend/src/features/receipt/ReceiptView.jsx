import { ArrowLeft, Banknote, Clock3, Link2, LogIn, MessageCircle, Printer, ReceiptText, RefreshCw, RotateCcw, ScanLine, Share2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from '../../components/AppHeader.jsx';
import { Barcode } from '../../components/Barcode.jsx';
import { TransactionStatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, Eyebrow, Skeleton } from '../../components/ui/misc.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, formatINR, formatPhone, formatSignedINR, formatTime, paymentMethodLabel, pluralize } from '../../lib/format.js';
import { absoluteUrl, navigate } from '../../lib/router.js';

const POLL_MS = 4000;

export default function ReceiptView({ transactionId, shareToken = null }) {
  const { customer } = useShop();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();
  const lastStatus = useRef(null);
  const shared = Boolean(shareToken);

  const load = useCallback(async () => {
    try {
      const next = await api.receipt(transactionId, { share: shareToken });
      if (lastStatus.current === 'awaiting_payment' && next.status === 'paid') {
        toast({ tone: 'success', title: 'Payment received at the cash desk', description: 'Thank you for shopping with us!' });
      }
      lastStatus.current = next.status;
      setReceipt(next);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [transactionId, shareToken, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // While a cash bill is unpaid, keep checking so the page flips to "paid" once the cashier collects.
  useEffect(() => {
    if (receipt?.status !== 'awaiting_payment') return undefined;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [receipt?.status, load]);

  const shareUrl = receipt ? absoluteUrl(receipt.sharePath) : '';
  const shareText = receipt ? `FlashCart receipt ${receipt.invoiceNumber} · ${formatINR(receipt.summary.grandTotal)} at ${receipt.mall.name}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ tone: 'success', title: 'Receipt link copied', description: 'Anyone with the link can view this bill.' });
    } catch {
      toast({ tone: 'error', title: "Couldn't copy", description: shareUrl });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FlashCart receipt', text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    copyLink();
  };

  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, '_blank', 'noopener');

  return (
    <div className="min-h-dvh">
      <AppHeader
        suffix={shared ? 'Shared receipt' : 'Receipt'}
        maxWidth="max-w-3xl"
        right={
          shared && !customer ? (
            <Button variant="secondary" size="sm" icon={LogIn} onClick={() => navigate('/login')}>
              Shop with FlashCart
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={ScanLine} onClick={() => navigate('/shop')}>
              New bag
            </Button>
          )
        }
      />

      <main className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-6 print:max-w-none print:p-0">
        {error ? (
          <EmptyState
            icon={ReceiptText}
            title={error.code === 'RECEIPT_NOT_FOUND' ? 'Receipt not found' : "Couldn't load receipt"}
            description={
              error.code === 'RECEIPT_NOT_FOUND'
                ? shared
                  ? 'This share link is not valid any more.'
                  : 'This bill doesn’t exist, or it belongs to a different phone number.'
                : error.message
            }
            action={
              <div className="flex gap-2">
                <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/shop')}>
                  Back to shop
                </Button>
                {error.code !== 'RECEIPT_NOT_FOUND' && (
                  <Button icon={RefreshCw} onClick={load}>
                    Retry
                  </Button>
                )}
              </div>
            }
          />
        ) : !receipt ? (
          <Skeleton className="h-[760px] rounded-3xl" />
        ) : (
          <>
            {shared && (
              <p className="mb-4 rounded-xl bg-brand-50 px-4 py-2.5 text-center text-[13px] text-brand-900 ring-1 ring-inset ring-brand-200/70 print:hidden">
                You’re viewing a receipt shared from FlashCart · {receipt.mall.name}
              </p>
            )}
            <Ticket receipt={receipt} />
            <div className="mt-5 grid grid-cols-2 gap-2.5 print:hidden">
              <Button variant="dark" size="lg" icon={Share2} onClick={share}>
                Share
              </Button>
              <Button variant="secondary" size="lg" icon={MessageCircle} onClick={whatsapp}>
                WhatsApp
              </Button>
              <Button variant="secondary" size="lg" icon={Link2} onClick={copyLink}>
                Copy link
              </Button>
              <Button variant="secondary" size="lg" icon={Printer} onClick={() => window.print()}>
                Print / PDF
              </Button>
            </div>
            {!shared && (
              <button onClick={() => navigate('/shop')} className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 print:hidden">
                <ScanLine className="size-4" /> Back to shop
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export function Ticket({ receipt }) {
  const { status, summary, payment, mall, loyalty, refunds = [], refundStatus = 'none' } = receipt;
  const awaiting = status === 'awaiting_payment';
  const cash = payment.collection;
  const pointsUsed = summary.pointsValue ?? 0;
  const amountDue = summary.amountDue ?? summary.grandTotal;
  const refunded = refunds.reduce((acc, r) => acc + r.amount + (r.pointsReturned ?? 0), 0);

  return (
    <article className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-lift animate-fade-up print:rounded-none print:border-0 print:shadow-none">
      {/* Hero */}
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        {awaiting ? <PendingMark /> : <SuccessMark key="paid" />}
        <h1 className="mt-5 text-xl font-semibold text-zinc-900">
          {awaiting ? 'Bill ready — pay at the cash desk' : refundStatus === 'full' ? 'Fully refunded' : 'Payment successful'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {mall.name} · {pluralize(summary.units, 'item')} · {pluralize(receipt.groups.length, 'store')}
        </p>
        <p className="mt-4 text-[40px] font-semibold leading-none tracking-tight text-zinc-900 tabular-nums">{formatINR(summary.grandTotal)}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <TransactionStatusBadge status={status} refundStatus={refundStatus} />
          {loyalty?.pointsEarned > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/70">
              <Sparkles className="size-3 text-amber-500" /> +{loyalty.pointsEarned} points earned
            </span>
          )}
        </div>
      </div>

      {/* Cash bill: barcode for the desk scanner */}
      {awaiting && (
        <section className="mx-6 mb-6 rounded-2xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-200 print:bg-white">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Banknote className="size-4" /> Pay {formatINR(amountDue)} in cash
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900/75">
            Show this barcode at the cash desk, or tell the cashier your phone number. They’ll tell you exactly how much change you get back.
          </p>
          <div className="mt-3 rounded-xl bg-white px-4 py-3 ring-1 ring-amber-200">
            <Barcode value={receipt.billCode} format="CODE128" height={64} barWidth={2} />
          </div>
        </section>
      )}

      {refunds.length > 0 && (
        <section className="mx-6 mb-6 rounded-2xl bg-brand-50/70 p-4 ring-1 ring-inset ring-brand-200/70 print:bg-white">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-900">
            <RotateCcw className="size-4" /> {formatINR(refunded)} refunded on {pluralize(refunds.length, 'credit note')}
          </p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-brand-900/80">
            {refunds.map((r) => (
              <li key={r.creditNoteId} className="flex items-center justify-between gap-3">
                <button onClick={() => navigate(`/credit/${r.creditNoteId}`)} className="font-mono font-semibold underline-offset-2 hover:underline print:no-underline">
                  {r.creditNoteNumber}
                </button>
                <span>
                  {pluralize(r.units, 'item')} · {formatINR(r.amount)} {r.method === 'cash' ? 'cash' : 'to source'}
                  {r.pointsReturned ? ` + ${r.pointsReturned} pts` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-zinc-100 px-6 py-5 text-[13px]">
        <Meta label="Invoice no." value={receipt.invoiceNumber} mono />
        <Meta label="Date & time" value={formatDateTime(receipt.issuedAt)} />
        <Meta label="Bill ID" value={receipt.transactionId} mono />
        <Meta label="Customer" value={formatPhone(receipt.customer?.phone)} />
        <Meta label="Payment" value={paymentMethodLabel(payment)} />
        <Meta
          label={payment.razorpayPaymentId ? 'Razorpay ref.' : 'Status'}
          value={payment.razorpayPaymentId ?? (payment.status === 'paid' ? `Paid ${formatTime(payment.paidAt)}` : 'Due at cash desk')}
          mono={Boolean(payment.razorpayPaymentId)}
        />
      </dl>

      <Perforation />

      {/* Items */}
      <section className="px-6 py-4">
        <Eyebrow>Tax invoice</Eyebrow>
        <div className="mt-3 space-y-4">
          {receipt.groups.map((g) => (
            <div key={g.showroomId}>
              <p className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-zinc-500">
                <span>{g.showroom}</span>
                <span className="tabular-nums">{formatINR(g.subtotal)}</span>
              </p>
              <table className="w-full text-[13px]">
                <tbody>
                  {g.items.map((item) => (
                    <tr key={item.itemId} className="align-top">
                      <td className="py-1 pr-2">
                        <p className="font-medium text-zinc-900">
                          {item.name}
                          {item.returnedQuantity > 0 && (
                            <span className="ml-1.5 rounded-md bg-zinc-100 px-1.5 py-px text-[10.5px] font-semibold text-zinc-600">
                              {item.returnedQuantity === item.quantity ? 'Returned' : `${item.returnedQuantity} of ${item.quantity} returned`}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {item.quantity} × {formatINR(item.unitPrice)} · HSN {item.hsn} · GST {item.gstRate}%
                        </p>
                      </td>
                      <td className="whitespace-nowrap py-1 text-right font-medium text-zinc-900 tabular-nums">{formatINR(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* GST breakdown */}
      <section className="px-6 pb-5">
        <div className="overflow-hidden rounded-xl border border-zinc-200/80">
          <table className="w-full text-[12px] tabular-nums">
            <thead className="bg-zinc-50 text-[10.5px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">GST</th>
                <th className="px-2 py-2 text-right font-semibold">Taxable</th>
                <th className="px-2 py-2 text-right font-semibold">CGST</th>
                <th className="px-2 py-2 text-right font-semibold">SGST</th>
                <th className="px-3 py-2 text-right font-semibold">Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {receipt.taxBreakdown.map((s) => (
                <tr key={s.rate}>
                  <td className="px-3 py-2 font-semibold text-zinc-900">{s.rate}%</td>
                  <td className="px-2 py-2 text-right">{formatINR(s.taxableValue)}</td>
                  <td className="px-2 py-2 text-right">{formatINR(s.cgst)}</td>
                  <td className="px-2 py-2 text-right">{formatINR(s.sgst)}</td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900">{formatINR(s.totalTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 space-y-1.5 text-[13px]">
          <Line label="Taxable value" value={formatINR(summary.subtotal)} />
          <Line label="CGST" value={formatINR(summary.cgst)} />
          <Line label="SGST" value={formatINR(summary.sgst)} />
          {summary.roundOff !== 0 && <Line label="Round off" value={formatSignedINR(summary.roundOff)} />}
          <div className="flex items-baseline justify-between border-t border-zinc-200 pt-2.5">
            <dt className="text-sm font-semibold text-zinc-900">Invoice total</dt>
            <dd className="text-lg font-semibold text-zinc-900 tabular-nums">{formatINR(summary.grandTotal)}</dd>
          </div>
          {pointsUsed > 0 && (
            <>
              <Line label={`Paid with ${summary.pointsRedeemed} FlashCart points`} value={`−${formatINR(pointsUsed)}`} />
              <div className="flex items-baseline justify-between">
                <dt className="text-sm font-semibold text-zinc-900">{awaiting ? 'Amount payable' : `Paid by ${paymentMethodLabel({ method: payment.method })}`}</dt>
                <dd className="text-base font-semibold text-zinc-900 tabular-nums">{formatINR(amountDue)}</dd>
              </div>
            </>
          )}
        </dl>

        {cash && (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-emerald-50 p-3 text-[12.5px] ring-1 ring-inset ring-emerald-200 print:bg-white">
            <div>
              <p className="text-emerald-800/70">Cash given</p>
              <p className="font-semibold text-emerald-900 tabular-nums">{formatINR(cash.received)}</p>
            </div>
            <div>
              <p className="text-emerald-800/70">Change returned</p>
              <p className="font-semibold text-emerald-900 tabular-nums">{formatINR(cash.change)}</p>
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-100 bg-zinc-50/70 px-6 py-4 text-center text-[10.5px] leading-relaxed text-zinc-400 print:bg-white">
        <p className="font-semibold text-zinc-500">{mall.legalName}</p>
        <p>GSTIN {mall.gstin} · {mall.address}</p>
        <p className="mt-1">Computer-generated tax invoice. No signature required. Ref {receipt.reference.slice(0, 8)}</p>
      </footer>
    </article>
  );
}

export const Meta = ({ label, value, mono }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium text-zinc-400">{label}</dt>
    <dd className={`mt-0.5 truncate font-medium text-zinc-900 ${mono ? 'font-mono text-[12px]' : ''}`} title={value}>
      {value}
    </dd>
  </div>
);

export const Line = ({ label, value }) => (
  <div className="flex items-baseline justify-between">
    <dt className="text-zinc-500">{label}</dt>
    <dd className="text-zinc-700 tabular-nums">{value}</dd>
  </div>
);

export const Perforation = () => (
  <div className="perforation" aria-hidden>
    <span />
  </div>
);

function SuccessMark() {
  return (
    <div className="relative grid size-16 place-items-center">
      <span className="absolute inset-0 rounded-full bg-emerald-400/50 animate-ring" />
      <div className="grid size-16 place-items-center rounded-full bg-emerald-500 shadow-success animate-pop">
        <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="48" className="animate-draw" />
        </svg>
      </div>
    </div>
  );
}

function PendingMark() {
  return (
    <div className="relative grid size-16 place-items-center">
      <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ring" />
      <div className="grid size-16 place-items-center rounded-full bg-amber-400 text-white shadow-[0_10px_24px_-10px_rgb(245_158_11/0.7)] animate-pop">
        <Clock3 className="size-8" strokeWidth={2.4} />
      </div>
    </div>
  );
}
