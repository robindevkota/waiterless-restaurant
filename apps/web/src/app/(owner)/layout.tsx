'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuthStore } from '@/stores/authStore';
import { useBrandingStore } from '@/stores/brandingStore';
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon, LogOut, Sparkles } from 'lucide-react';

const nav = [
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/ai-analyst', label: 'AI Analyst', badge: true },
  { href: '/menu',       label: 'Menu' },
  { href: '/inventory',  label: 'Inventory' },
  { href: '/tables',     label: 'Tables & QR' },
  { href: '/staff',      label: 'Staff' },
  { href: '/branding',   label: 'Branding' },
  { href: '/reports',    label: 'Reports' },
  { href: '/settings',   label: 'Settings' },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user, accessToken } = useAuthStore();
  const { branding, load } = useBrandingStore();
  const { dark, init, toggle } = useThemeStore();
  const router = useRouter();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (accessToken && user?.restaurantId) load(accessToken);
  }, [accessToken, user?.restaurantId, load]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const brand = branding.primaryColor || '#E85D04';
  const name = branding.restaurantName || 'Restaurant';

  return (
    <AuthGuard roles={['owner', 'platform_admin']}>
      <div className={dark ? 'dark' : ''} style={{ colorScheme: dark ? 'dark' : 'light' }}>
        {/* --primary drives every Button; --brand is for ad-hoc accents */}
        {/* Base text color so unclassed text stays readable in both themes */}
        <div
          className="min-h-screen bg-[#f6f6f4] dark:bg-[#0b0b0e] text-gray-900 dark:text-zinc-100 transition-colors"
          style={{ ['--primary' as string]: brand, ['--brand' as string]: brand }}
        >
          <header className="print:hidden sticky top-0 z-40 bg-white/70 dark:bg-[#0b0b0e]/70 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.07]">
            {/* Identity row */}
            <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10 shrink-0" />
                ) : (
                  <span
                    className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center text-sm shrink-0"
                    style={{ background: brand }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-zinc-100 leading-tight truncate tracking-tight">{name}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-400 truncate">{branding.tagline || 'Powered by Waiterless'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={toggle}
                  aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="w-9 h-9 rounded-xl border border-black/[0.08] dark:border-white/10 text-gray-500 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] flex items-center justify-center transition"
                >
                  {dark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <div className="hidden sm:flex items-center gap-2.5 pl-1">
                  <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-sm font-semibold flex items-center justify-center">
                    {(user?.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{user?.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-400 capitalize">{user?.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-300 hover:text-red-600 border border-black/[0.08] dark:border-white/10 hover:border-red-200 dark:hover:border-red-900 rounded-xl px-3 py-1.5 transition"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>

            {/* Nav tabs row */}
            <nav className="mx-auto max-w-6xl px-6 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`relative shrink-0 px-3.5 py-2.5 text-sm rounded-t-lg transition ${active ? 'font-semibold' : 'text-gray-500 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'}`}
                    style={active ? { color: brand } : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {n.label}{'badge' in n && n.badge ? <Sparkles size={12} className="opacity-70" /> : null}
                    </span>
                    {active && (
                      <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: brand }} />
                    )}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8 print:p-0 print:max-w-none">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
