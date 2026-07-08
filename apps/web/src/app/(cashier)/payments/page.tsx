'use client';
/**
 * Payments workspace for the front desk.
 *  - Pending: every open session where the guest tapped "I've paid",
 *    oldest claim first — verify in the merchant app, settle or dismiss inline.
 *  - Paid: settled bills, newest first, with today's totals.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { ZoneTabs, useZoneFilter } from '@/components/ZoneTabs';
import { BadgeCheck, Banknote } from 'lucide-react';

interface Session {
  _id: string; tableId: { _id: string; label: string; zone?: string }; openedAt: string;
  paidClaimedAt?: string; paidClaimAmount?: number;
}
interface PaidBill {
  _id: string; total: number; paymentMethod?: string; paymentReference?: string; paidAt?: string;
  sessionId: { tableId: { label: string } | null } | null;
  processedBy?: { name: string } | null;
}

const METHODS = [
  { value: 'esewa', label: 'eSewa' },
  { value: 'khalti', label: 'Khalti' },
  { value: 'mobile_banking', label: 'Mobile banking' },
  { value: 'cash', label: 'Cash' },
  { value: 'split', label: 'Split' },
];
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m === 0 ? 'just now' : `${m} min ago`;
}

export default function PaymentsPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [pending, setPending] = useState<Session[]>([]);
  const [paid, setPaid] = useState<{ bills: PaidBill[]; page: number; pages: number; total: number }>({ bills: [], page: 1, pages: 1, total: 0 });
  const [today, setToday] = useState<{ revenue: number; count: number }>({ revenue: 0, count: 0 });
  const [methodBySession, setMethodBySession] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [zones, setZones] = useState<string[]>([]);
  const { zone, pick: pickZone } = useZoneFilter(zones);

  // Zones come from the table list (cashier-readable); the queue alone would
  // lose the tabs whenever it's empty
  useEffect(() => {
    if (authLoading || !accessToken) return;
    api.get<{ tables: { zone?: string }[] }>('/tables', accessToken)
      .then((d) => setZones(Array.from(new Set(d.tables.map((t) => t.zone).filter(Boolean))) as string[]))
      .catch(() => {});
  }, [authLoading, accessToken]);

  // Soft filter — attention only: tab counts always show every zone's pending claims
  const claimZone = (s: Session) => s.tableId?.zone ?? '';
  const pendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of pending) counts[claimZone(s)] = (counts[claimZone(s)] ?? 0) + 1;
    return counts;
  }, [pending]);
  const visiblePending = zone ? pending.filter((s) => claimZone(s) === zone) : pending;

  const loadPending = useCallback(async () => {
    if (!accessToken) return;
    const d = await api.get<{ sessions: Session[] }>('/sessions/active', accessToken).catch(() => null);
    if (d) {
      setPending(d.sessions
        .filter((s) => s.paidClaimedAt)
        .sort((a, b) => new Date(a.paidClaimedAt!).getTime() - new Date(b.paidClaimedAt!).getTime()));
    }
  }, [accessToken]);

  const loadPaid = useCallback(async (page: number) => {
    if (!accessToken) return;
    const d = await api.get<{ bills: PaidBill[]; page: number; pages: number; total: number; today: { revenue: number; count: number } }>(
      `/billing/paid?page=${page}&limit=12`, accessToken).catch(() => null);
    if (d) { setPaid({ bills: d.bills, page: d.page, pages: d.pages, total: d.total }); setToday(d.today); }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading) return;
    loadPending(); loadPaid(1);
    const t = setInterval(() => { loadPending(); loadPaid(1); }, 15000);
    return () => clearInterval(t);
  }, [authLoading, loadPending, loadPaid]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    const socket = getSocket(accessToken);
    const refresh = () => loadPending();
    socket.on('payment:claimed', refresh);
    return () => { socket.off('payment:claimed', refresh); };
  }, [authLoading, accessToken, loadPending]);

  async function settle(s: Session) {
    if (!accessToken) return;
    setBusy(s._id); setError('');
    try {
      await api.post(`/sessions/${s._id}/close`, { paymentMethod: methodBySession[s._id] || 'esewa' }, accessToken);
      await Promise.all([loadPending(), loadPaid(1)]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Settle failed'); }
    finally { setBusy(null); }
  }

  async function dismiss(s: Session) {
    if (!accessToken) return;
    setBusy(s._id);
    await api.post(`/sessions/${s._id}/clear-paid-claim`, {}, accessToken).catch(() => {});
    await loadPending();
    setBusy(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-400">Verify claims in your merchant app, then settle</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-white border rounded-lg px-4 py-2">
          <Banknote size={16} className="text-green-600" />
          <span className="font-semibold text-gray-900">NPR {today.revenue.toLocaleString()}</span>
          <span className="text-gray-400">collected today · {today.count} bill{today.count === 1 ? '' : 's'}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-4">{error}</p>}

      <ZoneTabs zones={zones} zone={zone} onPick={pickZone} counts={pendingCounts} />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
      {/* Pending queue */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <BadgeCheck size={16} className="text-green-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Pending verification</h2>
          {visiblePending.length > 0 && <Badge label={String(visiblePending.length)} color="green" />}
        </div>
        {visiblePending.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No pending payment claims{zone && pending.length > 0 ? ` in ${zone} — ${pending.length} waiting in other zones` : ''}
          </p>
        ) : (
          <div className="divide-y">
            {visiblePending.map((s) => (
              <div key={s._id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-40">
                  <p className="font-semibold text-gray-900">
                    {claimZone(s) && <span className="text-gray-400 font-normal">{claimZone(s)} · </span>}
                    {s.tableId?.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    claimed {s.paidClaimedAt ? ago(s.paidClaimedAt) : ''}
                    {typeof s.paidClaimAmount === 'number' && s.paidClaimAmount > 0 && (
                      <> · <span className="font-semibold text-gray-700">NPR {s.paidClaimAmount.toLocaleString()}</span></>
                    )}
                  </p>
                </div>
                <select
                  className="border rounded px-2.5 py-1.5 text-sm"
                  value={methodBySession[s._id] || 'esewa'}
                  onChange={(e) => setMethodBySession({ ...methodBySession, [s._id]: e.target.value })}
                >
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <Button size="sm" loading={busy === s._id} onClick={() => settle(s)}>Settle</Button>
                <Button size="sm" variant="secondary" disabled={busy === s._id} onClick={() => dismiss(s)}>Dismiss</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paid history */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900 text-sm">Paid</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">When</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Table</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">Total</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Method</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">By</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paid.bills.map((b) => (
              <tr key={b._id} className="hover:bg-gray-50/70">
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{b.paidAt ? new Date(b.paidAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{b.sessionId?.tableId?.label ?? '—'}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">NPR {b.total.toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <span className="text-gray-700">{b.paymentMethod ? METHOD_LABEL[b.paymentMethod] ?? b.paymentMethod : '—'}</span>
                  {b.paymentReference && <span className="text-xs text-gray-400 ml-2">ref {b.paymentReference}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{b.processedBy?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paid.bills.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No settled payments yet</p>}
        <Pagination page={paid.page} pages={paid.pages} total={paid.total} onChange={loadPaid} />
      </div>
      </div>
    </div>
  );
}
