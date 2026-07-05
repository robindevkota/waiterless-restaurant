'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/Badge';

interface Restaurant {
  _id: string;
  name: string;
  slug: string;
  subscription: { plan: string; status: string };
}

interface RevenueRow {
  restaurantId: string;
  totalRevenue: number;
  totalBills: number;
}

export default function PlatformDashboard() {
  const { accessToken, loading } = useAuthStore();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [revenueMap, setRevenueMap] = useState<Record<string, RevenueRow>>({});
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    if (loading || !accessToken) return;
    Promise.all([
      api.get<{ restaurants: Restaurant[] }>('/platform/restaurants', accessToken),
      api.get<{ grandTotal: number; restaurants: RevenueRow[] }>('/platform/revenue', accessToken),
    ]).then(([rList, rRev]) => {
      setRestaurants(rList.restaurants);
      const map: Record<string, RevenueRow> = {};
      for (const r of rRev.restaurants) map[r.restaurantId] = r;
      setRevenueMap(map);
      setGrandTotal(rRev.grandTotal);
    }).catch(console.error);
  }, [accessToken, loading]);

  const statusColor = (s: string) => s === 'active' ? 'green' : s === 'past_due' ? 'yellow' : 'red';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Platform Overview</h1>
      <p className="text-sm text-gray-500 mb-6">All restaurants on the platform</p>

      <div className="bg-white rounded-lg border p-6 mb-6 inline-block">
        <p className="text-sm text-gray-500">Total revenue (all time)</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">NPR {grandTotal.toLocaleString()}</p>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Restaurant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Bills</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {restaurants.map((r) => {
              const rev = revenueMap[r._id];
              return (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.name}<br/><span className="text-xs text-gray-400">/{r.slug}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.subscription.plan}</td>
                  <td className="px-4 py-3">
                    <Badge label={r.subscription.status} color={statusColor(r.subscription.status) as 'green'|'yellow'|'red'} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">NPR {(rev?.totalRevenue ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{rev?.totalBills ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/restaurants/${r._id}`} className="text-blue-600 hover:underline text-xs">Manage</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {restaurants.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">No restaurants yet</p>
        )}
      </div>
    </div>
  );
}
