import { ArrowRight, Banknote, ChevronRight, CreditCard, Keyboard, LayoutGrid, ReceiptText, ScanBarcode, ShoppingBag, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Barcode } from '../../components/Barcode.jsx';
import { ShowroomIcon } from '../../components/ProductTile.jsx';
import { TransactionStatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, Eyebrow, Skeleton } from '../../components/ui/misc.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, formatINR, formatPhone, pluralize } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';
import CatalogSheet from './CatalogSheet.jsx';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Landing screen after sign-in: what's in the bag, how to add more, where to shop, past bills. */
export default function CustomerHome({ onOpenReceipts }) {
  const { customer, cart, catalog, loadCatalog, config } = useShop();
  const [sheet, setSheet] = useState(null); // null | { mode, category }
  const [receipts, setReceipts] = useState({ loading: true, list: [] });

  useEffect(() => {
    loadCatalog().catch(() => {});
    api
      .myReceipts()
      .then(({ receipts: list }) => setReceipts({ loading: false, list: list.slice(0, 3) }))
      .catch(() => setReceipts({ loading: false, list: [] }));
  }, [loadCatalog]);

  const showrooms = useMemo(() => {
    if (!catalog) return null;
    return catalog.showrooms.map((s) => {
      const products = catalog.products.filter((p) => p.showroomId === s.id);
      const gst = catalog.categories.find((c) => c.id === s.category)?.gstRate;
      return { ...s, count: products.length, gst };
    });
  }, [catalog]);

  const summary = cart?.summary;

  return (
    <div className="space-y-8 animate-fade-up">
      <header>
        <Eyebrow>{config?.mall.name ?? 'FlashCart'}</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-[30px]">{greeting()}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Signed in as <span className="font-medium text-zinc-700 tabular-nums">{formatPhone(customer?.phone)}</span>
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Primary action */}
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white shadow-brand sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="relative grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Scan &amp; go</p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">Scan a product barcode</h2>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/75">
                Point your camera at the barcode on any tag in the mall. It goes straight into your bag, priced at the MRP printed on the tag.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Button size="lg" icon={ScanBarcode} onClick={() => navigate('/shop/scan')} className="bg-white! text-brand-700! shadow-lift hover:bg-brand-50!">
                  Open scanner
                </Button>
                <Button size="lg" variant="glass" icon={Keyboard} onClick={() => setSheet({ mode: 'code', category: 'all' })}>
                  Type barcode
                </Button>
              </div>
            </div>
            <div className="hidden md:block" aria-hidden>
              <div className="relative rotate-[-4deg] rounded-2xl bg-white p-4 pb-3 shadow-lift">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">MRP ₹2,999 · incl. taxes</p>
                <Barcode value="4070034130499" height={52} barWidth={1.6} />
                <span className="absolute inset-x-2 top-[56%] h-[2px] rounded-full bg-red-500 shadow-[0_0_12px_3px_rgb(239_68_68/0.5)] animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        {/* Bag */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between">
              <div>
                <Eyebrow>Your bag</Eyebrow>
                <p className="mt-1 text-[15px] font-semibold text-zinc-900">
                  {summary?.units ? `${pluralize(summary.units, 'item')} · ${pluralize(cart.groups.length, 'store')}` : 'Empty for now'}
                </p>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{formatINR(summary?.grandTotal ?? 0)}</p>
            </div>
            {cart?.groups.length ? (
              <ul className="mt-4 space-y-2.5">
                {cart.groups.slice(0, 3).map((g) => (
                  <li key={g.showroomId} className="flex items-center gap-3">
                    <ShowroomIcon showroomId={g.showroomId} className="size-8" />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{g.items.map((i) => i.name).join(', ')}</span>
                    <span className="text-sm font-medium text-zinc-900 tabular-nums">{formatINR(g.total, { whole: true })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                <ShoppingBag className="size-5 shrink-0 text-zinc-300" />
                Scan a barcode or browse the catalog to add your first item.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 bg-zinc-50/60 p-3">
            <Button variant="secondary" onClick={() => navigate('/shop/bag')} disabled={!summary?.units}>
              Review bag
            </Button>
            <Button iconRight={ArrowRight} onClick={() => navigate('/shop/checkout')} disabled={!summary?.units}>
              Checkout
            </Button>
          </div>
        </Card>
      </div>

      {/* Showrooms */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <Eyebrow>Shop by showroom</Eyebrow>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">Everything in the mall, one bill</h2>
          </div>
          <Button variant="ghost" size="sm" icon={LayoutGrid} onClick={() => setSheet({ mode: 'browse', category: 'all' })}>
            All products
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {showrooms
            ? showrooms.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSheet({ mode: 'browse', category: s.category })}
                  className="group rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lift"
                >
                  <ShowroomIcon showroomId={s.id} className="size-10 rounded-xl" />
                  <p className="mt-3 text-sm font-semibold text-zinc-900">{s.name}</p>
                  <p className="text-xs text-zinc-500">
                    {pluralize(s.count, 'product')} · GST {s.gst}%
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-400">
                    {s.floor} · {s.unit}
                  </p>
                </button>
              ))
            : Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[134px] rounded-2xl" />)}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent receipts */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <Eyebrow>Recent receipts</Eyebrow>
            {receipts.list.length > 0 && (
              <button onClick={onOpenReceipts} className="text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                View all
              </button>
            )}
          </div>
          {receipts.loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : receipts.list.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-zinc-500">
              <ReceiptText className="size-5 text-zinc-300" /> Your bills will appear here after checkout.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {receipts.list.map((r) => (
                <li key={r.transactionId}>
                  <button onClick={() => navigate(`/receipt/${r.transactionId}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-zinc-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] font-semibold text-zinc-900">{r.invoiceNumber}</p>
                      <p className="text-xs text-zinc-500">
                        {formatDateTime(r.issuedAt)} · {pluralize(r.units, 'item')}
                      </p>
                    </div>
                    <TransactionStatusBadge status={r.status} />
                    <span className="w-20 text-right text-sm font-semibold text-zinc-900 tabular-nums">{formatINR(r.grandTotal, { whole: true })}</span>
                    <ChevronRight className="size-4 text-zinc-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Ways to pay */}
        <Card className="p-5">
          <Eyebrow>Ways to pay</Eyebrow>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { icon: Smartphone, title: 'UPI', body: 'GPay, PhonePe, Paytm' },
              { icon: CreditCard, title: 'Card', body: 'Visa, Mastercard, RuPay' },
              { icon: Banknote, title: 'Cash', body: 'At the cash desk' },
            ].map((m) => (
              <div key={m.title} className="rounded-xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200/60">
                <m.icon className="size-5 text-brand-600" />
                <p className="mt-2 text-sm font-semibold text-zinc-900">{m.title}</p>
                <p className="text-[11.5px] leading-snug text-zinc-500">{m.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
            Paying cash? Check out with <span className="font-medium text-zinc-700">Cash at the cash desk</span>, then show the bill barcode or tell the cashier your phone number.
          </p>
        </Card>
      </div>

      <CatalogSheet open={sheet !== null} mode={sheet?.mode ?? 'browse'} initialCategory={sheet?.category ?? 'all'} onClose={() => setSheet(null)} />
    </div>
  );
}
