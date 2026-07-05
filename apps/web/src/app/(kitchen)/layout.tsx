'use client';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuthStore } from '@/stores/authStore';

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <AuthGuard roles={['kitchen', 'owner', 'platform_admin']}>
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <span className="font-bold text-lg">Kitchen Display</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">Sign out</button>
          </div>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </AuthGuard>
  );
}
