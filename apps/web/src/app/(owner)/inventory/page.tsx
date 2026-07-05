'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { fmtMoney } from '@/components/charts';
import { Package, PackagePlus, AlertTriangle, XCircle, UtensilsCrossed, Plus, Trash2, Pencil, X } from 'lucide-react';

/* ── types ──────────────────────────────────────────────────────────── */

interface Ing {
  _id: string; name: string; unit: string; stock: number; costPrice: number;
  lowStockThreshold: number; category: string; status: 'ok' | 'low' | 'out'; pct: number;
}
interface Dish {
  menuItemId: string; name: string; price: number; available: boolean; autoUnavailable: boolean;
  servingsPossible: number | null; limitingIngredient: string | null;
  status: 'ok' | 'low' | 'out' | 'untracked'; cogsPerServing: number; profitPerServing: number | null;
}
interface Overview {
  items: Dish[]; ingredients: Ing[];
  counts: { totalIngredients: number; lowStock: number; outOfStock: number; tracked: number; auto86: number };
}
interface LogEntry {
  _id: string; type: string; qty: number; stockAfter: number; note?: string; createdAt: string;
  ingredientId: { name: string; unit: string } | null; byUser?: { name: string } | null;
}
interface RecipeLine { ingredientId: string; qtyPerServing: number }

const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'bottle'];
const CARD = 'bg-white dark:bg-[#131318] border border-black/[0.06] dark:border-white/[0.07] rounded-2xl shadow-sm';
const STATUS_BADGE: Record<string, { label: string; color: 'green' | 'yellow' | 'red' | 'gray' }> = {
  ok: { label: 'OK', color: 'green' },
  low: { label: 'Low', color: 'yellow' },
  out: { label: 'Out', color: 'red' },
  untracked: { label: 'Untracked', color: 'gray' },
};
const LOG_BADGE: Record<string, 'green' | 'blue' | 'red' | 'gray'> = {
  restock: 'green', sale: 'blue', adjustment: 'gray', seed: 'gray',
};

function fmtQty(n: number) {
  return Math.abs(n) >= 1 ? (+n.toFixed(2)).toLocaleString() : +n.toFixed(3);
}

/* ── modal shell ─────────────────────────────────────────────────────── */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${CARD} w-full max-w-md p-6 max-h-[85vh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */

export default function InventoryPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<'dishes' | 'ingredients' | 'log'>('dishes');
  const [logsState, setLogsState] = useState<{ entries: LogEntry[]; page: number; pages: number; total: number }>({ entries: [], page: 1, pages: 1, total: 0 });
  const [error, setError] = useState('');

  // modals
  const [ingModal, setIngModal] = useState<{ mode: 'create' } | { mode: 'edit'; ing: Ing } | null>(null);
  const [restockModal, setRestockModal] = useState<Ing | null>(null);
  const [recipeModal, setRecipeModal] = useState<Dish | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    api.get<Overview>('/inventory/overview', accessToken)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [accessToken]);

  const loadLogs = useCallback((page: number) => {
    if (!accessToken) return;
    api.get<{ logs: LogEntry[]; page: number; pages: number; total: number }>(`/inventory/logs?page=${page}&limit=15`, accessToken)
      .then((d) => setLogsState({ entries: d.logs, page: d.page, pages: d.pages, total: d.total }));
  }, [accessToken]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);
  useEffect(() => { if (tab === 'log') loadLogs(1); }, [tab, loadLogs]);

  const counts = data?.counts;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-gray-900 dark:text-zinc-100">Inventory</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-400 mt-1">
            Rule-based stock — every order deducts ingredients; dishes 86 themselves at zero
          </p>
        </div>
        <Button onClick={() => setIngModal({ mode: 'create' })}><PackagePlus size={16} /> Add ingredient</Button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-lg px-4 py-3 mb-6">{error}</p>}

      {/* Count chips */}
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: <Package size={16} />, label: 'Ingredients', value: counts.totalIngredients, cls: '' },
            { icon: <AlertTriangle size={16} />, label: 'Low stock', value: counts.lowStock, cls: counts.lowStock ? 'text-amber-600 dark:text-amber-400' : '' },
            { icon: <XCircle size={16} />, label: 'Out of stock', value: counts.outOfStock, cls: counts.outOfStock ? 'text-red-600 dark:text-red-400' : '' },
            { icon: <UtensilsCrossed size={16} />, label: 'Auto-86’d dishes', value: counts.auto86, cls: counts.auto86 ? 'text-red-600 dark:text-red-400' : '' },
          ].map((c) => (
            <div key={c.label} className={`${CARD} px-4 py-3 flex items-center gap-3`}>
              <span className={`text-gray-400 dark:text-zinc-400 ${c.cls}`}>{c.icon}</span>
              <div>
                <p className={`text-xl font-bold leading-6 ${c.cls || 'text-gray-900 dark:text-zinc-100'}`}>{c.value}</p>
                <p className="text-[11px] text-gray-400 dark:text-zinc-400">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([['dishes', 'Dishes'], ['ingredients', 'Ingredients'], ['log', 'Stock log']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'text-white shadow-sm' : 'bg-white dark:bg-[#131318] border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`}
            style={tab === t ? { background: 'var(--brand, #ea580c)' } : undefined}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Dishes tab ── */}
      {tab === 'dishes' && (
        <div className={`${CARD} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-100 dark:border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Dish</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Servings left</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Bottleneck</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Profit / serving</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {data?.items.map((d) => (
                <tr key={d.menuItemId} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-zinc-100">{d.name}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-400">NPR {d.price}{d.autoUnavailable && <span className="text-red-500 font-medium ml-2">auto-86’d</span>}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-zinc-100">
                    {d.servingsPossible ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-300">{d.limitingIngredient ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                    {d.profitPerServing !== null ? fmtMoney(d.profitPerServing) : '—'}
                  </td>
                  <td className="px-4 py-3"><Badge label={STATUS_BADGE[d.status].label} color={STATUS_BADGE[d.status].color} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setRecipeModal(d)}>
                      {d.status === 'untracked' ? 'Set recipe' : 'Edit recipe'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.items.length && <p className="text-center py-10 text-gray-400 dark:text-zinc-400 text-sm">No menu items yet</p>}
        </div>
      )}

      {/* ── Ingredients tab ── */}
      {tab === 'ingredients' && (
        <div className={`${CARD} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-100 dark:border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Ingredient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Stock</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Cost / unit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {data?.ingredients.map((i) => (
                <tr key={i._id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-zinc-100">{i.name}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-400 capitalize">{i.category}</p>
                  </td>
                  <td className="px-4 py-3 w-56">
                    <p className="tabular-nums text-gray-800 dark:text-zinc-200">{fmtQty(i.stock)} {i.unit} <span className="text-xs text-gray-400 dark:text-zinc-500">/ alert at {fmtQty(i.lowStockThreshold)}</span></p>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${i.pct}%`, background: i.status === 'out' ? '#ef4444' : i.status === 'low' ? '#f59e0b' : 'var(--brand, #22c55e)' }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">NPR {i.costPrice.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge label={STATUS_BADGE[i.status].label} color={STATUS_BADGE[i.status].color} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => setRestockModal(i)}><Plus size={13} /> Restock</Button>
                      <Button size="sm" variant="secondary" aria-label="Edit" onClick={() => setIngModal({ mode: 'edit', ing: i })}><Pencil size={13} /></Button>
                      <Button size="sm" variant="secondary" aria-label="Delete" onClick={async () => {
                        if (!confirm(`Delete "${i.name}"? It will also be removed from recipes.`)) return;
                        await api.delete(`/inventory/ingredients/${i._id}`, accessToken ?? undefined);
                        load();
                      }}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.ingredients.length && <p className="text-center py-10 text-gray-400 dark:text-zinc-400 text-sm">No ingredients yet — add your first one</p>}
        </div>
      )}

      {/* ── Log tab ── */}
      {tab === 'log' && (
        <div className={`${CARD} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-100 dark:border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">When</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Ingredient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Type</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Change</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">After</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Note / by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {logsState.entries.map((l) => (
                <tr key={l._id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-800 dark:text-zinc-200">{l.ingredientId?.name ?? '—'}</td>
                  <td className="px-4 py-2.5"><Badge label={l.type} color={LOG_BADGE[l.type] ?? 'gray'} /></td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${l.qty >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {l.qty >= 0 ? '+' : ''}{fmtQty(l.qty)} {l.ingredientId?.unit}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-zinc-300">{fmtQty(l.stockAfter)}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400 text-xs">{l.note ?? ''}{l.byUser?.name ? ` · ${l.byUser.name}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logsState.entries.length && <p className="text-center py-10 text-gray-400 dark:text-zinc-400 text-sm">No stock movements yet</p>}
          <Pagination page={logsState.page} pages={logsState.pages} total={logsState.total} onChange={loadLogs} />
        </div>
      )}

      {/* ── Modals ── */}
      {ingModal && (
        <IngredientModal
          initial={ingModal.mode === 'edit' ? ingModal.ing : undefined}
          onClose={() => setIngModal(null)}
          onSaved={() => { setIngModal(null); load(); }}
          token={accessToken ?? ''}
        />
      )}
      {restockModal && (
        <RestockModal ing={restockModal} token={accessToken ?? ''} onClose={() => setRestockModal(null)} onSaved={() => { setRestockModal(null); load(); }} />
      )}
      {recipeModal && data && (
        <RecipeModal dish={recipeModal} ingredients={data.ingredients} token={accessToken ?? ''} onClose={() => setRecipeModal(null)} onSaved={() => { setRecipeModal(null); load(); }} />
      )}
    </div>
  );
}

/* ── Ingredient create/edit modal ────────────────────────────────────── */

function IngredientModal({ initial, token, onClose, onSaved }: {
  initial?: Ing; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    unit: initial?.unit ?? 'kg',
    stock: initial ? String(initial.stock) : '0',
    costPrice: initial ? String(initial.costPrice) : '',
    lowStockThreshold: initial ? String(initial.lowStockThreshold) : '0',
    category: initial?.category ?? 'kitchen',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true); setErr('');
    try {
      const body: Record<string, unknown> = {
        name: form.name, unit: form.unit, costPrice: Number(form.costPrice),
        lowStockThreshold: Number(form.lowStockThreshold), category: form.category,
      };
      if (initial) {
        await api.put(`/inventory/ingredients/${initial._id}`, body, token);
      } else {
        await api.post('/inventory/ingredients', { ...body, stock: Number(form.stock) }, token);
      }
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  const select = 'border border-gray-300 dark:border-zinc-700 rounded px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100';

  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'Add ingredient'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chicken keema" />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Unit</label>
            <select className={select} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Category</label>
            <select className={select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['kitchen', 'bar', 'general'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {!initial && (
            <Input label={`Opening stock (${form.unit})`} type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          )}
          <Input label="Cost price (NPR / unit)" type="number" min={0} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
          <Input label={`Low-stock alert (${form.unit})`} type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button onClick={save} loading={saving} disabled={!form.name || form.costPrice === ''}>
          {initial ? 'Save changes' : 'Add ingredient'}
        </Button>
      </div>
    </Modal>
  );
}

/* ── Restock modal ───────────────────────────────────────────────────── */

function RestockModal({ ing, token, onClose, onSaved }: { ing: Ing; token: string; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [restored, setRestored] = useState<string[]>([]);

  async function save() {
    setSaving(true); setErr('');
    try {
      const d = await api.post<{ restoredItems: string[] }>(`/inventory/ingredients/${ing._id}/restock`, { qty: Number(qty), note: note || undefined }, token);
      if (d.restoredItems?.length) {
        setRestored(d.restoredItems);
        setTimeout(onSaved, 1600); // let the owner see what came back on the menu
      } else onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Restock failed'); setSaving(false); }
  }

  return (
    <Modal title={`Restock ${ing.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-zinc-400">Current stock: <span className="font-semibold text-gray-900 dark:text-zinc-100">{fmtQty(ing.stock)} {ing.unit}</span></p>
        <Input label={`Quantity to add (${ing.unit})`} type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Kalimati market purchase" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        {restored.length > 0 && (
          <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 rounded-lg px-3 py-2">
            ✓ Back on the menu: {restored.join(', ')}
          </p>
        )}
        <Button onClick={save} loading={saving} disabled={!qty || Number(qty) <= 0}>Add stock</Button>
      </div>
    </Modal>
  );
}

/* ── Recipe editor modal ─────────────────────────────────────────────── */

function RecipeModal({ dish, ingredients, token, onClose, onSaved }: {
  dish: Dish; ingredients: Ing[]; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    // menu items list (owner) includes recipe lines
    api.get<{ items: { _id: string; recipe?: RecipeLine[] }[] }>('/menu/items', token).then((d) => {
      const mi = d.items.find((i) => i._id === dish.menuItemId);
      setLines((mi?.recipe ?? []).map((l) => ({ ingredientId: String(l.ingredientId), qtyPerServing: l.qtyPerServing })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dish.menuItemId, token]);

  const unitOf = (id: string) => ingredients.find((i) => i._id === id)?.unit ?? '';
  const select = 'flex-1 border border-gray-300 dark:border-zinc-700 rounded px-2.5 py-2 text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 min-w-0';

  async function save() {
    setSaving(true); setErr('');
    try {
      await api.put(`/inventory/recipes/${dish.menuItemId}`, {
        lines: lines.filter((l) => l.ingredientId && l.qtyPerServing > 0),
      }, token);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); setSaving(false); }
  }

  return (
    <Modal title={`Recipe — ${dish.name}`} onClose={onClose}>
      {loading ? <p className="text-sm text-gray-400 dark:text-zinc-400">Loading…</p> : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400 dark:text-zinc-400">
            Quantities are per serving, in each ingredient&apos;s unit. Every guest order deducts these amounts automatically.
          </p>
          {lines.map((line, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select className={select} value={line.ingredientId}
                onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, ingredientId: e.target.value } : l))}>
                <option value="">— ingredient —</option>
                {ingredients.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}
              </select>
              <input
                type="number" min={0} step="any" value={line.qtyPerServing || ''}
                onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, qtyPerServing: Number(e.target.value) } : l))}
                className="w-24 border border-gray-300 dark:border-zinc-700 rounded px-2.5 py-2 text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 tabular-nums"
                placeholder="qty"
              />
              <span className="text-xs text-gray-400 dark:text-zinc-400 w-12">{unitOf(line.ingredientId)}</span>
              <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} aria-label="Remove line"
                className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setLines([...lines, { ingredientId: '', qtyPerServing: 0 }])}>
            <Plus size={14} /> Add ingredient
          </Button>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button onClick={save} loading={saving}>Save recipe</Button>
          {lines.length === 0 && <p className="text-[11px] text-gray-400 dark:text-zinc-500 text-center">Saving with no lines makes this dish untracked (never auto-86’d).</p>}
        </div>
      )}
    </Modal>
  );
}
