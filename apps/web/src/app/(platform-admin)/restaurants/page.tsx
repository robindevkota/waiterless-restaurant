'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

interface Restaurant {
  _id: string;
  name: string;
  slug: string;
  subscription: { plan: string; status: string; notes?: string };
  ownerId: { name: string; email: string };
  createdAt: string;
}

export default function RestaurantsPage() {
  const { accessToken } = useAuthStore();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', ownerName: '', ownerEmail: '', plan: 'trial' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api.get<{ restaurants: Restaurant[] }>('/platform/restaurants', accessToken ?? undefined).then((d) => setRestaurants(d.restaurants));
  useEffect(() => { load(); }, [accessToken]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/platform/restaurants', form, accessToken ?? undefined);
      setShowCreate(false);
      setForm({ name: '', slug: '', ownerName: '', ownerEmail: '', plan: 'trial' });
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }

  async function toggleBlock(r: Restaurant) {
    const action = r.subscription.status === 'blocked' ? 'unblock' : 'block';
    if (!confirm(`${action} "${r.name}"?`)) return;
    await api.patch(`/platform/restaurants/${r._id}/${action}`, {}, accessToken ?? undefined);
    load();
  }

  const statusColor = (s: string): 'green'|'yellow'|'red' => s === 'active' ? 'green' : s === 'past_due' ? 'yellow' : 'red';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurants</h1>
          <p className="text-sm text-gray-500">{restaurants.length} tenant{restaurants.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Restaurant</Button>
      </div>

      {showCreate && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Restaurant</h2>
          <form onSubmit={create} className="grid grid-cols-2 gap-4">
            <Input label="Restaurant name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Slug (URL key)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })} placeholder="my-restaurant" required />
            <Input label="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
            <Input label="Owner email" type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Plan</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="border rounded px-3 py-2 text-sm">
                <option value="trial">Trial (14 days)</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2 flex gap-2">
              <Button type="submit" loading={loading}>Create</Button>
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {restaurants.map((r) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}<br/><span className="text-xs text-gray-400">/{r.slug}</span></td>
                <td className="px-4 py-3">{r.ownerId?.name}<br/><span className="text-xs text-gray-400">{r.ownerId?.email}</span></td>
                <td className="px-4 py-3 capitalize">{r.subscription.plan}</td>
                <td className="px-4 py-3"><Badge label={r.subscription.status} color={statusColor(r.subscription.status)} /></td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant={r.subscription.status === 'blocked' ? 'secondary' : 'danger'}
                    size="sm"
                    onClick={() => toggleBlock(r)}
                  >
                    {r.subscription.status === 'blocked' ? 'Unblock' : 'Block'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!restaurants.length && <p className="text-center py-8 text-gray-400 text-sm">No restaurants yet</p>}
      </div>
    </div>
  );
}
