'use client';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuthStore } from '@/stores/authStore';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <AuthGuard roles={['platform_admin']}>
      <div className="min-h-screen bg-gray-50 flex">
        <aside className="w-56 bg-gray-900 text-white flex flex-col p-4 gap-1 shrink-0">
          <div className="text-lg font-bold text-white mb-4 px-2">Waiterless Admin</div>
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/restaurants">Restaurants</NavLink>
          <div className="mt-auto pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 px-3 mb-2">{user?.name}</p>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition"
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">
      {children}
    </a>
  );
}
