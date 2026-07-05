'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

const dashboardRoutes: Record<string, string> = {
  platform_admin: '/admin',
  owner: '/dashboard',
  cashier: '/floor',
  kitchen: '/kds',
};

export default function LandingPage() {
  const { hydrate, user } = useAuthStore();
  useEffect(() => { hydrate(); }, [hydrate]);
  const appHref = user ? dashboardRoutes[user.role] || '/dashboard' : null;

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-gray-100">
        <nav className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block" />
            Waiterless
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#ai" className="hover:text-gray-900">AI Analyst</a>
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {appHref ? (
              <Link href={appHref} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">Sign in</Link>
                <Link href="/signup" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition">
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> AI-powered restaurant OS
          </span>
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.08]">
            Run your restaurant<br />
            <span className="text-orange-600">without the waiting.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-md">
            Guests order from a QR code. Your kitchen sees it instantly. Bills settle themselves.
            And every week, an AI analyst tells you exactly how to grow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700 transition shadow-sm">
              Start free 14-day trial
            </Link>
            <a href="#ai" className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              Meet the AI analyst
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400">No credit card required · set up in 5 minutes</p>
        </div>

        {/* CSS product mock */}
        <div className="relative hidden lg:block" aria-hidden="true">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-xl p-5 w-[26rem]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Today</p>
              <span className="text-xs text-green-600 font-medium bg-green-50 rounded-full px-2 py-0.5">▲ 12% vs last week</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-xl font-bold">NPR 48,250</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Tables live</p>
                <p className="text-xl font-bold">9 / 12</p>
              </div>
            </div>
            <svg viewBox="0 0 360 90" className="w-full">
              <polyline
                fill="rgba(234,88,12,0.08)"
                stroke="none"
                points="0,90 0,62 30,55 60,64 90,44 120,50 150,32 180,40 210,25 240,33 270,18 300,26 330,12 360,20 360,90"
              />
              <polyline
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points="0,62 30,55 60,64 90,44 120,50 150,32 180,40 210,25 240,33 270,18 300,26 330,12 360,20"
              />
            </svg>
          </div>
          <div className="absolute -bottom-8 -left-10 rounded-2xl border border-gray-200 bg-white shadow-lg p-4 w-56">
            <p className="text-xs font-semibold text-gray-500 mb-2">AI INSIGHT</p>
            <p className="text-sm leading-snug text-gray-800">
              “Momos sell 3× more after 7pm — add a combo to lift dinner revenue ~8%.”
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-center">Table to kitchen in seconds</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {[
              { n: '1', title: 'Guest scans the QR', body: 'Every table gets its own QR code. Guests browse your branded menu and order from their phone — no app install.' },
              { n: '2', title: 'Kitchen cooks, live', body: 'Orders appear on the kitchen display the moment they are placed. Statuses flow back to the guest in real time.' },
              { n: '3', title: 'Bill settles itself', body: 'Items accumulate on the table’s bill. Cashier closes with cash, eSewa, Khalti or mobile banking in one tap.' },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-white border border-gray-200 p-6">
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white text-sm font-bold flex items-center justify-center mb-4">{s.n}</div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight text-center">Everything a modern restaurant needs</h2>
        <p className="mt-3 text-center text-gray-500">One subscription. No hardware. Works on the devices you already own.</p>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: '📱', title: 'QR ordering', body: 'Branded digital menu with photos, tags and guest notes. Orders go straight to the kitchen.' },
            { icon: '🍳', title: 'Kitchen display', body: 'A live queue for your kitchen. Bump items through pending → preparing → ready → served.' },
            { icon: '🧾', title: 'Tables & billing', body: 'Open sessions, merge orders onto one bill, settle with local payment methods.' },
            { icon: '🤖', title: 'AI business analyst', body: 'Weekly plain-language reports: what sold, what stalled, and what to do about it.', highlight: true },
            { icon: '👥', title: 'Staff & roles', body: 'Invite cashiers and kitchen staff by email. Everyone sees only what their role needs.' },
            { icon: '🎨', title: 'Your brand', body: 'Colors, logo and tagline on every guest touchpoint. It looks like your restaurant, not ours.' },
          ].map((f) => (
            <div key={f.title} className={`rounded-2xl border p-6 ${f.highlight ? 'border-orange-300 bg-orange-50/50 ring-1 ring-orange-200' : 'border-gray-200'}`}>
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold">{f.title} {f.highlight && <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-orange-600 bg-orange-100 rounded-full px-2 py-0.5 align-middle">Selling point</span>}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Analyst spotlight ────────────────────────────── */}
      <section id="ai" className="bg-[#14141f] text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400 mb-6">
              ⭐ The Waiterless difference
            </span>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              A business analyst on staff.<br />For the price of software.
            </h2>
            <p className="mt-6 text-gray-300 leading-relaxed">
              Waiterless watches your sales so you don&apos;t have to. On demand — or every week —
              it analyses your revenue trends, menu performance, peak hours and payment mix, then
              writes you a report a consultant would charge for.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-gray-300">
              {[
                'Business health score with week-over-week movement',
                'Menu engineering: your stars, puzzles, plowhorses and dogs',
                'Concrete action items — pricing, combos, staffing hours',
                'Bring your own free Gemini or Groq API key',
              ].map((li) => (
                <li key={li} className="flex gap-3"><span className="text-orange-500">✓</span>{li}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-[#1d1d2b] border border-white/10 p-6 shadow-2xl" aria-hidden="true">
            <div className="flex items-center justify-between mb-5">
              <p className="font-semibold">Weekly business report</p>
              <span className="text-xs text-gray-400">Generated by AI · 2 min ago</span>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full border-4 border-green-500 flex items-center justify-center text-xl font-bold">82</div>
              <div>
                <p className="text-sm font-medium">Business health: Strong</p>
                <p className="text-xs text-gray-400">Revenue up 12% WoW · avg bill up NPR 85</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm">
                <span className="font-semibold text-green-400">Win · </span>Chicken Momo is your star: 22% of revenue at high margin.
              </div>
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm">
                <span className="font-semibold text-yellow-400">Watch · </span>Weekday lunch sessions down 18% — consider a lunch set.
              </div>
              <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3 text-sm">
                <span className="font-semibold text-orange-400">Do next · </span>Raise Butter Chicken price NPR 40; demand is inelastic.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight text-center">Simple pricing in NPR</h2>
        <p className="mt-3 text-center text-gray-500">Start free. Upgrade when your tables fill up.</p>
        <div className="mt-12 grid md:grid-cols-3 gap-6 items-stretch">
          {[
            { name: 'Trial', price: 'Free', period: '14 days', features: ['5 tables', '20 menu items', '3 staff accounts', 'QR ordering + kitchen display'], cta: 'Start trial' },
            { name: 'Basic', price: 'NPR 2,499', period: '/month', features: ['10 tables', '50 menu items', '5 staff accounts', 'Reports & analytics'], cta: 'Choose Basic' },
            { name: 'Pro', price: 'NPR 4,999', period: '/month', features: ['Unlimited tables & menu', 'Unlimited staff', 'AI business analyst ⭐', 'Priority support'], cta: 'Choose Pro', featured: true },
          ].map((p) => (
            <div key={p.name} className={`rounded-2xl border p-7 flex flex-col ${p.featured ? 'border-orange-400 ring-2 ring-orange-200 shadow-lg relative' : 'border-gray-200'}`}>
              {p.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-xs font-semibold rounded-full px-3 py-1">Most popular</span>}
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <p className="mt-3"><span className="text-3xl font-extrabold">{p.price}</span> <span className="text-sm text-gray-500">{p.period}</span></p>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-600 flex-1">
                {p.features.map((f) => <li key={f} className="flex gap-2"><span className="text-orange-600">✓</span>{f}</li>)}
              </ul>
              <Link href="/signup" className={`mt-7 rounded-lg px-4 py-2.5 text-sm font-semibold text-center transition ${p.featured ? 'bg-orange-600 text-white hover:bg-orange-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA + footer ──────────────────────────────── */}
      <section className="bg-gray-50 border-t border-gray-100">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Your first order could be 5 minutes away.</h2>
          <Link href="/signup" className="mt-6 inline-block rounded-lg bg-orange-600 px-8 py-3 text-sm font-semibold text-white hover:bg-orange-700 transition">
            Start free trial
          </Link>
        </div>
        <footer className="border-t border-gray-200">
          <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <p>© {new Date().getFullYear()} Waiterless. Built for restaurants that move fast.</p>
            <div className="flex gap-6">
              <a href="#features" className="hover:text-gray-600">Features</a>
              <a href="#pricing" className="hover:text-gray-600">Pricing</a>
              <Link href="/login" className="hover:text-gray-600">Sign in</Link>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
