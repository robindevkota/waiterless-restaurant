'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuthStore } from '@/stores/authStore';

const TABS = [
  { href: '/floor', label: 'Floor' },
  { href: '/payments', label: 'Payments' },
];

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <AuthGuard roles={['cashier', 'owner', 'platform_admin']}>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-900">Cashier</span>
            <nav className="flex items-center gap-1">
              {TABS.map((t) => (
                <Link key={t.href} href={t.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${pathname.startsWith(t.href) ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800">Sign out</button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
