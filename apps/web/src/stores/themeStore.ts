'use client';
import { create } from 'zustand';

interface ThemeState {
  dark: boolean;
  ready: boolean;          // true once initialized on the client (avoids hydration mismatch)
  init: () => void;
  toggle: () => void;
}

const KEY = 'wl-theme';

export const useThemeStore = create<ThemeState>((set, get) => ({
  dark: false,
  ready: false,

  init: () => {
    if (get().ready) return;
    let dark = false;
    try {
      const saved = localStorage.getItem(KEY);
      dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { /* SSR / privacy mode */ }
    set({ dark, ready: true });
  },

  toggle: () => {
    const dark = !get().dark;
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* ignore */ }
    set({ dark });
  },
}));
