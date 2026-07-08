'use client';
/**
 * Soft zone filter for the cashier surfaces (Floor, Payments).
 * "All" always exists and shows the combined queue; per-zone tabs carry an
 * attention count so nothing in another zone is ever invisible — the filter
 * directs attention, it never hides work (break coverage must work).
 * The choice persists per device (localStorage): one till per floor.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'waiterless.zone-filter';

export function useZoneFilter(zones: string[]) {
  const [zone, setZone] = useState<string>(''); // '' = All
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setZone(saved);
  }, []);
  // Saved zone no longer exists (renamed/deleted) → fall back to All
  useEffect(() => {
    if (zone && zones.length && !zones.includes(zone)) setZone('');
  }, [zones, zone]);
  const pick = (z: string) => {
    setZone(z);
    if (z) localStorage.setItem(STORAGE_KEY, z);
    else localStorage.removeItem(STORAGE_KEY);
  };
  return { zone, pick };
}

export function ZoneTabs({ zones, zone, onPick, counts }: {
  zones: string[];
  zone: string;
  onPick: (z: string) => void;
  /** attention count per zone (waiter calls + paid claims / pending items) */
  counts?: Record<string, number>;
}) {
  if (!zones.length) return null;
  const total = counts ? zones.reduce((a, z) => a + (counts[z] ?? 0), 0) : 0;
  const tab = (value: string, label: string, count: number) => {
    const active = zone === value;
    return (
      <button
        key={value || '__all'}
        onClick={() => onPick(value)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
          active
            ? 'border-transparent text-white'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
        style={active ? { background: 'var(--brand, #ea580c)' } : undefined}
      >
        {label}
        {count > 0 && (
          <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none text-center ${
            active ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {tab('', 'All', total)}
      {zones.map((z) => tab(z, z, counts?.[z] ?? 0))}
    </div>
  );
}
