'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBrandingStore } from '@/stores/brandingStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Bell, Star } from 'lucide-react';

interface Branding {
  primaryColor: string; secondaryColor: string; accentColor: string;
  backgroundColor: string; fontFamily: string; restaurantName: string; tagline: string;
  logoUrl?: string; faviconUrl?: string;
}

export default function BrandingPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const syncAppChrome = useBrandingStore((s) => s.set);
  const [branding, setBranding] = useState<Branding>({ primaryColor: '#E85D04', secondaryColor: '#1A1A2E', accentColor: '#F5A623', backgroundColor: '#FFFFFF', fontFamily: 'Inter', restaurantName: '', tagline: '', logoUrl: '', faviconUrl: '' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    api.get<{ restaurant: { branding: Branding } }>('/restaurant/me', accessToken).then((d) => setBranding({ logoUrl: '', faviconUrl: '', ...d.restaurant.branding }));
  }, [accessToken, authLoading]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await api.patch('/restaurant/me/branding', branding, accessToken ?? undefined);
    syncAppChrome(branding); // header/nav/charts restyle immediately
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setLoading(false);
  }

  const field = (key: keyof Branding) => (
    <Input label={key.replace(/([A-Z])/g, ' $1').trim()} value={branding[key]} onChange={(e) => setBranding({ ...branding, [key]: e.target.value })} />
  );

  return (
    <div>
      {/* Header row — page title left, preview title at the same level right */}
      <div className="grid lg:grid-cols-2 gap-6 mb-5 items-end">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Branding</h1>
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Guest portal preview</p>
          <p className="text-xs text-gray-400 dark:text-zinc-400 mt-0.5">
            The guest&apos;s phone — uses your background color, not your admin theme. Tap the tabs or arrows to see every screen.
          </p>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        <form onSubmit={save} className="bg-white dark:bg-[#131318] border dark:border-zinc-800 rounded-lg p-5 flex flex-col gap-4">
          {field('restaurantName')}
          {field('tagline')}
          {field('fontFamily')}
          <Input
            label="Logo URL"
            placeholder="https://…/logo.png (square works best)"
            value={branding.logoUrl ?? ''}
            onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
          />
          <Input
            label="Favicon URL"
            placeholder="https://…/favicon.png (shown in guests' browser tab)"
            value={branding.faviconUrl ?? ''}
            onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Primary color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="h-9 w-12 rounded cursor-pointer border dark:border-zinc-800" />
                <Input value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Secondary color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={branding.secondaryColor} onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })} className="h-9 w-12 rounded cursor-pointer border dark:border-zinc-800" />
                <Input value={branding.secondaryColor} onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Accent color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={branding.accentColor} onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })} className="h-9 w-12 rounded cursor-pointer border dark:border-zinc-800" />
                <Input value={branding.accentColor} onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Background color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={branding.backgroundColor} onChange={(e) => setBranding({ ...branding, backgroundColor: e.target.value })} className="h-9 w-12 rounded cursor-pointer border dark:border-zinc-800" />
                <Input value={branding.backgroundColor} onChange={(e) => setBranding({ ...branding, backgroundColor: e.target.value })} className="flex-1" />
              </div>
            </div>
          </div>
          <Button type="submit" loading={loading}>{saved ? 'Saved!' : 'Save branding'}</Button>
        </form>

        <PreviewPhone branding={branding} />
      </div>
    </div>
  );
}

/* ── Guest portal preview: phone frame with all four guest views ──────────── */

type PreviewView = 'menu' | 'cart' | 'orders' | 'bill';
const PREVIEW_VIEWS: PreviewView[] = ['menu', 'cart', 'orders', 'bill'];

function PreviewPhone({ branding }: { branding: Branding }) {
  const [view, setView] = useState<PreviewView>('menu');
  const p = branding.primaryColor;
  const idx = PREVIEW_VIEWS.indexOf(view);

  const itemCard = 'bg-white rounded-xl border border-gray-200 p-2.5 flex items-center justify-between gap-2';
  const rowText = 'text-[11px] text-gray-700';

  return (
    <div className="w-full h-full">
      <div className="h-full flex flex-col items-center justify-center gap-5 rounded-2xl border border-black/[0.06] dark:border-white/[0.07] bg-gray-100/60 dark:bg-zinc-900/50 py-8">
        {/* Phone frame */}
        <div className="w-[320px] rounded-[2.6rem] border-[7px] border-gray-900 dark:border-black bg-gray-900 dark:bg-black shadow-2xl overflow-hidden">
          <div className="relative rounded-[2.1rem] overflow-hidden flex flex-col" style={{ backgroundColor: branding.backgroundColor, fontFamily: branding.fontFamily }}>
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full bg-gray-900 dark:bg-black z-10" />

            {/* Guest header */}
            <div style={{ backgroundColor: p }} className="pt-8 pb-3 px-4 text-white flex items-center gap-2.5">
              {branding.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover bg-white/20 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{branding.restaurantName || 'Your Restaurant'}</p>
                <p className="text-[10px] opacity-80 truncate">Table 4 · {branding.tagline || 'Your tagline here'}</p>
              </div>
              <span className="ml-auto shrink-0 bg-white text-[9px] font-semibold rounded-full px-2 py-1" style={{ color: p }}>
                <Bell size={10} className="inline -mt-0.5" /> Call waiter
              </span>
            </div>

            {/* Guest nav tabs — clickable, mirrors the real portal */}
            <div className="flex bg-white border-b border-gray-200">
              {PREVIEW_VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="flex-1 py-2 text-[10px] font-medium capitalize transition"
                  style={view === v ? { color: p, boxShadow: `inset 0 -2px 0 ${p}` } : { color: '#6b7280' }}
                >
                  {v === 'cart' ? 'Cart (2)' : v}
                </button>
              ))}
            </div>

            {/* Views */}
            <div className="p-3 min-h-[430px]">
              {view === 'menu' && (
                <div className="space-y-2">
                  <div className="flex gap-1.5 pb-1">
                    {['Starters', 'Mains', 'Desserts', 'Drinks'].map((c, i) => (
                      <span key={c} className="text-[9px] px-2 py-1 rounded-full font-medium"
                        style={i === 0 ? { background: p, color: '#fff' } : { background: '#f3f4f6', color: '#374151' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                  {[
                    ['Momo (8 pcs)', 'Steamed dumplings with chutney', 220],
                    ['Chicken Sekuwa', 'Grilled spiced skewers', 350],
                    ['Vegetable Spring Roll', 'Crispy, with mixed veg', 180],
                    ['Dal Bhat Set', 'Rice, lentils, veg & pickle', 380],
                    ['Masala Tea', 'Spiced milk tea', 80],
                  ].map(([name, desc, price]) => (
                    <div key={String(name)} className="bg-white rounded-xl border border-gray-200 p-2.5 flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold text-gray-800 truncate">{name}</span>
                        <span className="block text-[9px] text-gray-400 truncate">{desc}</span>
                        <span className="block text-[10px] font-bold text-gray-800 mt-0.5">NPR {price}</span>
                      </span>
                      <button style={{ backgroundColor: p }} className="text-white text-xs w-6 h-6 rounded-full font-bold shrink-0">+</button>
                    </div>
                  ))}
                </div>
              )}

              {view === 'cart' && (
                <div className="space-y-2">
                  {[['Momo (8 pcs)', 2, 440], ['Masala Tea', 1, 80]].map(([name, qty, amt]) => (
                    <div key={String(name)} className={itemCard}>
                      <span className={rowText}>{name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">−</span>
                        <span className="text-[10px] font-semibold text-gray-800">{qty}</span>
                        <span style={{ backgroundColor: p }} className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center">+</span>
                        <span className="text-[10px] font-semibold text-gray-800 ml-1 tabular-nums">NPR {amt}</span>
                      </span>
                    </div>
                  ))}
                  <div className="bg-white rounded-xl border border-gray-200 p-2.5 flex justify-between text-[11px] font-bold text-gray-800">
                    <span>Cart total</span><span>NPR 520</span>
                  </div>
                  <button style={{ backgroundColor: p }} className="w-full text-white text-[11px] font-semibold rounded-xl py-2.5">
                    Place Order
                  </button>
                </div>
              )}

              {view === 'orders' && (
                <div className="space-y-2">
                  <p className="text-[9px] text-gray-400">8:42 PM</p>
                  <div className="bg-white rounded-xl border border-gray-200 p-2.5 space-y-1.5">
                    {[['2× Momo (8 pcs)', 'ready', '#16a34a'], ['1× Chicken Sekuwa', 'preparing', '#d97706'], ['1× Masala Tea', 'pending', '#ca8a04']].map(([n, s, c]) => (
                      <div key={String(n)} className="flex items-center justify-between">
                        <span className={rowText}>{n}</span>
                        <span className="text-[9px] font-semibold capitalize" style={{ color: String(c) }}>{s}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-400 text-center pt-1">Statuses update live as the kitchen cooks</p>
                </div>
              )}

              {view === 'bill' && (
                <div className="space-y-2">
                  <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-gray-500"><span>Subtotal</span><span className="tabular-nums">NPR 520</span></div>
                    <div className="flex justify-between text-[10px] text-gray-500"><span>VAT (13%)</span><span className="tabular-nums">NPR 68</span></div>
                    <div className="flex justify-between text-[11px] font-bold text-gray-800 border-t border-gray-100 pt-1.5"><span>Total</span><span className="tabular-nums">NPR 588</span></div>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center">Please pay at the counter or ask your cashier.</p>
                  <div className="flex justify-center gap-1 pt-1" aria-hidden="true">{[1,2,3,4,5].map((s) => <Star key={s} size={14} className="text-amber-400 fill-amber-400" />)}</div>
                  <p className="text-[9px] text-gray-400 text-center">Guests rate their visit after paying</p>
                </div>
              )}
            </div>

            {/* Home indicator */}
            <div className="pb-2 pt-1 flex justify-center">
              <div className="w-24 h-1 rounded-full bg-gray-900/25" />
            </div>
          </div>
        </div>

        {/* Slider controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView(PREVIEW_VIEWS[(idx - 1 + PREVIEW_VIEWS.length) % PREVIEW_VIEWS.length])}
            aria-label="Previous screen"
            className="w-8 h-8 rounded-full border border-black/10 dark:border-white/15 text-gray-500 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            ‹
          </button>
          <div className="flex gap-1.5">
            {PREVIEW_VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`Show ${v}`}
                className="w-2 h-2 rounded-full transition"
                style={{ background: view === v ? p : 'rgba(128,128,128,0.35)' }}
              />
            ))}
          </div>
          <button
            onClick={() => setView(PREVIEW_VIEWS[(idx + 1) % PREVIEW_VIEWS.length])}
            aria-label="Next screen"
            className="w-8 h-8 rounded-full border border-black/10 dark:border-white/15 text-gray-500 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            ›
          </button>
          <span className="text-xs text-gray-400 dark:text-zinc-400 capitalize w-12">{view}</span>
        </div>
      </div>
    </div>
  );
}
