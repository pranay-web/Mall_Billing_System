import { ArrowLeft, Printer, ReceiptText, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppHeader } from '../../components/AppHeader.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, Eyebrow, Skeleton } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, formatINR, formatPhone, pluralize } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';
import { Line, Meta, Perforation } from './ReceiptView.jsx';

/** A customer's credit note: what was returned, the GST credited and how the money came back. */
export default function CreditNoteView({ creditNoteId }) {
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.creditNote(creditNoteId).then(setNote).catch(setError);
  }, [creditNoteId]);

  return (
    <div className="min-h-dvh">
      <AppHeader
        suffix="Credit note"
        maxWidth="max-w-3xl"
        right={
          <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate('/shop/account')}>
            Your account
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-6 print:max-w-none print:p-0">
        {error ? (
          <EmptyState
            icon={ReceiptText}
            title="Credit note not found"
            description={error.message}
            action={
              <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/shop/account')}>
                Back
              </Button>
            }
          />
        ) : !note ? (
          <Skeleton className="h-[600px] rounded-3xl" />
        ) : (
          <>
            <CreditNoteTicket note={note} />
            <div className="mt-5 grid grid-cols-2 gap-2.5 print:hidden">
              <Button variant="dark" size="lg" icon={Printer} onClick={() => window.print()}>
                Print / PDF
              </Button>
              <Button variant="secondary" size="lg" icon={ReceiptText} onClick={() => navigate(`/receipt/${note.transactionId}`)}>
                Original bill
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export function CreditNoteTicket({ note, compact = false }) {
  const { summary, mall } = note;
  return (
    <article className={`overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-lift animate-fade-up print:rounded-none print:border-0 print:shadow-none ${compact ? '' : ''}`}>
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-brand-500 text-white shadow-brand animate-pop">
          <RotateCcw className="size-7" strokeWidth={2.2} />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-zinc-900">Return accepted</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {mall?.name} · {pluralize(summary.units, 'item')} returned
        </p>
        <p className="mt-4 text-[40px] font-semibold leading-none tracking-tight text-zinc-900 tabular-nums">{formatINR(summary.refundAmount)}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="brand" dot>
            {note.method === 'cash' ? 'Refunded in cash' : 'Refunded to card / UPI'}
          </Badge>
          {summary.pointsReturned > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/70">
              <Sparkles className="size-3 text-amber-500" /> +{summary.pointsReturned} points credited back
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-zinc-100 px-6 py-5 text-[13px]">
        <Meta label="Credit note no." value={note.creditNoteNumber} mono />
        <Meta label="Date & time" value={formatDateTime(note.createdAt)} />
        <Meta label="Against invoice" value={note.invoiceNumber} mono />
        <Meta label="Customer" value={formatPhone(note.customerPhone)} />
        <Meta label="Reason" value={note.reason || '—'} />
        <Meta label="Processed by" value={note.cashierName ?? 'Cash desk'} />
      </dl>

      <Perforation />

      <section className="px-6 py-4">
        <Eyebrow>Items returned</Eyebrow>
        <table className="mt-3 w-full text-[13px]">
          <tbody>
            {note.items.map((item) => (
              <tr key={item.itemId} className="align-top">
                <td className="py-1 pr-2">
                  <p className="font-medium text-zinc-900">{item.name}</p>
                  <p className="text-[11px] text-zinc-400">
                    {item.quantity} of {item.originalQuantity} · {item.showroom} · GST {item.gstRate}%
                  </p>
                </td>
                <td className="whitespace-nowrap py-1 text-right font-medium text-zinc-900 tabular-nums">{formatINR(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="px-6 pb-5">
        <div className="overflow-hidden rounded-xl border border-zinc-200/80">
          <table className="w-full text-[12px] tabular-nums">
            <thead className="bg-zinc-50 text-[10.5px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">GST credited</th>
                <th className="px-2 py-2 text-right font-semibold">Taxable</th>
                <th className="px-2 py-2 text-right font-semibold">CGST</th>
                <th className="px-2 py-2 text-right font-semibold">SGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {note.taxBreakdown.map((s) => (
                <tr key={s.rate}>
                  <td className="px-3 py-2 font-semibold text-zinc-900">{s.rate}%</td>
                  <td className="px-2 py-2 text-right">{formatINR(s.taxableValue)}</td>
                  <td className="px-2 py-2 text-right">{formatINR(s.cgst)}</td>
                  <td className="px-2 py-2 text-right">{formatINR(s.sgst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 space-y-1.5 text-[13px]">
          <Line label="Value of returned items" value={formatINR(summary.grandTotal)} />
          {summary.pointsReturned > 0 && <Line label="Credited back as points" value={`−${formatINR(summary.pointsReturned)}`} />}
          {summary.pointsReversed > 0 && <Line label="Points earned on these items reversed" value={`${summary.pointsReversed} pts`} />}
          <div className="flex items-baseline justify-between border-t border-zinc-200 pt-2.5">
            <dt className="text-sm font-semibold text-zinc-900">{note.method === 'cash' ? 'Cash refunded' : 'Refunded to source'}</dt>
            <dd className="text-lg font-semibold text-zinc-900 tabular-nums">{formatINR(summary.refundAmount)}</dd>
          </div>
          {note.gateway?.refundId && <Line label="Gateway refund ref." value={note.gateway.refundId} />}
        </dl>
      </section>

      {mall && (
        <footer className="border-t border-zinc-100 bg-zinc-50/70 px-6 py-4 text-center text-[10.5px] leading-relaxed text-zinc-400 print:bg-white">
          <p className="font-semibold text-zinc-500">{mall.legalName}</p>
          <p>GSTIN {mall.gstin} · {mall.address}</p>
          <p className="mt-1">Credit note under GST rules · Ref {note.uuid?.slice(0, 8)}</p>
        </footer>
      )}
    </article>
  );
}
