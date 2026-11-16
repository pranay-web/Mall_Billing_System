import { ArrowDownLeft, ArrowUpRight, ChevronRight, Download, LogOut, Monitor, Moon, Plus, ReceiptText, RotateCcw, Share, Sparkles, Store, Sun, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ShowroomIcon } from '../../components/ProductTile.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, Eyebrow, Skeleton } from '../../components/ui/misc.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, formatINR, formatPhone, pluralize } from '../../lib/format.js';
import { usePwaInstall } from '../../lib/pwa.js';
import { navigate } from '../../lib/router.js';
import { useTheme } from '../../lib/theme.js';
import { ReceiptsList } from './ReceiptsSheet.jsx';

/** "You": points, spend insights, order-again, refunds, every receipt, and app settings. */
export default function AccountView() {
  const { customer, logout } = useShop();
  const [summary, setSummary] = useState(null);
  const [receipts, setReceipts] = useState({ loading: true, list: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    api.mySummary().then(setSummary).catch(setError);
    api
      .myReceipts()
      .then(({ receipts: list }) => setReceipts({ loading: false, list }))
      .catch(() => setReceipts({ loading: false, list: [] }));
  }, []);

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-[30px]">{formatPhone(customer?.phone)}</h1>
          <p className="mt-1 text-sm text-zinc-500">Points, spending, past bills and app settings.</p>
        </div>
        <Button variant="secondary" size="sm" icon={LogOut} onClick={logout}>
          Sign out
        </Button>
      </header>

      {error && <Alert tone="error" title="Couldn’t load your summary">{error.message}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <PointsCard loyalty={summary?.loyalty} />
        <SpendCard summary={summary} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <FavouriteCard summary={summary} />
        <ReorderCard items={summary?.reorder} />
      </div>

      {summary?.refunds?.length > 0 && <RefundsCard refunds={summary.refunds} totalRefunded={summary.totalRefunded} />}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <Eyebrow>Receipts</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">Every bill linked to your number</h2>
          </div>
          {receipts.list.length > 0 && <span className="text-sm text-zinc-500">{pluralize(receipts.list.length, 'bill')}</span>}
        </div>
        <ReceiptsList receipts={receipts.list} loading={receipts.loading} />
      </section>

      <SettingsCard />
    </div>
  );
}

function PointsCard({ loyalty }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white shadow-[0_10px_24px_-10px_rgb(245_158_11/0.6)] sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-white/15 blur-2xl" aria-hidden />
      <div className="relative">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          <Sparkles className="size-4" /> FlashCart points
        </p>
        {loyalty ? (
          <>
            <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums">{loyalty.balance}</p>
            <p className="mt-1 text-[15px] text-white/80">
              worth <span className="font-semibold text-white">{formatINR(loyalty.balance * loyalty.pointValue, { whole: true })}</span> off your next bill
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-xl bg-white/15 p-3 ring-1 ring-inset ring-white/20">
                <p className="text-white/70">Earned so far</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{loyalty.earnedTotal}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3 ring-1 ring-inset ring-white/20">
                <p className="text-white/70">Redeemed</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{loyalty.spentTotal}</p>
              </div>
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-white/75">
              Earn 1 point for every {formatINR(loyalty.earnPerRupees, { whole: true })} you pay. 1 point = ₹{loyalty.pointValue}. Use points on up to {loyalty.maxRedeemPercent}% of any bill at checkout.
            </p>
            {loyalty.history.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-white/20 pt-4 text-[13px]">
                {loyalty.history.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    {h.delta >= 0 ? <ArrowUpRight className="size-4 text-white" /> : <ArrowDownLeft className="size-4 text-white/70" />}
                    <span className="min-w-0 flex-1 truncate text-white/85">{h.note}</span>
                    <span className="font-semibold tabular-nums">
                      {h.delta >= 0 ? '+' : ''}
                      {h.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <Skeleton className="mt-3 h-12 w-32 bg-white/20" />
        )}
      </div>
    </section>
  );
}

function SpendCard({ summary }) {
  const months = summary?.byMonth ?? [];
  const max = Math.max(1, ...months.map((m) => m.spent));
  return (
    <Card className="p-5">
      <Eyebrow>Spending</Eyebrow>
      {summary ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-500">This month</p>
              <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{formatINR(summary.thisMonth.spent, { whole: true })}</p>
              <p className="text-xs text-zinc-400">{pluralize(summary.thisMonth.bills, 'bill')}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">All time</p>
              <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{formatINR(summary.totalSpent, { whole: true })}</p>
              <p className="text-xs text-zinc-400">{pluralize(summary.bills, 'bill')}</p>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-xs font-medium text-zinc-500">Last 6 months</p>
            <ul className="mt-2 flex h-28 items-end gap-2" aria-label="Monthly spend">
              {months.map((m) => (
                <li key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${m.label}: ${formatINR(m.spent)}`}>
                  <span className="text-[10px] font-semibold text-zinc-500 tabular-nums">{m.spent ? formatINR(m.spent, { whole: true }).replace('₹', '') : ''}</span>
                  <span
                    className={`w-full rounded-t-md transition-[height] ${m.spent ? 'bg-brand-500' : 'bg-zinc-200'}`}
                    style={{ height: `${m.spent ? Math.max(6, Math.round((m.spent / max) * 72)) : 3}px` }}
                    aria-hidden
                  />
                  <span className="text-[11px] text-zinc-400">{m.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <Skeleton className="mt-3 h-40" />
      )}
    </Card>
  );
}

function FavouriteCard({ summary }) {
  const fav = summary?.favouriteShowroom;
  return (
    <Card className="p-5">
      <Eyebrow>Where you shop</Eyebrow>
      {!summary ? (
        <Skeleton className="mt-3 h-24" />
      ) : !fav ? (
        <p className="mt-3 flex items-center gap-3 text-sm text-zinc-500">
          <Store className="size-5 text-zinc-300" /> Your favourite showroom shows up after your first bill.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <ShowroomIcon showroomId={fav.showroomId} className="size-12 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
                {fav.showroom} <Badge tone="warning">Favourite</Badge>
              </p>
              <p className="text-xs text-zinc-500">
                {formatINR(fav.spent, { whole: true })} across {pluralize(fav.visits, 'bill')}
              </p>
            </div>
            <Trophy className="size-5 text-amber-500" />
          </div>
          <ul className="mt-4 space-y-2">
            {summary.byShowroom.slice(0, 5).map((s) => (
              <li key={s.showroomId} className="text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">{s.showroom}</span>
                  <span className="font-medium text-zinc-900 tabular-nums">{formatINR(s.spent, { whole: true })}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, Math.round((s.spent / fav.spent) * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {summary.topItems.length > 0 && (
            <p className="mt-4 text-[12.5px] text-zinc-500">
              Most bought: <span className="font-medium text-zinc-700">{summary.topItems.map((i) => `${i.name} ×${i.units}`).join(', ')}</span>
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function ReorderCard({ items }) {
  const { addByBarcode } = useShop();
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const add = async (item) => {
    setBusy(item.productId);
    try {
      await addByBarcode(item.barcode);
      toast({ tone: 'success', title: `${item.name} added to your bag`, action: { label: 'View bag', onClick: () => navigate('/shop/bag') } });
    } catch (err) {
      toast({ tone: err.code === 'OUT_OF_STOCK' ? 'warning' : 'error', title: "Couldn't add it", description: err.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>Order again</Eyebrow>
        <RotateCcw className="size-4 text-zinc-300" />
      </div>
      {!items ? (
        <Skeleton className="mt-3 h-24" />
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Food Court items you’ve bought before appear here for one-tap re-ordering.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 py-2.5">
              <ShowroomIcon showroomId={i.showroomId} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">{i.name}</p>
                <p className="text-xs text-zinc-500">
                  {formatINR(i.unitMrp, { whole: true })} · ordered {pluralize(i.units, 'time')}
                </p>
              </div>
              <Button size="sm" variant="secondary" icon={Plus} loading={busy === i.productId} disabled={!i.inStock} onClick={() => add(i)}>
                {i.inStock ? 'Add' : 'Sold out'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RefundsCard({ refunds, totalRefunded }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <Eyebrow>Returns & refunds</Eyebrow>
          <p className="mt-0.5 text-sm font-semibold text-zinc-900">{formatINR(totalRefunded, { whole: true })} refunded</p>
        </div>
        <ReceiptText className="size-5 text-zinc-300" />
      </div>
      <ul className="mt-2 divide-y divide-zinc-100">
        {refunds.map((r) => (
          <li key={r.creditNoteId}>
            <button onClick={() => navigate(`/credit/${r.creditNoteId}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-zinc-50">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] font-semibold text-zinc-900">{r.creditNoteNumber}</p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(r.createdAt)} · {pluralize(r.units, 'item')} · against {r.invoiceNumber}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-900 tabular-nums">{formatINR(r.amount)}</p>
                <p className="text-[11px] text-zinc-400">{r.method === 'cash' ? 'cash' : 'to source'}{r.pointsReturned ? ` · +${r.pointsReturned} pts` : ''}</p>
              </div>
              <ChevronRight className="size-4 text-zinc-300" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function SettingsCard() {
  const { theme, setTheme } = useTheme();
  const { canInstall, installed, ios, install } = usePwaInstall();
  const toast = useToast();

  const onInstall = async () => {
    const outcome = await install();
    if (outcome === 'accepted') toast({ tone: 'success', title: 'FlashCart is being installed', description: 'Find it on your home screen.' });
  };

  return (
    <Card className="p-5">
      <Eyebrow>App settings</Eyebrow>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Appearance</p>
          <div className="mt-2 inline-flex rounded-xl bg-zinc-100/80 p-1 ring-1 ring-inset ring-zinc-200/60">
            {THEME_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setTheme(o.value)}
                aria-pressed={theme === o.value}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition ${theme === o.value ? 'bg-white text-zinc-900 shadow-card ring-1 ring-zinc-900/5' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                <o.icon className="size-3.5" /> {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400">Dark mode is easier on the eyes in dim showrooms. Receipts always print in light.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Install FlashCart</p>
          {installed ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[13px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <Download className="size-4" /> Installed on this device
            </p>
          ) : canInstall ? (
            <Button className="mt-2" icon={Download} onClick={onInstall}>
              Add to home screen
            </Button>
          ) : ios ? (
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
              In Safari tap <Share className="inline size-4 align-text-bottom text-brand-600" /> <span className="font-medium text-zinc-700">Share</span>, then{' '}
              <span className="font-medium text-zinc-700">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">Open this page in Chrome or Edge and use the browser’s “Install app” option. It works offline and opens like a native app.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
