import { ArrowLeft, Banknote, Check, CreditCard, FlaskConical, LockKeyhole, ShoppingBag, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShowroomIcon } from '../../components/ProductTile.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, EmptyState, Eyebrow, Spinner } from '../../components/ui/misc.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { api } from '../../lib/api.js';
import { formatINR, pluralize } from '../../lib/format.js';
import { loadRazorpay } from '../../lib/razorpay.js';
import { navigate } from '../../lib/router.js';
import MockGatewaySheet from './MockGatewaySheet.jsx';
import { MobileActionBar } from './MobileActionBar.jsx';
import { SettlementSummary } from './SettlementSummary.jsx';

const METHODS = [
  { id: 'upi', icon: Smartphone, title: 'UPI', body: 'Google Pay, PhonePe, Paytm, BHIM', tag: 'Instant' },
  { id: 'card', icon: CreditCard, title: 'Credit / Debit card', body: 'Visa, Mastercard, RuPay, Amex' },
  { id: 'cash', icon: Banknote, title: 'Cash at the cash desk', body: 'Get your bill now, pay the cashier — they’ll hand back the change' },
];

export default function CheckoutView() {
  const { customer, cart, sessionId, config, completeCheckout, refreshCart } = useShop();
  const [method, setMethod] = useState('upi');
  const [phase, setPhase] = useState('idle'); // idle | creating | gateway | verifying | mock
  const [notice, setNotice] = useState(null); // { tone, title, message }
  const [mockOrder, setMockOrder] = useState(null);
  const failureRef = useRef(null);

  if (!cart.items.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Nothing to pay for yet"
        description="Add items to your bag, then come back here to pay once for every store."
        action={<Button onClick={() => navigate('/shop/scan')}>Start scanning</Button>}
        className="py-24"
      />
    );
  }

  const busy = phase !== 'idle';
  const mode = config?.payments.mode;
  const total = cart.summary.grandTotal;

  const finish = async (receipt) => {
    completeCheckout();
    navigate(`/receipt/${receipt.transactionId}`, { replace: true });
  };

  const fail = (err, fallbackTitle = 'Checkout failed') => {
    setPhase('idle');
    setNotice({ tone: err.code === 'OUT_OF_STOCK' ? 'warning' : 'error', title: fallbackTitle, message: err.message });
    if (err.code === 'OUT_OF_STOCK') refreshCart().catch(() => {});
  };

  const verify = async (payload) => {
    setPhase('verifying');
    try {
      const receipt = await api.verifyPayment({ sessionId, ...payload });
      await finish(receipt);
    } catch (err) {
      fail(err, 'Payment verification failed');
    }
  };

  const pay = async () => {
    setNotice(null);
    failureRef.current = null;
    setPhase('creating');
    try {
      if (method === 'cash') {
        await finish(await api.payAtDesk(sessionId));
        return;
      }

      const order = await api.createOrder(sessionId);
      if (order.mode === 'mock') {
        setMockOrder(order);
        setPhase('mock');
        return;
      }

      const Razorpay = await loadRazorpay();
      let settled = false;
      const rzp = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'FlashCart',
        description: `${order.merchant} · ${pluralize(cart.summary.units, 'item')}`,
        // Without a contact Razorpay falls back to whichever number it remembers in this browser.
        prefill: { method, ...(customer?.phone && { contact: customer.phone }) },
        notes: { sessionId },
        theme: { color: '#0066FF', backdrop_color: 'rgba(9,9,11,0.6)' },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            if (settled) return;
            setPhase('idle');
            const failure = failureRef.current;
            setNotice(
              failure
                ? { tone: 'error', title: 'Payment failed', message: `${failure.description}${failure.metadata?.payment_id ? ` (Ref: ${failure.metadata.payment_id})` : ''}` }
                : { tone: 'info', title: 'Payment cancelled', message: 'No money was taken. You can try again whenever you’re ready.' },
            );
          },
        },
        handler: (response) => {
          settled = true;
          verify(response);
        },
      });
      rzp.on('payment.failed', ({ error }) => {
        failureRef.current = error;
      });
      setPhase('gateway');
      rzp.open();
    } catch (err) {
      fail(err, method === 'cash' ? 'Could not generate invoice' : 'Could not start payment');
    }
  };

  const payLabel = method === 'cash' ? 'Get bill & pay cash at desk' : `Pay ${formatINR(total)}`;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <section className="min-w-0 space-y-6 animate-fade-up">
        <div>
          <button onClick={() => navigate('/shop/bag')} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900">
            <ArrowLeft className="size-4" /> Back to bag
          </button>
          <Eyebrow>Checkout</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-[28px]">One payment for every store</h1>
          <p className="mt-1 text-sm text-zinc-500">Choose how you’d like to settle your unified bill.</p>
        </div>

        {notice && (
          <Alert tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
            {notice.message}
          </Alert>
        )}

        <fieldset className="space-y-2.5" disabled={busy}>
          <legend className="sr-only">Payment method</legend>
          {METHODS.map((m) => {
            const active = method === m.id;
            return (
              <label
                key={m.id}
                className={`group flex cursor-pointer items-center gap-4 rounded-2xl border bg-white p-4 transition ${active ? 'border-brand-500 shadow-[0_0_0_3px_rgb(0_102_255/0.12)]' : 'border-zinc-200/80 shadow-card hover:border-zinc-300'}`}
              >
                <input type="radio" name="method" value={m.id} checked={active} onChange={() => setMethod(m.id)} className="sr-only" />
                <div className={`grid size-11 shrink-0 place-items-center rounded-xl transition ${active ? 'bg-brand-500 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                  <m.icon className="size-5" strokeWidth={1.9} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
                    {m.title}
                    {m.tag && <Badge tone="success">{m.tag}</Badge>}
                  </p>
                  <p className="text-[13px] text-zinc-500">{m.body}</p>
                </div>
                <span className={`grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-inset transition ${active ? 'bg-brand-500 ring-brand-500' : 'ring-zinc-300'}`}>
                  {active && <Check className="size-3 text-white" strokeWidth={3.5} />}
                </span>
              </label>
            );
          })}
        </fieldset>

        {method !== 'cash' && mode && mode !== 'live' && (
          <div className="flex gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-4 text-[13px] text-zinc-600">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            {mode === 'mock' ? (
              <p>
                <span className="font-semibold text-zinc-900">Demo gateway.</span> Razorpay keys aren’t configured, so a simulated checkout signs the payment. Verification still runs HMAC-SHA256 on the server.
              </p>
            ) : (
              <p>
                <span className="font-semibold text-zinc-900">Razorpay test mode.</span> Pay with test card{' '}
                <code className="rounded bg-zinc-100 px-1 font-mono text-[12px]">4100 2800 0000 1007</code> (any future expiry and CVV), or UPI ID{' '}
                <code className="rounded bg-zinc-100 px-1 font-mono text-[12px]">success@razorpay</code> where UPI is offered. No real money moves.
              </p>
            )}
          </div>
        )}

        <Card className="p-5">
          <Eyebrow>Paying for</Eyebrow>
          <ul className="mt-3 space-y-3">
            {cart.groups.map((g) => (
              <li key={g.showroomId} className="flex items-center gap-3">
                <ShowroomIcon showroomId={g.showroomId} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{g.showroom}</p>
                  <p className="truncate text-xs text-zinc-500">{g.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
                </div>
                <span className="text-sm font-medium text-zinc-900 tabular-nums">{formatINR(g.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <aside className="lg:sticky lg:top-24">
        <SettlementSummary cart={cart} title="Order total">
          <Button size="lg" className="w-full" onClick={pay} loading={busy} icon={method === 'cash' ? Banknote : LockKeyhole}>
            {payLabel}
          </Button>
        </SettlementSummary>
      </aside>

      <MobileActionBar>
        <Button size="xl" className="w-full shadow-lift" onClick={pay} loading={busy} icon={method === 'cash' ? Banknote : LockKeyhole}>
          {payLabel}
        </Button>
      </MobileActionBar>

      <MockGatewaySheet
        order={phase === 'mock' ? mockOrder : null}
        method={method}
        onClose={() => {
          setPhase('idle');
          setNotice({ tone: 'info', title: 'Payment cancelled', message: 'No money was taken. You can try again whenever you’re ready.' });
        }}
        onFailure={(error) => {
          setPhase('idle');
          setNotice({ tone: 'error', title: 'Payment failed', message: error.description });
        }}
        onSuccess={verify}
      />

      {phase === 'verifying' &&
        createPortal(
          <div className="fixed inset-0 z-[90] grid place-items-center bg-white/80 backdrop-blur-md animate-fade-in">
            <div className="flex flex-col items-center text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-brand">
                <Spinner className="size-6" />
              </div>
              <p className="mt-4 text-base font-semibold text-zinc-900">Verifying payment</p>
              <p className="mt-1 text-sm text-zinc-500">Confirming the signature with the gateway…</p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
