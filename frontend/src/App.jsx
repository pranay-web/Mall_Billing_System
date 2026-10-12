import { Suspense, lazy, useEffect } from 'react';
import { ToastProvider } from './components/ui/Toast.jsx';
import { Spinner } from './components/ui/misc.jsx';
import { ShopProvider, useShop } from './context/ShopContext.jsx';
import CustomerLogin, { NEXT_KEY } from './features/auth/CustomerLogin.jsx';
import Landing from './features/landing/Landing.jsx';
import { safeStorage } from './lib/api.js';
import { navigate, useRoute } from './lib/router.js';

// Route-level code splitting keeps the camera/QR libraries off the landing page.
const CustomerShell = lazy(() => import('./features/customer/CustomerShell.jsx'));
const CashDesk = lazy(() => import('./features/pos/CashDesk.jsx'));
const ReceiptView = lazy(() => import('./features/receipt/ReceiptView.jsx'));
const LabelsPage = lazy(() => import('./features/labels/LabelsPage.jsx'));

const TITLES = {
  login: 'Sign in',
  shop: 'Scan & Shop',
  receipt: 'Receipt',
  pos: 'Cash Desk',
  labels: 'Product Labels',
};

function Routes() {
  const { segments, path } = useRoute();
  const [root, sub] = segments;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = TITLES[root] ? `${TITLES[root]} · FlashCart` : 'FlashCart · Unified Mall Checkout';
  }, [root, path]);

  switch (root) {
    case undefined:
      return <Landing />;
    case 'login':
      return <CustomerLogin />;
    case 'shop':
      return (
        <RequireCustomer path={path}>
          <CustomerShell tab={['scan', 'bag', 'checkout'].includes(sub) ? sub : 'home'} />
        </RequireCustomer>
      );
    case 'receipt':
      return sub ? (
        <RequireCustomer path={path}>
          <ReceiptView key={sub} transactionId={sub} />
        </RequireCustomer>
      ) : (
        <Redirect to="/shop" />
      );
    case 'pos':
      return <CashDesk />;
    case 'labels':
      return <LabelsPage />;
    default:
      return <Redirect to="/" />;
  }
}

/** Sends signed-out shoppers to the phone sign-in, then back to where they were going. */
function RequireCustomer({ path, children }) {
  const { customer } = useShop();
  useEffect(() => {
    if (!customer) {
      safeStorage.set(NEXT_KEY, path, sessionStorage);
      navigate('/login', { replace: true });
    }
  }, [customer, path]);
  return customer ? children : null;
}

function Redirect({ to }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <ShopProvider>
        <Suspense
          fallback={
            <div className="grid min-h-dvh place-items-center text-zinc-400">
              <Spinner className="size-6" />
            </div>
          }
        >
          <Routes />
        </Suspense>
      </ShopProvider>
    </ToastProvider>
  );
}
