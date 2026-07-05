'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getSocket } from '@/lib/socket';
import { BellRing } from 'lucide-react';

interface WaiterCall { sessionId: string; tableId: string; tableLabel: string; at: string }

interface Table { _id: string; label: string; capacity: number; status: string; currentSessionId: string | { _id: string } | null; }
interface Session { _id: string; tableId: { _id: string; label: string }; openedAt: string; guestCount?: number; }
interface OrderSummary { _id: string; status: string; items: { name: string; qty: number; status: string }[]; }

export default function FloorPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [sessionOrders, setSessionOrders] = useState<OrderSummary[]>([]);
  const [bill, setBill] = useState<{ subtotal: number; vatAmount: number; total: number; vatRate: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);

  const load = useCallback(async () => {
    if (authLoading || !accessToken) return;
    const [tData, sData] = await Promise.all([
      api.get<{ tables: Table[] }>('/tables', accessToken),
      api.get<{ sessions: Session[] }>('/sessions/active', accessToken),
    ]);
    setTables(tData.tables);
    setActiveSessions(sData.sessions);
  }, [accessToken, authLoading]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  // Live waiter-call alerts
  useEffect(() => {
    if (authLoading || !accessToken) return;
    const socket = getSocket(accessToken);
    const onCall = (call: WaiterCall) => {
      setWaiterCalls((prev) => prev.some((c) => c.tableId === call.tableId) ? prev : [...prev, call]);
      load();
    };
    socket.on('waiter:called', onCall);
    return () => { socket.off('waiter:called', onCall); };
  }, [accessToken, authLoading, load]);

  async function attend(call: WaiterCall) {
    setWaiterCalls((prev) => prev.filter((c) => c.tableId !== call.tableId));
    if (accessToken) {
      await api.post(`/sessions/${call.sessionId}/attend`, {}, accessToken).catch(() => {});
      load();
    }
  }

  function sessionId(table: Table): string | null {
    if (!table.currentSessionId) return null;
    if (typeof table.currentSessionId === 'string') return table.currentSessionId;
    return table.currentSessionId._id;
  }

  async function selectTable(table: Table) {
    setSelectedTable(table);
    setCloseError('');
    const sid = sessionId(table);
    if (sid && accessToken) {
      const [ordersData, billData] = await Promise.all([
        api.get<{ orders: OrderSummary[] }>(`/orders/session/${sid}`, accessToken),
        api.get<{ bill: typeof bill }>(`/billing/session/${sid}`, accessToken),
      ]);
      setSessionOrders(ordersData.orders);
      setBill(billData.bill);
    } else {
      setSessionOrders([]); setBill(null);
    }
  }

  async function openSession() {
    if (!selectedTable || !accessToken) return;
    await api.post('/sessions', { tableId: selectedTable._id }, accessToken);
    await load();
    // refresh selected table
    const tData = await api.get<{ tables: Table[] }>('/tables', accessToken);
    const updated = tData.tables.find((t) => t._id === selectedTable._id);
    if (updated) selectTable(updated);
  }

  async function closeSession() {
    const sid = selectedTable ? sessionId(selectedTable) : null;
    if (!sid || !accessToken) return;
    setClosing(true); setCloseError('');
    try {
      await api.post(`/sessions/${sid}/close`, {
        paymentMethod,
        paymentReference: paymentRef || undefined,
      }, accessToken);
      setSelectedTable(null);
      await load();
    } catch (err: unknown) { setCloseError(err instanceof Error ? err.message : 'Failed'); }
    finally { setClosing(false); }
  }

  const tableSession = (table: Table) => activeSessions.find((s) => s.tableId._id === table._id);

  const statusColor = (s: string): 'green' | 'orange' | 'red' =>
    s === 'available' ? 'green' : s === 'occupied' ? 'orange' : 'red';

  const itemStatusColor = (s: string): 'gray' | 'yellow' | 'green' | 'blue' | 'red' =>
    s === 'pending' ? 'gray' : s === 'preparing' ? 'yellow' : s === 'ready' ? 'green' : s === 'served' ? 'blue' : 'red';

  return (
    <div className="flex gap-6">
      {/* Table grid */}
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Floor</h1>

        {/* Waiter call alerts */}
        {waiterCalls.length > 0 && (
          <div className="mb-4 space-y-2">
            {waiterCalls.map((call) => (
              <div key={call.tableId} className="flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 animate-pulse">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-800">
                  <BellRing size={16} /> {call.tableLabel} is calling for a waiter
                  <span className="font-normal text-red-500 text-xs">{new Date(call.at).toLocaleTimeString()}</span>
                </p>
                <Button size="sm" onClick={() => attend(call)}>On it</Button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {tables.map((t) => {
            const session = tableSession(t);
            return (
              <button
                key={t._id}
                onClick={() => selectTable(t)}
                className={`text-left border rounded-lg p-4 transition hover:shadow-md ${selectedTable?._id === t._id ? 'ring-2 ring-orange-500' : 'bg-white'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-gray-900">{t.label}</p>
                  <Badge label={t.status} color={statusColor(t.status)} />
                </div>
                <p className="text-xs text-gray-400">Seats {t.capacity}</p>
                {session && <p className="text-xs text-orange-600 mt-1">Open since {new Date(session.openedAt).toLocaleTimeString()}</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      {selectedTable && (
        <div className="w-80 bg-white border rounded-lg p-5 shrink-0 h-fit">
          <h2 className="font-bold text-gray-900 mb-1">{selectedTable.label}</h2>
          <p className="text-sm text-gray-400 mb-4">Seats {selectedTable.capacity}</p>

          {!selectedTable.currentSessionId ? (
            <Button className="w-full" onClick={openSession}>Open Session</Button>
          ) : (
            <div>
              {/* Orders */}
              <h3 className="font-semibold text-gray-700 mb-2 text-sm">Orders</h3>
              {sessionOrders.length === 0 && <p className="text-xs text-gray-400 mb-3">No orders yet</p>}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {sessionOrders.map((order) => (
                  <div key={order._id} className="bg-gray-50 rounded p-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span>{item.qty}x {item.name}</span>
                        <Badge label={item.status} color={itemStatusColor(item.status)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Bill */}
              {bill && (
                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>NPR {bill.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">VAT ({bill.vatRate}%)</span><span>NPR {bill.vatAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold mt-1"><span>Total</span><span>NPR {bill.total.toLocaleString()}</span></div>
                </div>
              )}

              {/* Payment */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Payment method</label>
                <select className="border rounded px-3 py-2 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="mobile_banking">Mobile Banking</option>
                  <option value="split">Split</option>
                </select>
                {paymentMethod !== 'cash' && (
                  <input
                    className="border rounded px-3 py-2 text-sm"
                    placeholder="Reference / txn ID (optional)"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                )}
                {closeError && <p className="text-xs text-red-600">{closeError}</p>}
                <Button variant="primary" loading={closing} onClick={closeSession} className="w-full mt-1">
                  Confirm Payment & End Session
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
