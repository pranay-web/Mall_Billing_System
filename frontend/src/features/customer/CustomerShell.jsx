import { CreditCard, House, LogOut, ReceiptText, RefreshCw, ScanBarcode, ShoppingBag, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppHeader, Segmented } from '../../components/AppHeader.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, Spinner } from '../../components/ui/misc.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { formatINR, formatPhone } from '../../lib/format.js';
import { navigate } from '../../lib/router.js';
import BagView from './BagView.jsx';
import CheckoutView from './CheckoutView.jsx';
import CustomerHome from './CustomerHome.jsx';
import ReceiptsSheet from './ReceiptsSheet.jsx';
import ScanView from './ScanView.jsx';

const TABS = [
  { value: 'home', label: 'Home', icon: House, path: '/shop' },
  { value: 'scan', label: 'Scan', icon: ScanBarcode, path: '/shop/scan' },
  { value: 'bag', label: 'Bag', icon: ShoppingBag, path: '/shop/bag' },
  { value: 'checkout', label: 'Pay', icon: CreditCard, path: '/shop/checkout' },
];

export default function CustomerShell({ tab }) {
  const { ensureSession, refreshCart, status, error, units, cart, customer, logout } = useShop();
  const [receiptsOpen, setReceiptsOpen] = useState(false);

  useEffect(() => {
    ensureSession().catch(() => {});
  }, [ensureSession]);

  // The bag lives on the server (the same number can shop from two phones) — resync on every tab switch.
  useEffect(() => {
    if (status === 'ready') refreshCart().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const go = (value) => navigate(TABS.find((t) => t.value === value).path);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        suffix="Shop"
        center={<Segmented value={tab} onChange={go} options={TABS.map((t) => ({ ...t, badge: t.value === 'bag' ? units : 0 }))} />}
        right={
          <>
            <span
              className="hidden rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200/70 sm:inline tabular-nums"
              title="Signed in with this phone number"
            >
              {formatPhone(customer?.phone)}
            </span>
            <Button variant="ghost" size="sm" icon={ReceiptText} onClick={() => setReceiptsOpen(true)} aria-label="Your receipts">
              <span className="hidden sm:inline">Receipts</span>
            </Button>
            <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} aria-label="Sign out">
              <span className="hidden lg:inline">Sign out</span>
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-44 pt-5 sm:px-6 md:pb-16 md:pt-8">
        {status === 'error' ? (
          <EmptyState
            icon={WifiOff}
            title="We couldn't open your bag"
            description={error?.message}
            action={
              <Button icon={RefreshCw} onClick={() => ensureSession().catch(() => {})}>
                Try again
              </Button>
            }
          />
        ) : !cart ? (
          <div className="grid place-items-center py-32 text-zinc-400">
            <Spinner className="size-6" />
          </div>
        ) : tab === 'bag' ? (
          <BagView />
        ) : tab === 'checkout' ? (
          <CheckoutView />
        ) : tab === 'scan' ? (
          <ScanView />
        ) : (
          <CustomerHome onOpenReceipts={() => setReceiptsOpen(true)} />
        )}
      </main>

      <ReceiptsSheet open={receiptsOpen} onClose={() => setReceiptsOpen(false)} />

      {/* Mobile tab bar */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/70 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <button
                key={t.value}
                onClick={() => go(t.value)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${active ? 'text-brand-600' : 'text-zinc-400 hover:text-zinc-700'}`}
              >
                <span className="relative">
                  <t.icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
                  {t.value === 'bag' && units > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9.5px] font-bold text-white ring-2 ring-white tabular-nums">
                      {units}
                    </span>
                  )}
                </span>
                {t.value === 'checkout' && cart?.summary.grandTotal ? formatINR(cart.summary.grandTotal, { whole: true }) : t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
