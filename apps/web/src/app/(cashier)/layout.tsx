'use client';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuthStore } from '@/stores/authStore';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <AuthGuard roles={['cashier', 'owner', 'platform_admin']}>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <span className="font-bold text-gray-900">Cashier — Floor View</span>
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
