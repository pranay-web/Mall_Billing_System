import { CreditCard, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Sheet } from '../../components/ui/Sheet.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { api } from '../../lib/api.js';
import { formatINR } from '../../lib/format.js';

/**
 * Stand-in for Razorpay Checkout when no keys are configured. The backend
 * signs the payment exactly like Razorpay would, so /verify runs the real HMAC check.
 */
export default function MockGatewaySheet({ order, method, onClose, onSuccess, onFailure }) {
  const { sessionId } = useShop();
  const [channel, setChannel] = useState(method === 'card' ? 'card' : 'upi');
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (order) {
      setChannel(method === 'card' ? 'card' : 'upi');
      setError(null);
      setPending(null);
    }
  }, [order, method]);

  const attempt = async (outcome) => {
    setPending(outcome);
    setError(null);
    try {
      const res = await api.mockPay({ orderId: order.orderId, sessionId, method: channel, outcome });
      if (res.error) onFailure(res.error);
      else onSuccess(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(null);
    }
  };

  return (
    <Sheet open={Boolean(order)} onClose={pending ? undefined : onClose} title="Simulated gateway" description="Razorpay-compatible test checkout">
      {order && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-white shadow-lift">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/50">{order.merchant}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{formatINR(order.amount / 100)}</p>
            <p className="mt-3 font-mono text-[11px] text-white/40">{order.orderId}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'upi', label: 'UPI', icon: Smartphone, hint: 'success@razorpay' },
              { id: 'card', label: 'Card', icon: CreditCard, hint: 'Visa •••• 1111' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition ${channel === c.id ? 'border-brand-500 bg-brand-50/50 shadow-[0_0_0_3px_rgb(0_102_255/0.12)]' : 'border-zinc-200 hover:border-zinc-300'}`}
              >
                <c.icon className={`size-5 ${channel === c.id ? 'text-brand-600' : 'text-zinc-500'}`} />
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">{c.label}</span>
                  <span className="block font-mono text-[11px] text-zinc-500">{c.hint}</span>
                </span>
              </button>
            ))}
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="space-y-2">
            <Button size="lg" className="w-full" icon={ShieldCheck} loading={pending === 'success'} disabled={Boolean(pending)} onClick={() => attempt('success')}>
              Approve {formatINR(order.amount / 100)}
            </Button>
            <Button size="lg" variant="danger" className="w-full" icon={XCircle} loading={pending === 'failure'} disabled={Boolean(pending)} onClick={() => attempt('failure')}>
              Simulate decline
            </Button>
          </div>
          <p className="text-center text-xs leading-relaxed text-zinc-400">
            Add <code className="font-mono">RAZORPAY_KEY_ID</code> / <code className="font-mono">RAZORPAY_KEY_SECRET</code> to <code className="font-mono">backend/.env</code> to use real Razorpay Checkout.
          </p>
        </div>
      )}
    </Sheet>
  );
}
