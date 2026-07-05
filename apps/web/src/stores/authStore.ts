'use client';
import { create } from 'zustand';
import { api, setAccessToken, refreshTokens } from '@/lib/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'platform_admin' | 'owner' | 'cashier' | 'kitchen';
  restaurantId: string | null;
  status: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { restaurantName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  loading: true,

  login: async (email, password) => {
    const data = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    set({ user: data.user, accessToken: data.accessToken, loading: false });
  },

  signup: async (payload) => {
    const data = await api.post<{ accessToken: string; user: User }>('/auth/signup', payload);
    setAccessToken(data.accessToken);
    set({ user: data.user, accessToken: data.accessToken, loading: false });
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    set({ user: null, accessToken: null, loading: false });
  },

  hydrate: async () => {
    set({ loading: true });
    const token = await refreshTokens();
    if (!token) { set({ loading: false }); return; }
    try {
      const data = await api.get<{ user: User }>('/auth/me');
      set({ user: data.user, accessToken: token, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
