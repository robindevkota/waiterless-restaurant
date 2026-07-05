'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';

type Period = 'daily' | 'weekly' | 'monthly';

interface Session {
  _id: string;
  tableId: { label: string };
  openedAt: string;
  closedAt: string;
  billId: { total: number; paymentMethod: string; paymentReference?: string };
}

const REVENUE_PER_PAGE = 10;
const SESSIONS_PER_PAGE = 12;

export default function ReportsPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [period, setPeriod] = useState<Period>('daily');
  const [revenueData, setRevenueData] = useState<{ _id: string; revenue: number; bills: number }[]>([]);
  const [totals, setTotals] = useState<{ totalRevenue: number; totalBills: number } | null>(null);
  const [revenuePage, setRevenuePage] = useState(1);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsPages, setSessionsPages] = useState(1);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [tab, setTab] = useState<'revenue' | 'sessions'>('revenue');

  useEffect(() => {
    if (authLoading || !accessToken) return;
    api.get<{ data: typeof revenueData; totals: typeof totals }>(`/reports/revenue?period=${period}`, accessToken)
      .then((d) => { setRevenueData(d.data); setTotals(d.totals); setRevenuePage(1); });
  }, [period, accessToken, authLoading]);

  useEffect(() => {
    if (!accessToken || tab !== 'sessions') return;
    api.get<{ sessions: Session[]; total: number; pages: number }>(
      `/reports/sessions?limit=${SESSIONS_PER_PAGE}&page=${sessionsPage}`, accessToken
    ).then((d) => { setSessions(d.sessions); setSessionsPages(d.pages); setSessionsTotal(d.total); });
  }, [tab, accessToken, sessionsPage]);

  const methodColor = (m: string): 'green' | 'blue' | 'orange' | 'gray' =>
    m === 'cash' ? 'green' : m === 'esewa' ? 'blue' : m === 'khalti' ? 'orange' : 'gray';

  const revenuePages = Math.ceil(revenueData.length / REVENUE_PER_PAGE);
  const revenueSlice = revenueData.slice((revenuePage - 1) * REVENUE_PER_PAGE, revenuePage * REVENUE_PER_PAGE);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-gray-900 dark:text-zinc-100">Reports</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-400 mt-1">Raw numbers behind the dashboard — revenue periods and session history</p>
        </div>
        <div className="flex gap-2">
          {(['revenue', 'sessions'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'text-white shadow-sm' : 'bg-white dark:bg-[#131318] border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`}
              style={tab === t ? { background: 'var(--brand, #ea580c)' } : undefined}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'revenue' && (
        <div>
          <div className="flex gap-2 mb-5">
            {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition capitalize ${period === p ? 'bg-gray-900 text-white' : 'bg-white dark:bg-[#131318] border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`}>
                {p}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-zinc-300">Total revenue · all time</p>
              <p className="text-3xl font-bold mt-1">NPR {totals?.totalRevenue.toLocaleString() ?? '—'}</p>
            </div>
            <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-zinc-300">Total sessions · all time</p>
              <p className="text-3xl font-bold mt-1">{totals?.totalBills ?? '—'}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b dark:border-zinc-800 border-gray-100 dark:border-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Revenue</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Avg bill</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-zinc-800 divide-gray-50 dark:divide-zinc-800">
                {revenueSlice.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-gray-800 dark:text-zinc-200">{r._id}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">NPR {r.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-zinc-300 tabular-nums">NPR {r.bills ? Math.round(r.revenue / r.bills).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bills}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!revenueData.length && <p className="text-center py-10 text-gray-400 dark:text-zinc-400 text-sm">No data yet</p>}
            <Pagination page={revenuePage} pages={revenuePages} total={revenueData.length} onChange={setRevenuePage} />
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b dark:border-zinc-800 border-gray-100 dark:border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Table</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Opened</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Closed</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-800 divide-gray-50 dark:divide-zinc-800">
              {sessions.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-zinc-200">{s.tableId?.label}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-300">{new Date(s.openedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-300">{s.closedAt ? new Date(s.closedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">NPR {s.billId?.total?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {s.billId?.paymentMethod && (
                      <div>
                        <Badge label={s.billId.paymentMethod} color={methodColor(s.billId.paymentMethod)} />
                        {s.billId.paymentReference && <p className="text-xs text-gray-400 dark:text-zinc-400 mt-0.5">Ref: {s.billId.paymentReference}</p>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sessions.length && <p className="text-center py-10 text-gray-400 dark:text-zinc-400 text-sm">No sessions yet</p>}
          <Pagination page={sessionsPage} pages={sessionsPages} total={sessionsTotal} onChange={setSessionsPage} />
        </div>
      )}
    </div>
  );
}
