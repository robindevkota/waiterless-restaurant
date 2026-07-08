'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface Table {
  _id: string;
  label: string;
  zone?: string;
  capacity: number;
  status: 'available' | 'occupied' | 'needs_attention';
  currentSessionId: string | null;
}

interface QrData { qrUrl: string; qrDataUrl: string; tableLabel: string; }

export default function TablesPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ label: '', zone: '', capacity: '4' });
  const [bulk, setBulk] = useState({ prefix: 'G', from: '1', to: '10', zone: '', capacity: '4' });
  const [bulkResult, setBulkResult] = useState('');
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ tableId: string; data: QrData } | null>(null);

  const load = () => api.get<{ tables: Table[] }>('/tables', accessToken ?? undefined).then((d) => setTables(d.tables));
  useEffect(() => { if (!authLoading) load(); }, [accessToken, authLoading]);

  const zones = useMemo(() => Array.from(new Set(tables.map((t) => t.zone).filter(Boolean))) as string[], [tables]);
  // Group for display: zoned groups first (server sorts zone asc, label asc), unzoned last
  const groups = useMemo(() => {
    const map = new Map<string, Table[]>();
    for (const t of tables) {
      const key = t.zone || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])));
    return entries;
  }, [tables]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tables', { label: form.label, zone: form.zone.trim(), capacity: parseInt(form.capacity) }, accessToken ?? undefined);
      setShowForm(false);
      setForm({ label: '', zone: '', capacity: '4' });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create table'); }
  }

  async function createBulk(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setBulkResult('');
    try {
      const d = await api.post<{ created: number; skipped: number }>('/tables/bulk', {
        prefix: bulk.prefix, from: parseInt(bulk.from), to: parseInt(bulk.to),
        zone: bulk.zone.trim(), capacity: parseInt(bulk.capacity),
      }, accessToken ?? undefined);
      setBulkResult(`Created ${d.created} table${d.created === 1 ? '' : 's'}${d.skipped ? ` · skipped ${d.skipped} existing label${d.skipped === 1 ? '' : 's'}` : ''}`);
      load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to generate tables'); }
  }

  async function changeZone(t: Table) {
    const next = prompt(`Zone for ${t.label} (empty to remove):`, t.zone || '');
    if (next === null) return;
    await api.patch(`/tables/${t._id}`, { zone: next.trim() }, accessToken ?? undefined);
    load();
  }

  async function showQr(id: string) {
    const data = await api.get<QrData>(`/tables/${id}/qr`, accessToken ?? undefined);
    setQr({ tableId: id, data });
  }

  async function regenerate(id: string) {
    if (!confirm('Regenerate QR? Old QR codes for this table will stop working.')) return;
    const data = await api.get<QrData>(`/tables/${id}/qr/regenerate`, accessToken ?? undefined);
    setQr({ tableId: id, data });
    load();
  }

  async function deleteTable(id: string) {
    if (!confirm('Delete this table?')) return;
    await api.delete(`/tables/${id}`, accessToken ?? undefined);
    load();
  }

  const statusColor = (s: string): 'green' | 'orange' | 'red' =>
    s === 'available' ? 'green' : s === 'occupied' ? 'orange' : 'red';

  const zoneDatalist = (
    <datalist id="zone-options">
      {zones.map((z) => <option key={z} value={z} />)}
    </datalist>
  );

  return (
    <div>
      {zoneDatalist}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Tables & QR Codes</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setShowBulk((v) => !v); setShowForm(false); }}>⚡ Generate range</Button>
          <Button onClick={() => { setShowForm(true); setShowBulk(false); }}>+ Add table</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-3 mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-5 mb-6 flex flex-wrap gap-4 items-end">
          <Input label="Label (e.g. G5)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
          <Input label="Zone (e.g. Ground floor)" list="zone-options" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
          <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-24" />
          <Button type="submit">Create</Button>
          <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
        </form>
      )}

      {showBulk && (
        <form onSubmit={createBulk} className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-5 mb-6">
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">
            Generate a run of tables like <span className="font-semibold">G1–G10</span>. Labels are unique across the whole
            restaurant — use a different prefix per floor (G for ground, F for first…), existing labels are skipped.
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <Input label="Prefix" value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} className="w-20" required />
            <Input label="From" type="number" value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} className="w-20" required />
            <Input label="To" type="number" value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} className="w-20" required />
            <Input label="Zone" list="zone-options" placeholder="Ground floor" value={bulk.zone} onChange={(e) => setBulk({ ...bulk, zone: e.target.value })} />
            <Input label="Capacity" type="number" value={bulk.capacity} onChange={(e) => setBulk({ ...bulk, capacity: e.target.value })} className="w-24" />
            <Button type="submit">Generate {bulk.prefix}{bulk.from}–{bulk.prefix}{bulk.to}</Button>
            <Button variant="ghost" type="button" onClick={() => setShowBulk(false)}>Close</Button>
          </div>
          {bulkResult && <p className="text-sm text-green-700 dark:text-green-400 mt-3">{bulkResult}</p>}
        </form>
      )}

      {qr && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#131318] rounded-xl p-8 max-w-sm w-full text-center shadow-xl">
            <h2 className="text-lg font-bold mb-1">{qr.data.tableLabel}</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-400 mb-4 break-all">{qr.data.qrUrl}</p>
            <img src={qr.data.qrDataUrl} alt="QR code" className="mx-auto mb-4 w-64 h-64" />
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="secondary" onClick={() => regenerate(qr.tableId)}>Regenerate</Button>
              <Button size="sm" onClick={() => { const a = document.createElement('a'); a.href = qr.data.qrDataUrl; a.download = `${qr.data.tableLabel}.png`; a.click(); }}>Download</Button>
              <Button size="sm" variant="ghost" onClick={() => setQr(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {groups.map(([zone, zoneTables]) => (
        <div key={zone || '__unzoned'} className="mb-6">
          {(zones.length > 0) && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-2">
              {zone || 'No zone'} <span className="font-normal normal-case">· {zoneTables.length} table{zoneTables.length === 1 ? '' : 's'}</span>
            </h2>
          )}
          <div className="grid grid-cols-3 gap-4">
            {zoneTables.map((t) => (
              <div key={t._id} className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-zinc-100">{t.label}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-400">
                      Seats {t.capacity}
                      {' · '}
                      <button type="button" onClick={() => changeZone(t)} className="underline decoration-dotted hover:text-gray-600 dark:hover:text-zinc-200" title="Change zone">
                        {t.zone || 'no zone'}
                      </button>
                    </p>
                  </div>
                  <Badge label={t.status} color={statusColor(t.status)} />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="secondary" onClick={() => showQr(t._id)}>Show QR</Button>
                  {!t.currentSessionId && (
                    <Button size="sm" variant="danger" onClick={() => deleteTable(t._id)}>Delete</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!tables.length && <p className="text-center py-12 text-gray-400 dark:text-zinc-400">No tables yet. Add your first table above.</p>}
    </div>
  );
}
