'use client';
/**
 * TV mode — full-screen wall dashboard for the restaurant office/kitchen pass.
 * Always dark, huge type, zero interaction. Sign in as the owner on the TV
 * device and open /tv. Polls every 20s; waiter calls arrive live via socket.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBrandingStore } from '@/stores/brandingStore';
import { AuthGuard } from '@/components/AuthGuard';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { fmtMoney } from '@/components/charts';
import { BellRing, X } from 'lucide-react';

interface Overview {
  kpis: {
    today: { revenue: number; bills: number; avgBill: number };
    tables: { total: number; occupied: number };
    rating: { avg: number; count: number } | null;
  };
  topItems: { name: string; totalRevenue: number }[];
}
interface Session { _id: string; tableId: { label: string; zone?: string }; openedAt: string }
interface ActiveOrder {
  _id: string; createdAt: string;
  tableId: { label: string; zone?: string } | null;
  items: { name: string; qty: number; status: string }[];
}
interface WaiterCall { tableId: string; tableLabel: string; zone?: string; at: string }

const POLL_MS = 20_000;

function minsAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m === 0 ? 'now' : `${m}m`;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <p className="text-3xl font-bold tabular-nums tracking-tight">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      <span className="text-lg text-white/40 ml-3">{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
    </p>
  );
}

function TvBoard() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const { branding, load: loadBranding } = useBrandingStore();
  const brand = branding.primaryColor || '#E85D04';
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [calls, setCalls] = useState<WaiterCall[]>([]);

  const load = useCallback(() => {
    if (!accessToken) return;
    api.get<Overview>('/reports/overview', accessToken).then(setOverview).catch(() => {});
    api.get<{ sessions: Session[] }>('/sessions/active', accessToken).then((d) => setSessions(d.sessions)).catch(() => {});
    api.get<{ orders: ActiveOrder[] }>('/orders/active', accessToken).then((d) => setOrders(d.orders)).catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    loadBranding(accessToken);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [authLoading, accessToken, load, loadBranding]);

  // Waiter calls arrive live; clear them out after 3 minutes on screen
  useEffect(() => {
    if (authLoading || !accessToken) return;
    const socket = getSocket(accessToken);
    const onCall = (c: WaiterCall) =>
      setCalls((prev) => prev.some((x) => x.tableId === c.tableId) ? prev : [...prev, c]);
    socket.on('waiter:called', onCall);
    const sweep = setInterval(() => {
      setCalls((prev) => prev.filter((c) => Date.now() - new Date(c.at).getTime() < 3 * 60_000));
    }, 10_000);
    return () => { socket.off('waiter:called', onCall); clearInterval(sweep); };
  }, [authLoading, accessToken]);

  // Cursor + exit button appear on mouse move, fade after 4s idle
  const [cursorAwake, setCursorAwake] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setCursorAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCursorAwake(false), 4000);
    };
    wake();
    window.addEventListener('mousemove', wake);
    return () => { window.removeEventListener('mousemove', wake); clearTimeout(timer); };
  }, []);

  const t = overview?.kpis.today;
  const tables = overview?.kpis.tables;
  const rating = overview?.kpis.rating;
  const occupancy = tables?.total ? tables.occupied / tables.total : 0;
  const pendingItems = orders.reduce((a, o) => a + o.items.filter((i) => i.status === 'pending' || i.status === 'preparing').length, 0);

  return (
    <div className={`min-h-screen bg-[#08080b] text-white p-8 flex flex-col gap-6 select-none overflow-hidden ${cursorAwake ? '' : 'cursor-none'}`}>
      {/* Exit — visible only while the cursor is awake */}
      <Link
        href="/dashboard"
        className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur px-4 py-2 text-sm font-medium transition-opacity duration-500 ${cursorAwake ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <X size={15} /> Exit TV mode
      </Link>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="w-12 h-12 rounded-2xl object-cover" />
          ) : (
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold" style={{ background: brand }}>
              {(branding.restaurantName || 'R').charAt(0)}
            </span>
          )}
          <div>
            <p className="text-2xl font-bold tracking-tight">{branding.restaurantName || 'Restaurant'}</p>
            <p className="text-sm text-white/40 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: brand }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: brand }} />
              </span>
              Live · updates every 20s
            </p>
          </div>
        </div>
        <Clock />
      </div>

      {/* Waiter call banner */}
      {calls.length > 0 && (
        <div className="rounded-2xl bg-red-600 px-6 py-5 flex items-center gap-4 animate-pulse">
          <BellRing size={34} />
          <p className="text-3xl font-extrabold tracking-tight">
            {calls.map((c) => (c.zone ? `${c.zone} ${c.tableLabel}` : c.tableLabel)).join(' · ')} {calls.length === 1 ? 'is' : 'are'} calling for a waiter
          </p>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Revenue */}
        <div className="rounded-3xl bg-[#121218] border border-white/[0.06] p-8 flex flex-col justify-between"
          style={{ backgroundImage: `radial-gradient(500px 200px at 10% -10%, ${brand}26, transparent 70%)` }}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/40">Today&apos;s revenue</p>
            <p className="text-7xl font-extrabold tracking-tight mt-3 tabular-nums">{t ? fmtMoney(t.revenue) : '—'}</p>
            <p className="text-xl text-white/50 mt-3">{t ? `${t.bills} bills · avg ${fmtMoney(Math.round(t.avgBill || 0))}` : ''}</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/40 mb-3">Guest rating · 30d</p>
            <p className="text-4xl font-bold">{rating ? `★ ${rating.avg}` : '—'} <span className="text-lg text-white/40">{rating ? `(${rating.count})` : ''}</span></p>
          </div>
        </div>

        {/* Floor */}
        <div className="rounded-3xl bg-[#121218] border border-white/[0.06] p-8 flex flex-col">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/40">Floor</p>
          <p className="text-6xl font-extrabold tracking-tight mt-3 tabular-nums">
            {tables ? tables.occupied : '—'}<span className="text-2xl text-white/40 font-semibold"> / {tables?.total ?? '—'} tables</span>
          </p>
          <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${occupancy * 100}%`, background: brand }} />
          </div>
          <div className="mt-6 space-y-2.5 overflow-hidden flex-1">
            {sessions.slice(0, 8).map((s) => (
              <div key={s._id} className="flex items-center justify-between text-xl">
                <span className="font-semibold">
                  {s.tableId?.zone && <span className="text-white/40 font-medium">{s.tableId.zone} · </span>}
                  {s.tableId?.label}
                </span>
                <span className="text-white/40 tabular-nums">open {minsAgo(s.openedAt)}</span>
              </div>
            ))}
            {!sessions.length && <p className="text-white/30 text-xl mt-4">All quiet — no open tables</p>}
          </div>
        </div>

        {/* Kitchen queue */}
        <div className="rounded-3xl bg-[#121218] border border-white/[0.06] p-8 flex flex-col">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/40">Kitchen queue</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: pendingItems > 0 ? brand : undefined }}>
              {pendingItems} item{pendingItems === 1 ? '' : 's'}
            </p>
          </div>
          <div className="mt-5 space-y-3 overflow-hidden flex-1">
            {orders.slice(0, 7).map((o) => (
              <div key={o._id} className="rounded-xl bg-white/[0.04] px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xl font-semibold">
                    {o.tableId?.zone && <span className="text-white/40 font-medium">{o.tableId.zone} · </span>}
                    {o.tableId?.label ?? '—'}
                  </p>
                  <p className="text-sm text-white/40 truncate">
                    {o.items.slice(0, 3).map((i) => `${i.qty}× ${i.name}`).join(', ')}{o.items.length > 3 ? ` +${o.items.length - 3}` : ''}
                  </p>
                </div>
                <span className="text-lg text-white/50 tabular-nums shrink-0 ml-3">{minsAgo(o.createdAt)}</span>
              </div>
            ))}
            {!orders.length && <p className="text-white/30 text-xl mt-4">No orders cooking</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TvPage() {
  return (
    <AuthGuard roles={['owner', 'platform_admin']}>
      <TvBoard />
    </AuthGuard>
  );
}
