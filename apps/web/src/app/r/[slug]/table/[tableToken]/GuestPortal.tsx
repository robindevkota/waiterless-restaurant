'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, setAccessToken } from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import { getSocket } from '@/lib/socket';
import { Bell, Check, Plus, Sparkles, Star } from 'lucide-react';

interface MenuItem { _id: string; name: string; description: string; price: number; tags: string[]; preparationTime?: number; categoryId: { name: string }; }
interface Category { _id: string; name: string; }
interface OrderItem { name: string; qty: number; status: string; }
interface Order { _id: string; items: OrderItem[]; placedAt: string; }
interface Bill { subtotal: number; vatRate: number; vatAmount: number; total: number; }
interface UpsellSuggestion { menuItemId: string; name: string; price: number; pairCount: number; }

type View = 'menu' | 'cart' | 'orders' | 'bill' | 'closed';

interface GuestPortalProps {
  slug: string;
  tableToken: string;
  restaurantName?: string;
  tagline?: string;
  logoUrl?: string;
  paymentQrUrl?: string;
}

export default function GuestPortal({ slug, tableToken, restaurantName, tagline, logoUrl, paymentQrUrl }: GuestPortalProps) {
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('menu');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [sessionClosed, setSessionClosed] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const { items: cartItems, addItem, updateQty, clearCart, setSession, total } = useCartStore();

  // Step 1: get guest JWT
  useEffect(() => {
    api.post<{ guestToken: string; session: { id: string; tableLabel: string } }>(`/qr/${tableToken}`)
      .then((data) => {
        setGuestToken(data.guestToken);
        setSessionId(data.session.id);
        setTableLabel(data.session.tableLabel);
        setAccessToken(data.guestToken);
        setSession(data.session.id);
      })
      .catch((err) => setError(err.message));
  }, [tableToken]);

  // Step 2: load menu
  const loadMenu = useCallback(async () => {
    if (!guestToken) return;
    const [catData, itemData] = await Promise.all([
      api.get<{ categories: Category[] }>('/menu/categories', guestToken),
      api.get<{ items: MenuItem[] }>('/menu/items', guestToken),
    ]);
    setCategories(catData.categories);
    setItems(itemData.items);
    if (!activeCategory && catData.categories.length) setActiveCategory(catData.categories[0]._id);
  }, [guestToken, activeCategory]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  // Load orders & bill when on those views
  const loadOrders = useCallback(async () => {
    if (!guestToken) return;
    const data = await api.get<{ orders: Order[] }>('/orders/my', guestToken);
    setOrders(data.orders);
  }, [guestToken]);

  // QR arrives with the bill (always fresh); SSR prop is just the first paint
  const [paymentQr, setPaymentQr] = useState<string | undefined>(paymentQrUrl);
  const loadBill = useCallback(async () => {
    if (!guestToken) return;
    const data = await api.get<{ bill: Bill; paymentQrUrl?: string }>('/billing/my', guestToken);
    setBill(data.bill);
    setPaymentQr(data.paymentQrUrl);
  }, [guestToken]);

  useEffect(() => { if (view === 'orders') loadOrders(); }, [view, loadOrders]);
  useEffect(() => { if (view === 'bill') loadBill(); }, [view, loadBill]);

  // "Goes well with" suggestions — refresh (debounced) while the cart is open
  const [suggestions, setSuggestions] = useState<UpsellSuggestion[]>([]);
  const cartIdsKey = cartItems.map((i) => i.menuItemId).sort().join(',');
  useEffect(() => {
    if (!guestToken || view !== 'cart' || !cartIdsKey) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      api.get<{ suggestions: UpsellSuggestion[] }>(`/orders/upsell?with=${cartIdsKey}`, guestToken)
        .then((d) => setSuggestions(d.suggestions))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [guestToken, view, cartIdsKey]);

  // Socket: live updates
  useEffect(() => {
    if (!guestToken) return;
    const socket = getSocket(guestToken);
    socket.on('item:status_changed', () => { if (view === 'orders') loadOrders(); });
    socket.on('bill:updated', (data: Bill) => setBill(data));
    socket.on('session:closed', () => { setSessionClosed(true); setView('closed'); });
    return () => { socket.off('item:status_changed'); socket.off('bill:updated'); socket.off('session:closed'); };
  }, [guestToken, view, loadOrders]);

  async function placeOrder() {
    if (!guestToken || cartItems.length === 0) return;
    setPlacing(true); setPlaceError('');
    try {
      await api.post('/orders', {
        items: cartItems.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty, note: i.note, viaUpsell: i.viaUpsell || undefined })),
      }, guestToken);
      clearCart();
      setView('orders');
      loadOrders();
    } catch (err: unknown) { setPlaceError(err instanceof Error ? err.message : 'Failed to place order'); }
    finally { setPlacing(false); }
  }

  // "I've paid" — advisory signal to the cashier, who verifies before settling
  const [paidClaimed, setPaidClaimed] = useState(false);
  async function claimPaid() {
    if (!guestToken || paidClaimed) return;
    setPaidClaimed(true);
    try {
      await api.post('/sessions/my/claim-paid', {}, guestToken);
      setTimeout(() => setPaidClaimed(false), 60_000); // allow again after a minute
    } catch {
      setPaidClaimed(false);
    }
  }

  async function callWaiter() {
    if (!guestToken || waiterCalled) return;
    setWaiterCalled(true);
    try {
      await api.post('/sessions/my/call-waiter', {}, guestToken);
      setTimeout(() => setWaiterCalled(false), 60_000); // allow again after a minute
    } catch {
      setWaiterCalled(false);
    }
  }

  async function sendFeedback() {
    if (!guestToken || !rating || feedbackState !== 'idle') return;
    setFeedbackState('sending');
    try {
      await api.post('/sessions/my/feedback', { rating, comment: feedbackComment || undefined }, guestToken);
      setFeedbackState('sent');
    } catch {
      setFeedbackState('idle');
    }
  }

  const visibleItems = items.filter((i) => (i.categoryId as any)?._id === activeCategory || (i.categoryId as unknown as string) === activeCategory);

  const statusColor: Record<string, string> = {
    pending: 'text-yellow-600', preparing: 'text-orange-600', ready: 'text-green-600', served: 'text-gray-400',
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <p className="text-4xl mb-4">⚠️</p>
      <p className="text-lg font-semibold text-gray-800 mb-2">Unable to load table</p>
      <p className="text-sm text-gray-500">{error}</p>
    </div>
  );

  if (!guestToken) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-sm">Loading your table…</div>
    </div>
  );

  if (sessionClosed) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <p className="text-5xl mb-4">🙏</p>
      <p className="text-2xl font-bold text-gray-900 mb-2">Thank you!</p>
      <p className="text-gray-500 mb-8">Your session has ended. We hope to see you again!</p>

      {feedbackState === 'sent' ? (
        <p className="text-green-700 bg-green-50 rounded-xl px-5 py-3 text-sm font-medium">
          ✓ Thanks — your feedback helps us improve!
        </p>
      ) : (
        <div className="w-full max-w-xs bg-white border rounded-2xl p-5 shadow-sm">
          <p className="font-semibold text-gray-800 mb-3">How was your visit?</p>
          <div className="flex justify-center gap-2 mb-4" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                className="transition active:scale-90"
              >
                <Star
                  size={32}
                  className={star <= rating ? 'text-amber-400 fill-amber-400 scale-110 transition' : 'text-gray-300 transition'}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary,#E85D04)]"
                rows={2}
                maxLength={500}
                placeholder="Anything we should know? (optional)"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
              <button
                onClick={sendFeedback}
                disabled={feedbackState === 'sending'}
                className="w-full py-2.5 bg-[var(--primary,#E85D04)] text-white font-semibold rounded-lg text-sm disabled:opacity-60"
              >
                {feedbackState === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-[var(--primary,#E85D04)] text-white p-4 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-white/20 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-bold text-lg leading-tight truncate">{restaurantName || slug}</p>
            <p className="text-sm opacity-80 truncate">{tableLabel}{tagline ? ` · ${tagline}` : ''}</p>
          </div>
        </div>
        <button
          onClick={callWaiter}
          disabled={waiterCalled}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${waiterCalled ? 'bg-white/25 text-white' : 'bg-white text-[var(--primary,#E85D04)] active:scale-95'}`}
        >
          {waiterCalled ? <><Check size={15} /> Staff coming</> : <><Bell size={15} /> Call waiter</>}
        </button>
      </header>

      {/* Nav tabs */}
      <nav className="flex border-b bg-white sticky top-[60px] z-10">
        {(['menu', 'cart', 'orders', 'bill'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition ${view === v ? 'border-b-2 border-[var(--primary,#E85D04)] text-[var(--primary,#E85D04)]' : 'text-gray-500'}`}>
            {v === 'cart' ? `Cart (${cartItems.length})` : v}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {/* MENU VIEW */}
        {view === 'menu' && (
          <div>
            {/* Category pills */}
            <div className="flex gap-2 p-4 overflow-x-auto">
              {categories.map((c) => (
                <button key={c._id} onClick={() => setActiveCategory(c._id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm transition ${activeCategory === c._id ? 'bg-[var(--primary,#E85D04)] text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="px-4 space-y-3">
              {visibleItems.map((item) => {
                const inCart = cartItems.find((i) => i.menuItemId === item._id);
                return (
                  <div key={item._id} className="bg-white rounded-xl border p-4 flex items-start justify-between gap-4 shadow-sm">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {item.tags.map((t) => <span key={t} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{t}</span>)}
                        </div>
                      )}
                      <p className="font-bold text-gray-900 mt-2">NPR {item.price}</p>
                    </div>
                    <div className="shrink-0">
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item._id, inCart.qty - 1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center">−</button>
                          <span className="text-sm font-semibold w-4 text-center">{inCart.qty}</span>
                          <button onClick={() => updateQty(item._id, inCart.qty + 1)} className="w-7 h-7 rounded-full bg-[var(--primary,#E85D04)] text-white font-bold flex items-center justify-center">+</button>
                        </div>
                      ) : (
                        <button onClick={() => addItem({ menuItemId: item._id, name: item.name, price: item.price })}
                          className="w-8 h-8 rounded-full bg-[var(--primary,#E85D04)] text-white font-bold flex items-center justify-center text-lg">+</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CART VIEW */}
        {view === 'cart' && (
          <div className="p-4">
            <h2 className="font-bold text-gray-900 mb-4">Your cart</h2>
            {cartItems.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">Your cart is empty. Browse the menu to add items.</p>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.menuItemId} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">NPR {item.price} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.menuItemId, item.qty - 1)} className="w-7 h-7 rounded-full bg-gray-100 font-bold flex items-center justify-center">−</button>
                      <span className="text-sm font-semibold w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.menuItemId, item.qty + 1)} className="w-7 h-7 rounded-full bg-[var(--primary,#E85D04)] text-white font-bold flex items-center justify-center">+</button>
                    </div>
                    <p className="font-semibold text-gray-900 w-16 text-right">NPR {item.price * item.qty}</p>
                  </div>
                ))}

                {suggestions.length > 0 && (
                  <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-3">
                      <Sparkles size={14} className="text-[var(--primary,#E85D04)]" /> Goes well with your order
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s.menuItemId}
                          onClick={() => addItem({ menuItemId: s.menuItemId, name: s.name, price: s.price, viaUpsell: true })}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary,#E85D04)]/40 bg-[var(--primary,#E85D04)]/5 px-3 py-1.5 text-sm font-medium text-gray-800 active:scale-95 transition-transform"
                        >
                          <Plus size={14} className="text-[var(--primary,#E85D04)]" />
                          {s.name} <span className="text-gray-400">· NPR {s.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border p-4 mt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Cart total</span>
                    <span>NPR {total().toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">VAT will be added at checkout</p>
                </div>

                {placeError && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{placeError}</p>}
                <button onClick={placeOrder} disabled={placing}
                  className="w-full py-4 bg-[var(--primary,#E85D04)] text-white font-bold rounded-xl text-base disabled:opacity-60">
                  {placing ? 'Placing order…' : 'Place Order'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ORDERS VIEW */}
        {view === 'orders' && (
          <div className="p-4">
            <h2 className="font-bold text-gray-900 mb-4">Your orders</h2>
            {orders.length === 0 ? <p className="text-gray-400 text-sm text-center py-12">No orders placed yet.</p> : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order._id} className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-400 mb-3">{new Date(order.placedAt).toLocaleTimeString()}</p>
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm">{item.qty}x {item.name}</span>
                        <span className={`text-xs font-semibold capitalize ${statusColor[item.status] || 'text-gray-500'}`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BILL VIEW */}
        {view === 'bill' && (
          <div className="p-4">
            <h2 className="font-bold text-gray-900 mb-4">Your bill</h2>
            {bill ? (
              <div className="space-y-3">
                <div className="bg-white rounded-xl border p-5 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>NPR {bill.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>VAT ({bill.vatRate}%)</span><span>NPR {bill.vatAmount.toLocaleString()}</span></div>
                  <div className="border-t pt-3 flex justify-between font-bold text-lg"><span>Total</span><span>NPR {bill.total.toLocaleString()}</span></div>
                  {!paymentQr && <p className="text-xs text-gray-400 text-center pt-2">Please pay at the counter or ask your cashier.</p>}
                </div>

                {paymentQr && bill.total > 0 && (
                  <div className="bg-white rounded-xl border p-5 text-center">
                    <p className="text-sm font-semibold text-gray-900">Pay from your table</p>
                    <p className="text-xs text-gray-500 mt-1 mb-3">
                      Scan with your eSewa / Khalti / banking app and pay{' '}
                      <span className="font-semibold text-gray-900">NPR {bill.total.toLocaleString()}</span>
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={paymentQr} alt="Payment QR"
                      className="w-44 h-44 mx-auto rounded-lg border object-contain bg-white" />
                    <button onClick={claimPaid} disabled={paidClaimed}
                      className="mt-4 w-full py-3 rounded-xl font-semibold text-white bg-[var(--primary,#E85D04)] disabled:opacity-70">
                      {paidClaimed ? <span className="inline-flex items-center gap-1.5 justify-center"><Check size={16} /> Cashier notified — they&rsquo;ll confirm shortly</span> : "I've paid"}
                    </button>
                    <p className="text-[11px] text-gray-400 mt-2">The cashier verifies the payment before closing your table.</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-12">No bill yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
