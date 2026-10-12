import { ShieldCheck } from 'lucide-react';
import { Card, Eyebrow } from '../../components/ui/misc.jsx';
import { formatINR, formatSignedINR, pluralize } from '../../lib/format.js';

/** Sticky financial summary: subtotal, per-slab GST, round-off and payable total. */
export function SettlementSummary({ cart, title = 'Settlement summary', children, footnote = true }) {
  const { summary, taxBreakdown } = cart;
  return (
    <Card className="overflow-hidden">
      <div className="p-5">
        <Eyebrow>{title}</Eyebrow>
        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label={`Item value excl. GST · ${pluralize(summary.units, 'item')}`} value={formatINR(summary.subtotal)} />
          {taxBreakdown.map((slab) => (
            <Row
              key={slab.rate}
              label={
                <>
                  GST @ {slab.rate}%
                  <span className="ml-1.5 text-xs text-zinc-400">on {formatINR(slab.taxableValue, { whole: true })}</span>
                </>
              }
              value={formatINR(slab.totalTax)}
            />
          ))}
          {summary.roundOff !== 0 && <Row label="Round off" value={formatSignedINR(summary.roundOff)} muted />}
        </dl>
        <div className="mt-4 flex items-end justify-between border-t border-dashed border-zinc-200 pt-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Total payable</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              CGST {formatINR(summary.cgst)} + SGST {formatINR(summary.sgst)}
            </p>
          </div>
          <p key={summary.grandTotal} className="text-[28px] font-semibold leading-none tracking-tight text-zinc-900 tabular-nums animate-fade-in">
            {formatINR(summary.grandTotal)}
          </p>
        </div>
      </div>
      {children && <div className="border-t border-zinc-100 bg-zinc-50/60 p-4">{children}</div>}
      {footnote && (
        <p className="flex items-center justify-center gap-1.5 border-t border-zinc-100 px-4 py-3 text-[11.5px] text-zinc-400">
          <ShieldCheck className="size-3.5 text-emerald-500" /> Secured by Razorpay · One GST invoice for every store
        </p>
      )}
    </Card>
  );
}

const Row = ({ label, value, muted }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className={muted ? 'text-zinc-400' : 'text-zinc-600'}>{label}</dt>
    <dd className={`font-medium tabular-nums ${muted ? 'text-zinc-400' : 'text-zinc-900'}`}>{value}</dd>
  </div>
);
