import { Moon, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Sheet } from '../../components/ui/Sheet.jsx';
import { Card, Eyebrow } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { formatINR, formatTime, pluralize } from '../../lib/format.js';
import { AmountInput } from './AmountInput.jsx';

/** Live "how much cash should be in my drawer right now" panel. */
export function DrawerPanel({ shift, onEndDay }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <Eyebrow>Today’s cash drawer</Eyebrow>
          <span className="text-xs text-zinc-400">Opened {formatTime(shift.openedAt)}</span>
        </div>
        <p className="mt-4 text-sm text-zinc-500">Cash in drawer now</p>
        <p key={shift.cashInDrawer} className="text-[40px] font-semibold leading-tight tracking-tight text-zinc-900 tabular-nums animate-fade-in">
          {formatINR(shift.cashInDrawer)}
        </p>

        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label="Opening cash" value={formatINR(shift.openingCash)} />
          <Row label={`Cash sales · ${pluralize(shift.billsCollected, 'bill')}`} value={`+${formatINR(shift.cashSales)}`} strong />
          <Row label="Received from customers" value={formatINR(shift.cashReceived)} muted indent />
          <Row label="Change returned" value={`−${formatINR(shift.changeReturned)}`} muted indent />
        </dl>

        {shift.pendingBills > 0 && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 ring-1 ring-inset ring-amber-200">
            Still to collect: <span className="font-semibold">{pluralize(shift.pendingBills, 'bill')} · {formatINR(shift.pendingAmount, { whole: true })}</span>
          </p>
        )}
      </div>

      {shift.collections.length > 0 && (
        <div className="border-t border-zinc-100 px-5 py-4">
          <Eyebrow>Recent cash payments</Eyebrow>
          <ul className="mt-3 space-y-2.5">
            {shift.collections.slice(0, 6).map((c) => (
              <li key={c.transactionId} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="w-16 shrink-0 text-zinc-400 tabular-nums">{formatTime(c.collectedAt)}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-500">{c.invoiceNumber}</span>
                <span className="text-right">
                  <span className="font-semibold text-zinc-900 tabular-nums">+{formatINR(c.amount, { whole: true })}</span>
                  {c.change > 0 && <span className="block text-[11px] text-zinc-400 tabular-nums">change {formatINR(c.change)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-zinc-100 bg-zinc-50/60 p-4">
        <Button variant="secondary" className="w-full" icon={Moon} onClick={onEndDay}>
          End of day
        </Button>
      </div>
    </Card>
  );
}

/** Count the drawer, compare with what the system expects, and close the day. */
export function EndDaySheet({ open, shift, onClose, onClosed }) {
  const [counted, setCounted] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const difference = counted === '' ? null : Math.round((Number(counted) - shift.cashInDrawer) * 100) / 100;

  const close = async () => {
    setLoading(true);
    setError(null);
    try {
      const { report } = await api.pos.closeShift(counted === '' ? null : Number(counted));
      setCounted('');
      onClosed(report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={loading ? undefined : onClose}
      title="End of day"
      description="Count the cash in your drawer and close today’s register."
      footer={
        <Button size="lg" className="w-full" icon={Moon} loading={loading} onClick={close}>
          Close the day
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-zinc-900 p-5 text-white">
          <p className="flex items-center gap-2 text-sm text-white/60">
            <Wallet className="size-4" /> Cash that should be in the drawer
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatINR(shift.cashInDrawer)}</p>
          <p className="mt-2 text-[13px] text-white/50 tabular-nums">
            {formatINR(shift.openingCash)} opening + {formatINR(shift.cashSales)} cash sales
          </p>
        </div>

        <div>
          <AmountInput label="Cash you counted (optional)" value={counted} onChange={setCounted} placeholder={String(shift.cashInDrawer)} />
          {difference !== null && (
            <p
              className={`mt-2 text-sm font-semibold ${difference === 0 ? 'text-emerald-600' : difference > 0 ? 'text-amber-600' : 'text-red-600'}`}
            >
              {difference === 0 ? 'Drawer is balanced ✓' : difference > 0 ? `Over by ${formatINR(difference)}` : `Short by ${formatINR(-difference)}`}
            </p>
          )}
        </div>

        {shift.pendingBills > 0 && (
          <Alert tone="warning" title={`${pluralize(shift.pendingBills, 'cash bill')} still unpaid`}>
            They stay pending ({formatINR(shift.pendingAmount, { whole: true })}) and can be collected after the next day starts.
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Sheet>
  );
}

/** Printable end-of-day summary shown right after closing. */
export function DayReport({ report, cashier, onStartNew, onSignOut }) {
  const date = new Date(report.openedAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 print:max-w-none print:p-0">
      <Card className="overflow-hidden animate-fade-up print:border-0 print:shadow-none">
        <div className="bg-zinc-900 px-6 py-7 text-white print:bg-white print:text-zinc-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50 print:text-zinc-400">End-of-day cash report</p>
          <h1 className="mt-2 text-2xl font-semibold">{date}</h1>
          <p className="mt-1 text-sm text-white/60 print:text-zinc-500">
            {cashier.name} · {formatTime(report.openedAt)} – {formatTime(report.closedAt)}
          </p>
          <p className="mt-6 text-sm text-white/60 print:text-zinc-500">Cash left in drawer</p>
          <p className="text-5xl font-semibold tracking-tight tabular-nums">{formatINR(report.countedCash ?? report.cashInDrawer)}</p>
          {report.difference !== null && (
            <p className={`mt-2 text-sm font-semibold ${report.difference === 0 ? 'text-emerald-400' : report.difference > 0 ? 'text-amber-300' : 'text-red-300'}`}>
              {report.difference === 0 ? 'Balanced with expected cash' : `${report.difference > 0 ? 'Over' : 'Short'} by ${formatINR(Math.abs(report.difference))} vs expected`}
            </p>
          )}
        </div>
        <dl className="space-y-2.5 px-6 py-5 text-sm">
          <Row label="Opening cash" value={formatINR(report.openingCash)} />
          <Row label={`Cash sales · ${pluralize(report.billsCollected, 'bill')}`} value={`+${formatINR(report.cashSales)}`} strong />
          <Row label="Received from customers" value={formatINR(report.cashReceived)} muted indent />
          <Row label="Change returned" value={`−${formatINR(report.changeReturned)}`} muted indent />
          <div className="border-t border-dashed border-zinc-200 pt-2.5">
            <Row label="Expected in drawer" value={formatINR(report.cashInDrawer)} strong />
          </div>
          <Row label="Counted" value={report.countedCash != null ? formatINR(report.countedCash) : 'Not counted'} />
          {report.pendingBills > 0 && <Row label="Unpaid cash bills" value={`${report.pendingBills} · ${formatINR(report.pendingAmount, { whole: true })}`} />}
        </dl>
        {report.collections.length > 0 && (
          <div className="border-t border-zinc-100 px-6 py-5">
            <Eyebrow>Cash payments</Eyebrow>
            <table className="mt-3 w-full text-[13px] tabular-nums">
              <thead className="text-left text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="pb-2 font-semibold">Time</th>
                  <th className="pb-2 font-semibold">Bill</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                  <th className="pb-2 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {report.collections.map((c) => (
                  <tr key={c.transactionId}>
                    <td className="py-1.5">{formatTime(c.collectedAt)}</td>
                    <td className="py-1.5 font-mono text-[12px]">{c.invoiceNumber}</td>
                    <td className="py-1.5 text-right font-medium text-zinc-900">{formatINR(c.amount)}</td>
                    <td className="py-1.5 text-right">{formatINR(c.change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-5 grid grid-cols-3 gap-2.5 print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="secondary" onClick={onSignOut}>
          Sign out
        </Button>
        <Button onClick={onStartNew}>Start new day</Button>
      </div>
    </div>
  );
}

const Row = ({ label, value, strong, muted, indent }) => (
  <div className={`flex items-baseline justify-between gap-4 ${indent ? 'pl-3' : ''}`}>
    <dt className={muted ? 'text-zinc-400' : 'text-zinc-500'}>{label}</dt>
    <dd className={`tabular-nums ${strong ? 'font-semibold text-zinc-900' : muted ? 'text-zinc-400' : 'font-medium text-zinc-900'}`}>{value}</dd>
  </div>
);
