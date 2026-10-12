import { ArrowRight, Banknote, Check, CreditCard, ReceiptText, ScanLine, ShieldCheck, Smartphone, Store, Tags, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppHeader } from '../../components/AppHeader.jsx';
import { ShowroomIcon } from '../../components/ProductTile.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { api } from '../../lib/api.js';
import { navigate } from '../../lib/router.js';

const SHOWROOMS = [
  { id: 'fashion-zone', name: 'Fashion Zone', gst: '18%', where: 'Level 1 · L1-04', sample: 'Shirts, denim, tees' },
  { id: 'tech-store', name: 'Tech Store', gst: '12%', where: 'Level 2 · L2-11', sample: 'Audio, chargers, cables' },
  { id: 'food-court', name: 'Food Court', gst: '5%', where: 'Level 3 · Food Court', sample: 'Pizza, burgers, coffee' },
  { id: 'jewelry-store', name: 'Jewelry Store', gst: '18%', where: 'Ground · G-02', sample: 'Gold, silver, pearls' },
  { id: 'beauty-lounge', name: 'Beauty Lounge', gst: '18%', where: 'Level 1 · L1-09', sample: 'Perfumes & grooming' },
];

const STEPS = [
  { icon: Smartphone, title: 'Sign in with your phone', body: 'Just your mobile number — no password, no OTP. Your bag and receipts are linked to it.' },
  { icon: ScanLine, title: 'Scan any barcode', body: 'Point your phone at the barcode on any tag in any showroom. Everything lands in one bag.' },
  { icon: CreditCard, title: 'Pay once', body: 'UPI or card via Razorpay, or cash at the desk where the cashier hands back exact change.' },
];

export default function Landing() {
  const [mall, setMall] = useState('Phoenix Grand Mall');
  useEffect(() => {
    api.config().then((c) => setMall(c.mall.name)).catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <AppHeader
        suffix="Retail"
        right={
          <>
            <Button variant="ghost" size="sm" icon={Tags} onClick={() => navigate('/labels')} className="max-sm:hidden">
              Product labels
            </Button>
            <Button variant="ghost" size="sm" icon={Store} onClick={() => navigate('/pos')} className="max-sm:hidden">
              Cashier login
            </Button>
            <Button size="sm" iconRight={ArrowRight} onClick={() => navigate('/shop')}>
              Start shopping
            </Button>
          </>
        }
      />

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[640px] bg-[radial-gradient(60%_50%_at_50%_0%,rgb(0_102_255/0.14),transparent_70%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:radial-gradient(rgb(24_24_27/0.08)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" aria-hidden />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-600 shadow-card ring-1 ring-zinc-200/80">
              <Zap className="size-3.5 text-brand-500" fill="currentColor" /> Live at {mall}
            </span>
            <h1 className="mt-6 text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] text-zinc-900 sm:text-6xl">
              One bag.
              <br />
              Every store.
              <br />
              <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">Zero queues.</span>
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-zinc-500">
              Scan products across every showroom in the mall, pay once with UPI, card or cash, and get a single GST invoice on your phone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="xl" iconRight={ArrowRight} onClick={() => navigate('/shop')}>
                Start shopping
              </Button>
              <Button size="xl" variant="secondary" icon={Store} onClick={() => navigate('/pos')}>
                Cashier login
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-medium text-zinc-500">
              {['Phone-number sign in', 'Razorpay UPI & cards', 'Cash desk with change calculator'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-500" strokeWidth={2.5} /> {t}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-zinc-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold text-zinc-900">Checkout that follows you around the mall</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-zinc-200/80 bg-canvas p-6">
                <div className="flex items-center justify-between">
                  <div className="grid size-11 place-items-center rounded-xl bg-white text-brand-600 shadow-card ring-1 ring-zinc-200/80">
                    <s.icon className="size-5" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-zinc-300">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-zinc-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showrooms */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Participating showrooms</p>
            <h2 className="mt-2 text-3xl font-semibold text-zinc-900">Five stores, one invoice</h2>
          </div>
          <Button variant="secondary" icon={Tags} onClick={() => navigate('/labels')}>
            Print demo labels
          </Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SHOWROOMS.map((s) => (
            <div key={s.id} className="group rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
              <ShowroomIcon showroomId={s.id} className="size-11 rounded-xl" />
              <h3 className="mt-4 font-semibold text-zinc-900">{s.name}</h3>
              <p className="text-[13px] text-zinc-500">{s.sample}</p>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                <span className="text-zinc-400">{s.where}</span>
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold text-zinc-600">GST {s.gst}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-zinc-400 sm:px-6">
          <p>© {new Date().getFullYear()} FlashCart · Smart Mall Billing</p>
          <div className="flex gap-5">
            <button onClick={() => navigate('/shop')} className="hover:text-zinc-700">Customer app</button>
            <button onClick={() => navigate('/pos')} className="hover:text-zinc-700">Cash desk</button>
            <button onClick={() => navigate('/labels')} className="hover:text-zinc-700">Product labels</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroPreview() {
  const rows = [
    { id: 'fashion-zone', name: 'Fashion Zone', items: 'Casual Shirt, Jeans', total: '₹2,006' },
    { id: 'tech-store', name: 'Tech Store', items: 'Wireless Earbuds', total: '₹2,240' },
    { id: 'food-court', name: 'Food Court', items: 'Cappuccino ×2', total: '₹168' },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[380px] animate-fade-up [animation-delay:120ms]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-brand-500/15 via-transparent to-emerald-400/10 blur-2xl" />

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 shadow-card">
          <ReceiptText className="size-3.5 text-brand-500" /> 1 GST invoice
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 shadow-card">
          <ShieldCheck className="size-3.5 text-emerald-500" /> UPI · Card · Cash
        </span>
      </div>

      <div className="rounded-[28px] border border-zinc-200/80 bg-white p-5 shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Your bag</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">5 items · 3 stores</p>
          </div>
          <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-500 tabular-nums">+91 98765 43210</span>
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200/60">
              <ShowroomIcon showroomId={r.id} className="size-9 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-zinc-900">{r.name}</p>
                <p className="truncate text-[11.5px] text-zinc-500">{r.items}</p>
              </div>
              <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">{r.total}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-end justify-between border-t border-dashed border-zinc-200 pt-4">
          <div>
            <p className="text-xs text-zinc-400">Incl. GST 5% · 12% · 18%</p>
            <p className="text-sm font-semibold text-zinc-900">Total payable</p>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">₹4,414</p>
        </div>
        <div className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-[15px] font-semibold text-white shadow-brand">
          <ShieldCheck className="size-4" /> Pay ₹4,414
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 pr-4 shadow-card">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <Banknote className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900">
            <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white">
              <Check className="size-2.5" strokeWidth={4} />
            </span>
            Paying cash? The desk does the maths
          </p>
          <p className="text-[11.5px] text-zinc-500">₹5,000 received · return ₹586</p>
        </div>
      </div>
    </div>
  );
}
