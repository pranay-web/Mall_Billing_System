import { Printer, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppHeader } from '../../components/AppHeader.jsx';
import { ProductTile } from '../../components/ProductTile.jsx';
import { Barcode } from '../../components/Barcode.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { GstTag } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Eyebrow, Skeleton } from '../../components/ui/misc.jsx';
import { api } from '../../lib/api.js';
import { formatINR } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';

/**
 * Printable shelf labels for every seeded product — open on a laptop (or print)
 * and scan them with the FlashCart customer app to demo the full flow.
 */
export default function LabelsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.products().then(setData).catch(setError);
  }, []);

  const grouped = data
    ? data.showrooms.map((s) => ({ ...s, products: data.products.filter((p) => p.showroomId === s.id) }))
    : [];

  return (
    <div className="min-h-dvh">
      <AppHeader
        suffix="Labels"
        right={
          <>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            <Button size="sm" icon={ScanLine} onClick={() => navigate('/shop/scan')}>
              Open scanner
            </Button>
          </>
        }
      />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 print:max-w-none print:p-0">
        <div className="mb-8 print:hidden">
          <Eyebrow>Demo kit</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-[28px]">Shelf labels</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Keep this page open on a laptop (or print it) and scan the barcodes with the customer app on your phone. Real tags work too: the Puma polo, Mufti shirt and Jean Paul Gaultier parfum are in the catalog with their printed EAN-13 codes and MRPs.
          </p>
        </div>

        {error && <Alert tone="error" title="Couldn't load catalog">{error.message}</Alert>}

        {!data && !error ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-10 print:space-y-6">
            {grouped.map((showroom) => (
              <section key={showroom.id} className="break-inside-avoid">
                <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-zinc-900">
                  {showroom.name}
                  <span className="text-xs font-normal text-zinc-400">
                    {showroom.floor} · {showroom.unit}
                  </span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-3 print:gap-3">
                  {showroom.products.map((p) => (
                    <article
                      key={p.id}
                      className="flex break-inside-avoid flex-col items-center rounded-2xl border border-zinc-200/80 bg-white p-5 text-center shadow-card print:rounded-lg print:p-3 print:shadow-none"
                    >
                      <div className="flex w-full items-center gap-2.5 text-left">
                        <ProductTile item={p} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900">{p.name}</p>
                          <p className="font-mono text-[11px] text-zinc-400">{p.sku}</p>
                        </div>
                      </div>
                      <div className="mt-5 w-full max-w-[220px]">
                        <Barcode value={p.barcode} height={70} barWidth={2} />
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">MRP</span>
                        <span className="text-lg font-semibold text-zinc-900 tabular-nums">{formatINR(p.mrp, { whole: true })}</span>
                        <GstTag rate={p.gstRate} />
                      </div>
                      <p className="text-[10.5px] text-zinc-400">Inclusive of all taxes</p>
                      <p className={`mt-1 text-[11px] ${p.stock <= 5 ? 'font-semibold text-amber-600' : 'text-zinc-400'}`}>
                        {p.inStock ? `${p.stock} in stock` : 'Out of stock'}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
