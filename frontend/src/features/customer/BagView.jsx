import { ArrowRight, Minus, Plus, ScanLine, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ProductTile, ShowroomIcon } from '../../components/ProductTile.jsx';
import { GstTag } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, EmptyState, Eyebrow } from '../../components/ui/misc.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { formatINR, pluralize } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';
import { MobileActionBar } from './MobileActionBar.jsx';
import { SettlementSummary } from './SettlementSummary.jsx';

export default function BagView() {
  const { cart } = useShop();

  if (!cart.items.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your bag is empty"
        description="Scan items in any showroom — they all land here, grouped by store, on a single bill."
        action={
          <Button icon={ScanLine} onClick={() => navigate('/shop/scan')}>
            Start scanning
          </Button>
        }
        className="py-24"
      />
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <section className="min-w-0 space-y-4 animate-fade-up">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>Unified bag</Eyebrow>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-[28px]">Your bag</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {pluralize(cart.summary.units, 'item')} from {pluralize(cart.groups.length, 'showroom')}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={ScanLine} onClick={() => navigate('/shop/scan')}>
            Scan more
          </Button>
        </div>

        {cart.groups.map((group) => (
          <ShowroomGroup key={group.showroomId} group={group} />
        ))}
      </section>

      <aside className="lg:sticky lg:top-24">
        <SettlementSummary cart={cart}>
          <Button size="lg" className="w-full" iconRight={ArrowRight} onClick={() => navigate('/shop/checkout')}>
            Proceed to checkout
          </Button>
        </SettlementSummary>
      </aside>

      <MobileActionBar>
        <Button size="xl" className="w-full justify-between! shadow-lift" onClick={() => navigate('/shop/checkout')}>
          <span>Checkout</span>
          <span className="flex items-center gap-2 tabular-nums">
            {formatINR(cart.summary.grandTotal)} <ArrowRight className="size-5" />
          </span>
        </Button>
      </MobileActionBar>
    </div>
  );
}

function ShowroomGroup({ group }) {
  return (
    <Card className="overflow-hidden">
      <header className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/50 px-4 py-3 sm:px-5">
        <ShowroomIcon showroomId={group.showroomId} className="size-9" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-zinc-900">{group.showroom}</h2>
          <p className="text-xs text-zinc-500">{pluralize(group.units, 'item')}</p>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-semibold text-zinc-900 tabular-nums">{formatINR(group.total)}</p>
          <p className="text-[11px] text-zinc-400 tabular-nums">incl. {formatINR(group.tax)} GST</p>
        </div>
      </header>
      <ul className="divide-y divide-zinc-100">
        {group.items.map((item) => (
          <CartItemRow key={item.itemId} item={item} />
        ))}
      </ul>
    </Card>
  );
}

function CartItemRow({ item }) {
  const { setQuantity, removeItem } = useShop();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const atMax = item.quantity >= item.maxQuantity;

  const run = async (fn) => {
    setPending(true);
    try {
      await fn();
    } catch (err) {
      toast({ tone: err.code === 'OUT_OF_STOCK' ? 'warning' : 'error', title: "Couldn't update bag", description: err.message });
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="flex gap-3.5 px-4 py-4 sm:px-5">
      <ProductTile item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-zinc-900">{item.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span className="tabular-nums">{formatINR(item.unitMrp, { whole: true })} each</span>
              <GstTag rate={item.gstRate} />
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-semibold text-zinc-900 tabular-nums">{formatINR(item.total)}</p>
            <p className="text-[11px] text-zinc-400 tabular-nums">incl. {formatINR(item.tax)} GST</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className={`inline-flex items-center rounded-xl bg-zinc-100/80 p-0.5 ring-1 ring-inset ring-zinc-200/60 transition ${pending ? 'opacity-70' : ''}`}>
            <StepButton
              onClick={() => run(() => (item.quantity <= 1 ? removeItem(item.itemId) : setQuantity(item.itemId, item.quantity - 1)))}
              label={item.quantity <= 1 ? `Remove ${item.name}` : `Decrease ${item.name}`}
              disabled={pending}
              danger={item.quantity <= 1}
            >
              {item.quantity <= 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" strokeWidth={2.5} />}
            </StepButton>
            <span key={item.quantity} className="w-9 text-center text-sm font-semibold text-zinc-900 tabular-nums animate-fade-in" aria-live="polite">
              {item.quantity}
            </span>
            <StepButton
              onClick={() => run(() => setQuantity(item.itemId, item.quantity + 1))}
              label={`Increase ${item.name}`}
              disabled={pending || atMax}
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
            </StepButton>
          </div>
          <div className="flex items-center gap-3">
            {atMax && <span className="text-[11px] font-medium text-amber-600">{item.available <= item.maxQuantity ? `Only ${item.available} in stock` : 'Max per order'}</span>}
            {item.quantity > 1 && (
              <button
                onClick={() => run(() => removeItem(item.itemId))}
                disabled={pending}
                className="text-xs font-medium text-zinc-400 transition hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

const StepButton = ({ children, label, danger, ...props }) => (
  <button
    aria-label={label}
    className={`grid size-8 place-items-center rounded-[10px] bg-white text-zinc-700 shadow-card ring-1 ring-zinc-900/5 transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'hover:text-red-600' : 'hover:text-zinc-900'}`}
    {...props}
  >
    {children}
  </button>
);
