import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, Eyebrow, Skeleton } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { formatINR, formatTime, pluralize } from '../../lib/format.js';

const POLL_MS = 10_000;

/** Every cashier's drawer today, so a supervisor (or the next shift) can see cash across the floor. */
export function AllDesks({ refreshKey }) {
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.pos
        .drawers()
        .then((data) => alive && setState({ loading: false, data }))
        .catch(() => alive && setState((s) => ({ ...s, loading: false })));
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshKey]);

  const { data } = state;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <Eyebrow>All desks today</Eyebrow>
          {data && (
            <p className="mt-0.5 text-sm font-semibold text-zinc-900">
              {pluralize(data.openDesks, 'drawer')} open · {formatINR(data.cashOnFloor, { whole: true })} on the floor
            </p>
          )}
        </div>
        <Users className="size-5 text-zinc-300" />
      </div>
      {state.loading ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : !data || data.drawers.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500">No other drawers have been opened today.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {data.drawers.map((d) => (
            <li key={d.shiftId} className="flex items-center gap-3 px-5 py-3 text-[13px]">
              <span className={`size-2 shrink-0 rounded-full ${d.closedAt ? 'bg-zinc-300' : 'bg-emerald-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-zinc-900">
                  {d.cashierName}
                  {d.isMine && <Badge tone="brand">You</Badge>}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatTime(d.openedAt)}
                  {d.closedAt ? ` – ${formatTime(d.closedAt)}` : ' · open'} · {pluralize(d.billsCollected, 'bill')}
                  {d.refundsIssued ? ` · ${pluralize(d.refundsIssued, 'refund')}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-zinc-900 tabular-nums">{formatINR(d.closedAt && d.countedCash != null ? d.countedCash : d.cashInDrawer, { whole: true })}</p>
                <p className="text-[11px] text-zinc-400">
                  {d.closedAt ? (d.difference == null ? 'closed' : d.difference === 0 ? 'balanced' : `${d.difference > 0 ? 'over' : 'short'} ${formatINR(Math.abs(d.difference), { whole: true })}`) : 'in drawer'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <p className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-2.5 text-[12px] text-zinc-500">
          Cash sales today {formatINR(data.cashSalesToday, { whole: true })}
          {data.cashRefundedToday > 0 && ` · refunds ${formatINR(data.cashRefundedToday, { whole: true })}`}
        </p>
      )}
    </Card>
  );
}
