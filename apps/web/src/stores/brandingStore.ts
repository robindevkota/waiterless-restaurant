'use client';
import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Branding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  restaurantName: string;
  tagline?: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export const DEFAULT_BRANDING: Branding = {
  primaryColor: '#E85D04',
  secondaryColor: '#1A1A2E',
  accentColor: '#F5A623',
  backgroundColor: '#FFFFFF',
  fontFamily: 'Inter',
  restaurantName: '',
};

interface BrandingState {
  branding: Branding;
  loaded: boolean;
  load: (token: string) => Promise<void>;
  set: (b: Partial<Branding>) => void;
}

export const useBrandingStore = create<BrandingState>((set, get) => ({
  branding: DEFAULT_BRANDING,
  loaded: false,

  load: async (token: string) => {
    if (get().loaded) return;
    try {
      const d = await api.get<{ restaurant: { branding: Branding } }>('/restaurant/me', token);
      set({ branding: { ...DEFAULT_BRANDING, ...d.restaurant.branding }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  // Lets the branding editor live-update the app chrome after a save
  set: (b) => set((s) => ({ branding: { ...s.branding, ...b } })),
}));
