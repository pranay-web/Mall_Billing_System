import { Check, CornerDownLeft, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductTile } from '../../components/ProductTile.jsx';
import { GstTag } from '../../components/ui/Badge.jsx';
import { Sheet } from '../../components/ui/Sheet.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Skeleton, Spinner } from '../../components/ui/misc.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { formatINR } from '../../lib/format.js';
import { useScanToBag } from './useScanToBag.js';

/** Manual barcode entry + searchable, filterable product catalog. */
export default function CatalogSheet({ open, onClose, mode = 'browse', initialCategory = 'all' }) {
  const { catalog, loadCatalog, cart } = useShop();
  const { submit, busyCode } = useScanToBag();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loadError, setLoadError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCategory(initialCategory);
    setLoadError(null);
    loadCatalog({ force: true }).catch(setLoadError);
  }, [open, initialCategory, loadCatalog]);

  const inBag = useMemo(() => new Map(cart?.items.map((i) => [i.productId, i.quantity]) ?? []), [cart]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.products.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!q || [p.name, p.description, p.showroom, p.barcode, p.sku].some((f) => f.toLowerCase().includes(q))),
    );
  }, [catalog, query, category]);

  const looksLikeCode = /^[A-Za-z0-9-]{4,}$/.test(query.trim());

  const onSubmit = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Exact code → add it. Otherwise if the search narrows to one product, add that.
    const exact = catalog?.products.find((p) => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase());
    const target = exact?.barcode ?? (results.length === 1 ? results[0].barcode : looksLikeCode ? q : null);
    if (!target) return;
    const res = await submit(target);
    // Clear on success; on failure select the text so the next scan / keystroke replaces it.
    if (res) setQuery('');
    else inputRef.current?.select();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'code' ? 'Add by code' : 'Browse catalog'}
      description="Type a barcode or SKU, or search across every showroom."
      initialFocusRef={inputRef}
      wide
    >
      <form onSubmit={onSubmit} className="sticky top-0 z-10 -mx-1 bg-white px-1 pb-3">
        <div className="flex h-12 items-center gap-2.5 rounded-xl bg-zinc-100/80 px-3.5 ring-1 ring-inset ring-zinc-200/70 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500">
          <Search className="size-[18px] shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 8905310522667, FZ-SHIRT or “polo”"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            aria-label="Barcode, SKU or product name"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="rounded-full p-1 text-zinc-400 hover:text-zinc-700" aria-label="Clear">
              <X className="size-4" />
            </button>
          )}
        </div>
        {query.trim() && (looksLikeCode || results.length === 1) && (
          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-between rounded-xl bg-brand-50 px-3.5 py-2.5 text-left text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-500/15 transition hover:bg-brand-100/70 animate-fade-in"
          >
            <span className="truncate">
              {results.length === 1 ? `Add ${results[0].name}` : <>Add code <span className="font-mono">{query.trim()}</span></>}
            </span>
            {busyCode ? <Spinner /> : <CornerDownLeft className="size-4" />}
          </button>
        )}

        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {[{ id: 'all', label: 'All' }, ...(catalog?.categories ?? [])].map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${category === c.id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'}`}
            >
              {c.label}
              {c.gstRate ? <span className={`ml-1.5 text-[11px] ${category === c.id ? 'text-white/60' : 'text-zinc-400'}`}>{c.gstRate}%</span> : null}
            </button>
          ))}
        </div>
      </form>

      {loadError && <Alert tone="error" title="Catalog unavailable">{loadError.message}</Alert>}

      {!catalog && !loadError ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : catalog && results.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-zinc-900">No products match “{query}”</p>
          <p className="mt-1 text-sm text-zinc-500">{looksLikeCode ? 'Press Enter to try this code anyway.' : 'Try a different name or category.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((p) => {
            const qty = inBag.get(p.id) ?? 0;
            const soldOut = !p.inStock || qty >= p.stock;
            const adding = busyCode === p.barcode;
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 transition hover:border-zinc-300">
                <ProductTile item={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-900">{p.name}</p>
                  </div>
                  <p className="truncate text-xs text-zinc-500">{p.showroom} · <span className="font-mono">{p.sku}</span></p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">{formatINR(p.mrp, { whole: true })}</span>
                    <span className="text-[11px] text-zinc-400">incl.</span>
                    <GstTag rate={p.gstRate} />
                    {!p.inStock ? (
                      <span className="text-[11px] font-semibold text-red-600">Out of stock</span>
                    ) : p.stock <= 5 ? (
                      <span className="text-[11px] font-semibold text-amber-600">Only {p.stock} left</span>
                    ) : null}
                  </div>
                </div>
                <button
                  onClick={() => submit(p.barcode)}
                  disabled={soldOut || adding}
                  aria-label={`Add ${p.name} to bag`}
                  className={`relative grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed ${qty ? 'bg-brand-500 text-white shadow-brand hover:bg-brand-600' : 'bg-zinc-900 text-white hover:bg-zinc-800'} disabled:bg-zinc-100 disabled:text-zinc-300 disabled:shadow-none`}
                >
                  {adding ? <Spinner /> : soldOut && qty ? <Check className="size-4" /> : <Plus className="size-[18px]" strokeWidth={2.4} />}
                  {qty > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200 tabular-nums">
                      {qty}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
