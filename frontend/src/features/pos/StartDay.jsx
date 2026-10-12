import { Sun } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, Eyebrow } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, formatINR } from '../../lib/format.js';
import { AmountInput } from './AmountInput.jsx';

/** Opens the cashier's day by recording how much cash is already in the drawer. */
export function StartDay({ cashier, lastClosed, onStarted }) {
  const [opening, setOpening] = useState(lastClosed?.countedCash != null ? String(lastClosed.countedCash) : '');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const start = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { shift } = await api.pos.openShift(opening === '' ? 0 : Number(opening));
      onStarted(shift);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] items-start gap-5 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={start}>
        <Card className="p-7 animate-fade-up">
          <div className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
            <Sun className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-zinc-900">Good to see you, {cashier.name.split(' ')[0]}</h1>
          <p className="mt-1.5 text-[15px] text-zinc-500">Count the cash in your drawer before serving the first customer. This is your opening balance for today.</p>
          <div className="mt-6">
            <AmountInput label="Opening cash in drawer" value={opening} onChange={setOpening} autoFocus />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0, 1000, 2000, 5000].map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setOpening(String(v))}
                className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[12.5px] font-semibold text-zinc-600 transition hover:bg-zinc-200 tabular-nums"
              >
                {formatINR(v, { whole: true })}
              </button>
            ))}
          </div>
          {error && <Alert tone="error" className="mt-4">{error}</Alert>}
          <Button type="submit" size="lg" className="mt-6 w-full" loading={loading}>
            Start the day
          </Button>
        </Card>
      </form>

      {lastClosed && (
        <Card className="p-5 animate-fade-up">
          <Eyebrow>Last closing</Eyebrow>
          <p className="mt-1 text-sm text-zinc-500">{formatDateTime(lastClosed.closedAt)}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Cash sales" value={formatINR(lastClosed.cashSales)} />
            <Row label="Expected in drawer" value={formatINR(lastClosed.cashInDrawer)} />
            {lastClosed.countedCash != null && <Row label="Counted" value={formatINR(lastClosed.countedCash)} />}
            {lastClosed.difference != null && lastClosed.difference !== 0 && (
              <Row label={lastClosed.difference > 0 ? 'Over by' : 'Short by'} value={formatINR(Math.abs(lastClosed.difference))} />
            )}
          </dl>
        </Card>
      )}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between">
    <dt className="text-zinc-500">{label}</dt>
    <dd className="font-medium text-zinc-900 tabular-nums">{value}</dd>
  </div>
);
