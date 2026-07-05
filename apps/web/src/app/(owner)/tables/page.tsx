'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import Image from 'next/image';

interface Table {
  _id: string;
  label: string;
  capacity: number;
  status: 'available' | 'occupied' | 'needs_attention';
  currentSessionId: string | null;
}

interface QrData { qrUrl: string; qrDataUrl: string; tableLabel: string; }

export default function TablesPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', capacity: '4' });
  const [qr, setQr] = useState<{ tableId: string; data: QrData } | null>(null);

  const load = () => api.get<{ tables: Table[] }>('/tables', accessToken ?? undefined).then((d) => setTables(d.tables));
  useEffect(() => { if (!authLoading) load(); }, [accessToken, authLoading]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/tables', { label: form.label, capacity: parseInt(form.capacity) }, accessToken ?? undefined);
    setShowForm(false);
    setForm({ label: '', capacity: '4' });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Tables & QR Codes</h1>
        <Button onClick={() => setShowForm(true)}>+ Add table</Button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-5 mb-6 flex gap-4 items-end">
          <Input label="Label (e.g. Table 5)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
          <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-24" />
          <Button type="submit">Create</Button>
          <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
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

      <div className="grid grid-cols-3 gap-4">
        {tables.map((t) => (
          <div key={t._id} className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-zinc-100">{t.label}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-400">Seats {t.capacity}</p>
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
      {!tables.length && <p className="text-center py-12 text-gray-400 dark:text-zinc-400">No tables yet. Add your first table above.</p>}
    </div>
  );
}
