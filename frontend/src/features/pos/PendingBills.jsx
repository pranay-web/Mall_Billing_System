import { Inbox } from 'lucide-react';
import { Card, Eyebrow, Skeleton } from '../../components/ui/misc.jsx';
import { formatINR, timeAgo } from '../../lib/format.js';

/** Customers who chose "cash at desk" and haven't paid yet — tap one to collect. */
export function PendingBills({ bills, loading, activeId, onSelect }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <Eyebrow>Waiting to pay cash</Eyebrow>
          <p className="mt-0.5 text-sm font-semibold text-zinc-900">
            {bills.length ? `${bills.length} bill${bills.length === 1 ? '' : 's'} · ${formatINR(bills.reduce((a, b) => a + b.amountDue, 0), { whole: true })}` : 'All settled'}
          </p>
        </div>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      </div>

      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <Inbox className="size-6 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-700">No one is waiting</p>
          <p className="mt-1 text-xs text-zinc-400">Cash bills appear here the moment a customer checks out.</p>
        </div>
      ) : (
        <ul className="max-h-[420px] divide-y divide-zinc-100 overflow-y-auto">
          {bills.map((b) => (
            <li key={b.transactionId}>
              <button
                onClick={() => onSelect(b)}
                className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition ${activeId === b.transactionId ? 'bg-brand-50/70' : 'hover:bg-zinc-50'}`}
              >
                <span className="size-2 shrink-0 rounded-full bg-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900">{b.customerPhone ?? 'Customer'}</p>
                  <p className="truncate text-xs text-zinc-500">
                    <span className="font-mono">{b.invoiceNumber}</span> · {b.units} items · {timeAgo(b.issuedAt)}
                  </p>
                </div>
                <span className="text-[15px] font-semibold text-zinc-900 tabular-nums">{formatINR(b.amountDue, { whole: true })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
