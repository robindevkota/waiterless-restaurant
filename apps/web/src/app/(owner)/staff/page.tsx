'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface StaffMember { _id: string; name: string; email: string; role: string; status: string; }

export default function StaffPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'cashier', name: '' });
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string } | null>(null);
  const [error, setError] = useState('');

  const load = () => api.get<{ staff: StaffMember[] }>('/staff', accessToken ?? undefined).then((d) => setStaff(d.staff));
  useEffect(() => { if (!authLoading) load(); }, [accessToken, authLoading]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.post<{ inviteUrl: string }>('/staff/invite', form, accessToken ?? undefined);
      setInviteResult(data);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function toggle(id: string) {
    await api.patch(`/staff/${id}/suspend`, {}, accessToken ?? undefined);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remove this staff member?')) return;
    await api.delete(`/staff/${id}`, accessToken ?? undefined);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Staff</h1>
        <Button onClick={() => { setShowInvite(true); setInviteResult(null); }}>+ Invite staff</Button>
      </div>

      {showInvite && (
        <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-5 mb-6">
          {inviteResult ? (
            <div>
              <p className="font-semibold text-green-700 mb-2">Invite created!</p>
              <p className="text-sm text-gray-600 dark:text-zinc-300 mb-1">Share this link with the staff member:</p>
              <code className="block bg-gray-100 dark:bg-zinc-800 rounded px-3 py-2 text-sm break-all">{inviteResult.inviteUrl}</code>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => { setShowInvite(false); setInviteResult(null); }}>Done</Button>
            </div>
          ) : (
            <form onSubmit={invite} className="flex gap-4 items-end">
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Role</label>
                <select className="border dark:border-zinc-800 rounded px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen">Kitchen</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit">Send invite</Button>
              <Button variant="ghost" type="button" onClick={() => setShowInvite(false)}>Cancel</Button>
            </form>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b dark:border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-zinc-800">
            {staff.map((s) => (
              <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/60">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-zinc-300">{s.email}</td>
                <td className="px-4 py-3 capitalize">{s.role}</td>
                <td className="px-4 py-3"><Badge label={s.status} color={s.status === 'active' ? 'green' : 'red'} /></td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  {s.role !== 'owner' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => toggle(s._id)}>
                        {s.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(s._id)}>Remove</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!staff.length && <p className="text-center py-8 text-gray-400 dark:text-zinc-400 text-sm">No staff yet</p>}
      </div>
    </div>
  );
}
