'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}

interface CartState {
  sessionId: string | null;
  items: CartItem[];
  setSession: (sessionId: string) => void;
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  updateQty: (menuItemId: string, qty: number) => void;
  removeItem: (menuItemId: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      items: [],
      setSession: (sessionId) => {
        // If session changed, wipe old cart
        if (get().sessionId !== sessionId) {
          set({ sessionId, items: [] });
        }
      },
      addItem: (item) => {
        set((state) => {
          const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
          if (existing) {
            return { items: state.items.map((i) => i.menuItemId === item.menuItemId ? { ...i, qty: i.qty + 1 } : i) };
          }
          return { items: [...state.items, { ...item, qty: 1 }] };
        });
      },
      updateQty: (menuItemId, qty) => {
        set((state) => ({
          items: qty <= 0
            ? state.items.filter((i) => i.menuItemId !== menuItemId)
            : state.items.map((i) => i.menuItemId === menuItemId ? { ...i, qty } : i),
        }));
      },
      removeItem: (menuItemId) => set((state) => ({ items: state.items.filter((i) => i.menuItemId !== menuItemId) })),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
    }),
    { name: 'waiterless-cart' }
  )
);
