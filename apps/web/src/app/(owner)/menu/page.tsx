'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface Category { _id: string; name: string; sortOrder: number; }
interface MenuItem { _id: string; name: string; description: string; price: number; available: boolean; categoryId: { _id: string; name: string }; tags: string[]; preparationTime?: number; }

export default function MenuPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [newCat, setNewCat] = useState('');
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', categoryId: '', preparationTime: '', tags: '' });
  const [error, setError] = useState('');

  const load = async () => {
    if (authLoading || !accessToken) return;
    const [catData, itemData] = await Promise.all([
      api.get<{ categories: Category[] }>('/menu/categories', accessToken),
      api.get<{ items: MenuItem[] }>('/menu/items', accessToken),
    ]);
    setCategories(catData.categories);
    setItems(itemData.items);
  };

  useEffect(() => { load(); }, [accessToken, authLoading]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    await api.post('/menu/categories', { name: newCat }, accessToken ?? undefined);
    setNewCat('');
    load();
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/menu/items', {
        ...itemForm,
        price: parseFloat(itemForm.price),
        preparationTime: itemForm.preparationTime ? parseInt(itemForm.preparationTime) : undefined,
        tags: itemForm.tags ? itemForm.tags.split(',').map((t) => t.trim()) : [],
      }, accessToken ?? undefined);
      setShowItemForm(false);
      setItemForm({ name: '', description: '', price: '', categoryId: '', preparationTime: '', tags: '' });
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function toggleAvail(id: string) {
    await api.patch(`/menu/items/${id}/availability`, {}, accessToken ?? undefined);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this item from menu?')) return;
    await api.delete(`/menu/items/${id}`, accessToken ?? undefined);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-6">Menu</h1>

      {/* Categories */}
      <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-5 mb-6">
        <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-3">Categories</h2>
        <div className="flex gap-2 flex-wrap mb-3">
          {categories.map((c) => <span key={c._id} className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 px-3 py-1 rounded text-sm">{c.name}</span>)}
        </div>
        <form onSubmit={addCategory} className="flex gap-2">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" />
          <Button type="submit" size="sm">Add</Button>
        </form>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Items ({items.length})</h2>
          <Button size="sm" onClick={() => setShowItemForm(true)}>+ Add item</Button>
        </div>

        {showItemForm && (
          <form onSubmit={addItem} className="p-4 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 grid grid-cols-2 gap-3">
            <Input label="Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
            <Input label="Price (NPR)" type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required />
            <div className="col-span-2">
              <Input label="Description" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Category</label>
              <select className="border dark:border-zinc-800 rounded px-3 py-2 text-sm" value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })} required>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="Prep time (min)" type="number" value={itemForm.preparationTime} onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })} />
            <div className="col-span-2">
              <Input label="Tags (comma separated: vegan, spicy, halal…)" value={itemForm.tags} onChange={(e) => setItemForm({ ...itemForm, tags: e.target.value })} />
            </div>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2 flex gap-2">
              <Button type="submit" size="sm">Save item</Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowItemForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b dark:border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Item</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Price</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-300">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-zinc-800">
            {items.map((item) => (
              <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-zinc-100">{item.name}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-400">{item.description}</p>
                  <div className="flex gap-1 mt-1">{item.tags.map((t) => <Badge key={t} label={t} color="gray" />)}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">{item.categoryId?.name}</td>
                <td className="px-4 py-3 text-right font-medium">NPR {item.price}</td>
                <td className="px-4 py-3"><Badge label={item.available ? 'Available' : 'Unavailable'} color={item.available ? 'green' : 'red'} /></td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => toggleAvail(item._id)}>
                    {item.available ? 'Mark unavailable' : 'Mark available'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteItem(item._id)}>Remove</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="text-center py-8 text-gray-400 dark:text-zinc-400 text-sm">No items yet</p>}
      </div>
    </div>
  );
}
