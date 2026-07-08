'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/lib/socket';

type ItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

interface OrderItem { _id: string; name: string; qty: number; note?: string; status: ItemStatus; }
interface Order { _id: string; tableId: { label: string; zone?: string }; items: OrderItem[]; status: string; placedAt: string; }
interface Prep {
  forDate: string; weekday: string; basedOnWeeks: number;
  items: { menuItemId: string; name: string; forecastQty: number }[];
  ingredients: { ingredientId: string; name: string; unit: string; required: number; stock: number; shortfall: number }[];
  counts: { dishes: number; totalPlates: number; shortfalls: number };
}

const STATUS_NEXT: Record<ItemStatus, ItemStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: null,
  cancelled: null,
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  pending:   'bg-yellow-500',
  preparing: 'bg-orange-500',
  ready:     'bg-green-500',
  served:    'bg-gray-500',
  cancelled: 'bg-red-500',
};

export default function KdsPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);

  useEffect(() => {
    if (!prepOpen || !accessToken || prep) return;
    api.get<Prep>('/inventory/prep', accessToken).then(setPrep).catch(() => {});
  }, [prepOpen, accessToken, prep]);

  const load = useCallback(async () => {
    if (authLoading || !accessToken) return;
    const data = await api.get<{ orders: Order[] }>('/orders/active', accessToken).catch(() => null);
    if (data) setOrders(data.orders);
  }, [accessToken, authLoading]);

  useEffect(() => {
    load();
    // Poll every 10s as fallback if socket drops
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  // Socket for real-time updates
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.on('order:new', () => load());
    socket.on('order:cancelled', () => load());
    return () => {
      socket.off('order:new');
      socket.off('order:cancelled');
    };
  }, [accessToken, load]);

  async function advanceItem(orderId: string, itemId: string, currentStatus: ItemStatus) {
    const next = STATUS_NEXT[currentStatus];
    if (!next || !accessToken) return;
    await api.patch(`/orders/${orderId}/items/${itemId}`, { status: next }, accessToken).catch(console.error);
    // Optimistic update
    setOrders((prev) => prev.map((o) =>
      o._id === orderId
        ? { ...o, items: o.items.map((i) => i._id === itemId ? { ...i, status: next } : i) }
        : o
    ));
  }

  const activeOrders = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Active Orders ({activeOrders.length})</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setPrepOpen(true)} className="text-sm text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded">
            Tomorrow&apos;s prep
          </button>
          <button onClick={load} className="text-sm text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded">Refresh</button>
        </div>
      </div>

      {/* Prep drawer */}
      {prepOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setPrepOpen(false)}>
          <div className="w-full max-w-sm h-full bg-gray-900 border-l border-gray-700 p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-white">Tomorrow&apos;s prep</h2>
              <button onClick={() => setPrepOpen(false)} aria-label="Close" className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
            </div>
            {prep ? (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  {prep.weekday} · avg of last {prep.basedOnWeeks} {prep.weekday}s · ~{prep.counts.totalPlates} plates
                </p>
                <div className="space-y-1.5 mb-6">
                  {prep.items.map((p) => (
                    <div key={p.menuItemId} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                      <span className="text-sm">{p.name}</span>
                      <span className="text-sm font-bold tabular-nums">{p.forecastQty}</span>
                    </div>
                  ))}
                  {!prep.items.length && <p className="text-sm text-gray-500">Not enough history for a forecast yet.</p>}
                </div>
                {prep.counts.shortfalls > 0 && (
                  <>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-2">Short for tomorrow</h3>
                    <div className="space-y-1.5">
                      {prep.ingredients.filter((i) => i.shortfall > 0).map((i) => (
                        <div key={i.ingredientId} className="flex items-center justify-between bg-red-950/40 border border-red-900/50 rounded px-3 py-2">
                          <span className="text-sm">{i.name}</span>
                          <span className="text-sm font-semibold text-red-400 tabular-nums">need {i.shortfall} {i.unit}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : <p className="text-sm text-gray-500 mt-4">Loading…</p>}
          </div>
        </div>
      )}

      {activeOrders.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">✓</p>
          <p>All caught up. No active orders.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {activeOrders.map((order) => (
          <div key={order._id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-white text-lg">
                {order.tableId?.zone && <span className="text-sm font-medium text-gray-400">{order.tableId.zone} · </span>}
                {order.tableId?.label}
              </span>
              <span className="text-xs text-gray-400">{new Date(order.placedAt).toLocaleTimeString()}</span>
            </div>

            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item._id} className={`rounded p-2 ${item.status === 'served' || item.status === 'cancelled' ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.qty}x {item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded text-white ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                  </div>
                  {item.note && <p className="text-xs text-yellow-300 mb-1">Note: {item.note}</p>}
                  {STATUS_NEXT[item.status] && (
                    <button
                      onClick={() => advanceItem(order._id, item._id, item.status)}
                      className="w-full text-xs bg-gray-700 hover:bg-gray-600 rounded py-1 mt-1 transition"
                    >
                      Mark {STATUS_NEXT[item.status]}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
