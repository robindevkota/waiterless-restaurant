'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

export function AuthGuard({ children, roles }: Props) {
  const { user, loading, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (roles && !roles.includes(user.role)) {
      // Redirect to appropriate home based on role
      const home: Record<string, string> = {
        platform_admin: '/admin',
        owner: '/dashboard',
        cashier: '/floor',
        kitchen: '/kds',
      };
      router.replace(home[user.role] || '/login');
    }
  }, [user, loading, roles, router]);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>;
  if (!user) return null;
  if (roles && !roles.includes(user.role)) return null;

  return <>{children}</>;
}
