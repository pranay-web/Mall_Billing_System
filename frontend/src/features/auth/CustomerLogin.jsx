import { ArrowRight, Check, Store } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AuthLayout, Field } from '../../components/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { safeStorage } from '../../lib/api.js';
import { navigate } from '../../lib/router.js';

export const NEXT_KEY = 'flashcart.next';

/** Keeps only digits and shows them as `98765 43210`. */
const formatInput = (raw) => {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
};

export default function CustomerLogin() {
  const { customer, login } = useShop();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const digits = phone.replace(/\D/g, '');
  const valid = /^[6-9]\d{9}$/.test(digits);

  const goNext = () => {
    const next = safeStorage.get(NEXT_KEY, sessionStorage);
    safeStorage.set(NEXT_KEY, null, sessionStorage);
    navigate(next && next.startsWith('/') && next !== '/login' ? next : '/shop', { replace: true });
  };

  // Already signed in → straight to the shop.
  useEffect(() => {
    if (customer) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) {
      setError('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.');
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(digits);
      goNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Customer sign in"
      title="Start shopping"
      subtitle="Enter your mobile number. It becomes your FlashCart ID, so your bag and receipts follow you."
      aside={
        <>
          <h2 className="text-4xl font-semibold leading-tight tracking-[-0.03em]">
            One bag for every store in the mall.
          </h2>
          <ul className="mt-8 space-y-3 text-[15px] text-white/75">
            {['Scan items in any showroom', 'Pay once with UPI, card or cash', 'One GST invoice on your phone'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </>
      }
      footer={
        <button onClick={() => navigate('/pos')} className="inline-flex items-center gap-1.5 font-medium text-zinc-500 transition hover:text-zinc-900">
          <Store className="size-4" /> Cashier? Sign in to the cash desk
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field
          id="phone"
          ref={inputRef}
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus
          placeholder="98765 43210"
          value={phone}
          onChange={(e) => {
            setPhone(formatInput(e.target.value));
            setError(null);
          }}
          error={Boolean(error)}
          leading={
            <span className="flex items-center gap-1.5 border-r border-zinc-200 pr-2.5 text-[15px] font-medium text-zinc-600">
              <span aria-hidden>🇮🇳</span> +91
            </span>
          }
          trailing={valid ? <Check className="size-4 text-emerald-500" strokeWidth={3} /> : null}
          hint="No password or OTP — just your number."
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" iconRight={ArrowRight} loading={loading} disabled={!digits}>
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
