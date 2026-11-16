import { ChevronRight, ReceiptText } from 'lucide-react';
import { TransactionStatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, Skeleton } from '../../components/ui/misc.jsx';
import { formatDateTime, formatINR, pluralize } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';

/** The signed-in customer's past bills, newest first. */
export function ReceiptsList({ receipts, loading, limit }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-2xl" />
        ))}
      </div>
    );
  }
  if (receipts.length === 0) {
    return <EmptyState icon={ReceiptText} title="No receipts yet" description="Bills appear here after you check out." className="py-8" />;
  }
  return (
    <ul className="space-y-2">
      {(limit ? receipts.slice(0, limit) : receipts).map((r) => (
        <li key={r.transactionId}>
          <button
            onClick={() => navigate(`/receipt/${r.transactionId}`)}
            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 text-left transition hover:border-zinc-300"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[13px] font-semibold text-zinc-900">{r.invoiceNumber}</p>
              <p className="text-xs text-zinc-500">
                {formatDateTime(r.issuedAt)} · {pluralize(r.units, 'item')}
                {r.pointsEarned > 0 && <span className="text-amber-700"> · +{r.pointsEarned} pts</span>}
              </p>
              <TransactionStatusBadge status={r.status} refundStatus={r.refundStatus} className="mt-1.5" />
            </div>
            <span className="text-[15px] font-semibold text-zinc-900 tabular-nums">{formatINR(r.grandTotal, { whole: true })}</span>
            <ChevronRight className="size-4 text-zinc-300" />
          </button>
        </li>
      ))}
    </ul>
  );
}
