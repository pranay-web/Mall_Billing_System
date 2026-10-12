import { ChevronRight, ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert.jsx';
import { TransactionStatusBadge } from '../../components/ui/Badge.jsx';
import { Sheet } from '../../components/ui/Sheet.jsx';
import { EmptyState, Skeleton } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, formatINR, pluralize } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';

/** The signed-in customer's past bills, newest first. */
export default function ReceiptsSheet({ open, onClose }) {
  const [state, setState] = useState({ loading: true, receipts: [], error: null });

  useEffect(() => {
    if (!open) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .myReceipts()
      .then(({ receipts }) => setState({ loading: false, receipts, error: null }))
      .catch((error) => setState({ loading: false, receipts: [], error }));
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Your receipts" description="Every bill linked to your phone number.">
      {state.error && <Alert tone="error">{state.error.message}</Alert>}
      {state.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      ) : state.receipts.length === 0 && !state.error ? (
        <EmptyState icon={ReceiptText} title="No receipts yet" description="Bills appear here after you check out." />
      ) : (
        <ul className="space-y-2">
          {state.receipts.map((r) => (
            <li key={r.transactionId}>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/receipt/${r.transactionId}`);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 text-left transition hover:border-zinc-300"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[13px] font-semibold text-zinc-900">{r.invoiceNumber}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(r.issuedAt)} · {pluralize(r.units, 'item')}
                  </p>
                  <TransactionStatusBadge status={r.status} className="mt-1.5" />
                </div>
                <span className="text-[15px] font-semibold text-zinc-900 tabular-nums">{formatINR(r.grandTotal, { whole: true })}</span>
                <ChevronRight className="size-4 text-zinc-300" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
