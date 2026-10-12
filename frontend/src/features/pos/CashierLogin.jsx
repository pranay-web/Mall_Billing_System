import { Banknote, Eye, EyeOff, KeyRound, LogIn, Mail, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { AuthLayout, Field } from '../../components/AuthLayout.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { api, authStore } from '../../lib/api.js';
import { navigate } from '../../lib/router.js';

export default function CashierLogin({ onLogin, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your work email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.auth.cashierLogin(email.trim(), password);
      const account = { token: res.token, ...res.cashier };
      authStore.set('cashier', account);
      onLogin(account);
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Cash desk"
      title="Cashier sign in"
      subtitle="Use the email and password your store manager set up for you."
      aside={
        <>
          <div className="grid size-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Banknote className="size-6" />
          </div>
          <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.03em]">Cash in, change out — always balanced.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Pull up a customer’s bill, see exactly how much change to hand back, and close the day knowing what’s left in the drawer.
          </p>
        </>
      }
      footer={
        <button onClick={() => navigate('/login')} className="inline-flex items-center gap-1.5 font-medium text-zinc-500 transition hover:text-zinc-900">
          <ShoppingBag className="size-4" /> Shopping? Customer sign in
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {notice && <Alert tone="warning">{notice}</Alert>}
        <Field
          id="email"
          label="Work email"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder="you@mall.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leading={<Mail className="size-[18px] text-zinc-400" />}
        />
        <Field
          id="password"
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leading={<KeyRound className="size-[18px] text-zinc-400" />}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="rounded-md p-1 text-zinc-400 transition hover:text-zinc-700"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" icon={LogIn} loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
