'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBrandingStore } from '@/stores/brandingStore';
import { AreaChart, HBars, Columns, StackedShare, Sparkline, fmtMoney } from '@/components/charts';
import { Banknote, ReceiptText, Gauge, Star, Sparkles, ArrowRight } from 'lucide-react';

interface Overview {
  kpis: {
    today: { revenue: number; bills: number; avgBill: number };
    week: {
      revenue: number; sessions: number; avgBill: number;
      revenueDelta: number | null; sessionsDelta: number | null; avgBillDelta: number | null;
    };
    tables: { total: number; occupied: number };
    rating: { avg: number; count: number } | null;
    upsell: { revenue: number; items: number };
  };
  days: { date: string; revenue: number; bills: number }[];
  topItems: { _id: string; name: string; totalQty: number; totalRevenue: number }[];
  hours: { hour: number; sessions: number }[];
  paymentMix: { _id: string | null; amount: number; count: number }[];
}

interface LatestReport {
  _id: string;
  createdAt: string;
  content: { healthScore: number; healthLabel: string; actions: { title: string }[] };
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', esewa: 'eSewa', khalti: 'Khalti', mobile_banking: 'Mobile banking', split: 'Split',
};

const CARD = 'bg-white dark:bg-[#131318] border border-black/[0.06] dark:border-white/[0.07] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
const MICRO = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-zinc-400';

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5 ${up ? 'text-green-700 bg-green-500/10 dark:text-green-400' : 'text-red-700 bg-red-500/10 dark:text-red-400'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

function StatTile({ icon, label, value, delta, spark, brand }: {
  icon: React.ReactNode; label: string; value: string; delta: number | null; spark?: number[]; brand: string;
}) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${brand}14`, color: brand }}>
          {icon}
        </span>
        <Delta pct={delta} />
      </div>
      <p className={MICRO}>{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-[26px] leading-8 font-bold tracking-tight text-gray-900 dark:text-zinc-100">{value}</p>
        {spark && spark.length > 1 && <Sparkline points={spark} />}
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function scoreColor(score: number) {
  return score >= 75 ? '#22c55e' : score >= 55 ? '#f59e0b' : score >= 35 ? '#fb923c' : '#ef4444';
}

export default function OwnerDashboard() {
  const { accessToken, loading: authLoading, user } = useAuthStore();
  const { branding } = useBrandingStore();
  const brand = branding.primaryColor || '#E85D04';
  const [data, setData] = useState<Overview | null>(null);
  const [latestReport, setLatestReport] = useState<LatestReport | null>(null);
  const [invAlert, setInvAlert] = useState<{ lowStock: number; outOfStock: number; auto86: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !accessToken) return;
    api.get<Overview>('/reports/overview', accessToken)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    api.get<{ reports: LatestReport[] }>('/ai/reports', accessToken)
      .then((d) => setLatestReport(d.reports[0] ?? null))
      .catch(() => {});
    api.get<{ counts: { lowStock: number; outOfStock: number; auto86: number } }>('/inventory/overview', accessToken)
      .then((d) => setInvAlert(d.counts))
      .catch(() => {});
  }, [accessToken, authLoading]);

  const spark14 = (key: 'revenue' | 'bills') => data?.days.slice(-14).map((d) => d[key]) ?? [];
  const week = data?.kpis.week;
  const today = data?.kpis.today;
  const tables = data?.kpis.tables;
  const rating = data?.kpis.rating;
  const upsell = data?.kpis.upsell;
  const occupancy = tables?.total ? tables.occupied / tables.total : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[27px] font-bold tracking-tight text-gray-900 dark:text-zinc-100">
            {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-400 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-300 bg-white dark:bg-[#131318] border border-black/[0.06] dark:border-white/[0.07] rounded-full px-3.5 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: brand }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: brand }} />
          </span>
          Last 30 days · live
        </span>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-lg px-4 py-3 mb-6">{error}</p>}

      {/* Inventory alert */}
      {invAlert && (invAlert.lowStock > 0 || invAlert.outOfStock > 0) && (
        <Link href="/inventory" className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 mb-4 hover:bg-amber-100 dark:hover:bg-amber-500/15 transition">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
            ⚠ {invAlert.outOfStock > 0 && `${invAlert.outOfStock} ingredient${invAlert.outOfStock === 1 ? '' : 's'} out of stock`}
            {invAlert.outOfStock > 0 && invAlert.lowStock > 0 && ' · '}
            {invAlert.lowStock > 0 && `${invAlert.lowStock} running low`}
            {invAlert.auto86 > 0 && ` — ${invAlert.auto86} dish${invAlert.auto86 === 1 ? '' : 'es'} auto-hidden from the menu`}
          </p>
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-400 shrink-0 inline-flex items-center gap-1">
            Open inventory <ArrowRight size={14} />
          </span>
        </Link>
      )}

      {/* Hero — today */}
      <div
        className={`${CARD} relative overflow-hidden p-6 sm:p-7 mb-4`}
        style={{ backgroundImage: `radial-gradient(600px 220px at 12% -20%, ${brand}1f, transparent 70%)` }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className={MICRO}>Today&apos;s revenue</p>
            <p className="mt-1.5 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-zinc-50">
              {today ? fmtMoney(today.revenue) : '—'}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-300">
              {today ? `${today.bills} bill${today.bills === 1 ? '' : 's'} settled · avg ${fmtMoney(Math.round(today.avgBill || 0))}` : 'Loading…'}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-1">
              <p className="text-xs text-gray-400 dark:text-zinc-400">last 14 days</p>
            </div>
            <Sparkline points={spark14('revenue')} width={180} height={44} />
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile brand={brand} icon={<Banknote size={18} />} label="Revenue · 7 days"
          value={week ? fmtMoney(week.revenue) : '—'} delta={week?.revenueDelta ?? null} spark={spark14('revenue')} />
        <StatTile brand={brand} icon={<ReceiptText size={18} />} label="Sessions · 7 days"
          value={week ? String(week.sessions) : '—'} delta={week?.sessionsDelta ?? null} spark={spark14('bills')} />
        <StatTile brand={brand} icon={<Gauge size={18} />} label="Average bill · 7 days"
          value={week ? fmtMoney(week.avgBill) : '—'} delta={week?.avgBillDelta ?? null} />
        <StatTile brand={brand} icon={<Sparkles size={18} />} label={`Upsells earned · 30 days${upsell?.items ? ` (${upsell.items} item${upsell.items === 1 ? '' : 's'})` : ''}`}
          value={upsell ? fmtMoney(upsell.revenue) : '—'} delta={null} />
      </div>

      {/* Revenue chart + live floor */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className={`${CARD} p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Revenue trend</h2>
            {data && (
              <p className="text-sm text-gray-400 dark:text-zinc-400">
                30-day total {fmtMoney(data.days.reduce((a, d) => a + d.revenue, 0))}
              </p>
            )}
          </div>
          <AreaChart data={data?.days.map((d) => ({ label: d.date, value: d.revenue })) ?? []} />
        </div>

        <div className="flex flex-col gap-4">
          {/* Floor */}
          <div className={`${CARD} p-5 flex-1`}>
            <p className={MICRO}>Floor right now</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
              {tables ? tables.occupied : '—'}
              <span className="text-base font-medium text-gray-400 dark:text-zinc-400"> / {tables?.total ?? '—'} tables</span>
            </p>
            <div className="mt-3 h-2.5 rounded-full overflow-hidden" style={{ background: `${brand}1a` }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${occupancy * 100}%`, background: brand }} />
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-400 mt-2">
              {!tables?.total ? 'Add tables in Tables & QR' :
               tables.occupied === 0 ? 'All quiet — no open sessions' :
               `${Math.round(occupancy * 100)}% of the floor is seated`}
            </p>
          </div>

          {/* Rating */}
          <div className={`${CARD} p-5 flex-1`}>
            <p className={MICRO}>Guest rating · 30 days</p>
            {rating ? (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">{rating.avg}</p>
                  <p className="text-sm text-gray-400 dark:text-zinc-400">/ 5</p>
                </div>
                <div className="mt-2 flex items-center gap-0.5" aria-label={`${rating.avg} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={17}
                      className={s <= Math.round(rating.avg) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-zinc-700'}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-zinc-400 mt-2">{rating.count} review{rating.count === 1 ? '' : 's'}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-400 dark:text-zinc-400">No reviews yet — guests rate after paying</p>
            )}
          </div>
        </div>
      </div>

      {/* Top items + hours */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className={`${CARD} p-5`}>
          <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-4">Top items by revenue</h2>
          <HBars items={data?.topItems.map((i) => ({ label: i.name, value: i.totalRevenue, sub: `×${i.totalQty}` })) ?? []} />
        </div>
        <div className={`${CARD} p-5`}>
          <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-4">
            Busiest hours <span className="text-xs font-normal text-gray-400 dark:text-zinc-400">· sessions opened</span>
          </h2>
          <Columns data={data?.hours.map((h) => ({ label: `${h.hour}:00`, value: h.sessions })) ?? []} />
        </div>
      </div>

      {/* Payment mix + AI teaser */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className={`${CARD} p-5`}>
          <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-4">
            Payment methods <span className="text-xs font-normal text-gray-400 dark:text-zinc-400">· 30 days</span>
          </h2>
          <StackedShare parts={data?.paymentMix.map((p) => ({ label: PAYMENT_LABELS[p._id ?? ''] ?? 'Other', value: p.amount })) ?? []} />
        </div>

        {/* AI analyst teaser */}
        <Link
          href="/ai-analyst"
          className="rounded-2xl p-5 text-white flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-shadow group"
          style={{ background: `linear-gradient(135deg, #14141f 45%, color-mix(in srgb, ${brand} 50%, #14141f))` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
                <Sparkles size={12} /> AI Business Analyst
              </p>
              {latestReport ? (
                <p className="mt-2 text-lg font-semibold leading-snug">
                  Health {latestReport.content.healthScore} · {latestReport.content.healthLabel}
                </p>
              ) : (
                <p className="mt-2 text-lg font-semibold leading-snug">Your first report is one click away</p>
              )}
              {latestReport?.content.actions?.[0] && (
                <p className="mt-1.5 text-sm text-white/60 leading-snug">Next up: {latestReport.content.actions[0].title}</p>
              )}
            </div>
            {latestReport && (
              <span
                className="shrink-0 w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold"
                style={{ borderColor: scoreColor(latestReport.content.healthScore) }}
              >
                {latestReport.content.healthScore}
              </span>
            )}
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 group-hover:text-white transition">
            {latestReport ? 'Open the full report' : 'Generate your first report'}
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </p>
        </Link>
      </div>
    </div>
  );
}
