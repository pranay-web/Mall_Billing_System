import { ArrowRight, History, Keyboard, LayoutGrid, ShoppingBag } from 'lucide-react';
import { useCallback, useState } from 'react';
import { BarcodeScanner } from '../../components/BarcodeScanner.jsx';
import { ProductTile, ShowroomIcon } from '../../components/ProductTile.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, Eyebrow } from '../../components/ui/misc.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { formatINR, pluralize, timeAgo } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';
import CatalogSheet from './CatalogSheet.jsx';
import { useScanToBag } from './useScanToBag.js';

export default function ScanView() {
  const { cart, recentScans, loadCatalog } = useShop();
  const { submit, busy } = useScanToBag();
  const [sheet, setSheet] = useState(null); // null | 'browse' | 'code'
  const onDetected = useCallback((code) => submit(code), [submit]);

  const simulate = useCallback(async () => {
    try {
      const { products } = await loadCatalog();
      const inStock = products.filter((p) => p.inStock);
      const pick = inStock[Math.floor(Math.random() * inStock.length)];
      if (pick) submit(pick.barcode);
    } catch {
      /* surfaced by submit/toast */
    }
  }, [loadCatalog, submit]);

  const summary = cart?.summary;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <section className="min-w-0 animate-fade-up">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Barcode scanner</Eyebrow>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-[28px]">Scan a product barcode</h1>
            <p className="mt-1 text-sm text-zinc-500">Hold the tag’s barcode inside the frame. It’s added to your bag automatically.</p>
          </div>
        </div>

        <BarcodeScanner
          autoStart
          paused={busy}
          onDetected={onDetected}
          onManualEntry={() => setSheet('code')}
          onSimulate={simulate}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" icon={Keyboard} onClick={() => setSheet('code')}>
            Type barcode
          </Button>
          <Button variant="secondary" size="lg" icon={LayoutGrid} onClick={() => setSheet('browse')}>
            Browse catalog
          </Button>
        </div>
      </section>

      <aside className="space-y-5 lg:pt-[76px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <Eyebrow>Your bag</Eyebrow>
              <p className="mt-1 text-[15px] font-semibold text-zinc-900">
                {summary?.units ? pluralize(summary.units, 'item') : 'Empty'}
                {cart?.groups.length ? <span className="font-normal text-zinc-400"> · {pluralize(cart.groups.length, 'store')}</span> : null}
              </p>
            </div>
            <p className="text-right text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
              {formatINR(summary?.grandTotal ?? 0)}
            </p>
          </div>
          {cart?.groups.length ? (
            <ul className="space-y-1 px-3 pb-2">
              {cart.groups.map((g) => (
                <li key={g.showroomId} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <ShowroomIcon showroomId={g.showroomId} className="size-8" />
                  <span className="flex-1 text-sm font-medium text-zinc-700">{g.showroom}</span>
                  <span className="text-xs text-zinc-400">{g.units}×</span>
                  <span className="w-20 text-right text-sm font-medium text-zinc-900 tabular-nums">{formatINR(g.total, { whole: true })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-4 text-sm text-zinc-500">Scan your first item to start a unified bill.</p>
          )}
          <div className="border-t border-zinc-100 bg-zinc-50/60 p-3">
            <Button className="w-full" variant={summary?.units ? 'primary' : 'secondary'} iconRight={ArrowRight} onClick={() => navigate('/shop/bag')} disabled={!summary?.units}>
              Review bag
            </Button>
          </div>
        </Card>

        <div>
          <div className="mb-2.5 flex items-center gap-2 px-1">
            <History className="size-3.5 text-zinc-400" />
            <Eyebrow>Recently scanned</Eyebrow>
          </div>
          {recentScans.length ? (
            <ul className="space-y-2">
              {recentScans.map((item) => (
                <li key={item.itemId} className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-card animate-fade-up">
                  <ProductTile item={item} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-400">
                      {item.showroom} · {timeAgo(item.scannedAt)}
                    </p>
                  </div>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600 tabular-nums">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-400">
              <ShoppingBag className="size-4" /> Items you scan will appear here.
            </div>
          )}
        </div>
      </aside>

      <CatalogSheet open={sheet !== null} mode={sheet ?? 'browse'} onClose={() => setSheet(null)} />
    </div>
  );
}
