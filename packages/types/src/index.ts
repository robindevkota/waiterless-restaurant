// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'platform_admin' | 'owner' | 'cashier' | 'kitchen';

// ─── Subscription ─────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'trial' | 'basic' | 'pro';
export type SubscriptionStatus = 'active' | 'past_due' | 'blocked';

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date;
  notes?: string;
}

// ─── Branding ─────────────────────────────────────────────────────────────────

export interface Branding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  logoUrl?: string;
  faviconUrl?: string;
  restaurantName: string;
  tagline?: string;
}

// ─── Restaurant Settings ──────────────────────────────────────────────────────

export type AiProvider = 'gemini' | 'groq';

export interface AiSettings {
  provider: AiProvider;
  /** stored server-side only; API responses expose hasGeminiKey/hasGroqKey booleans instead */
  geminiApiKey?: string;
  groqApiKey?: string;
}

export interface RestaurantSettings {
  currency: string;
  vatRate: number;
  timezone: string;
  allowGuestNotes: boolean;
  autoCloseAfterMinutes: number;
  /** Image URL of the restaurant's static merchant payment QR (eSewa/Khalti/FonePay) */
  paymentQrUrl?: string;
  ai?: AiSettings;
}

// ─── AI Business Report ───────────────────────────────────────────────────────

export type AiInsightType = 'win' | 'warning' | 'opportunity';

export interface AiInsight {
  type: AiInsightType;
  title: string;
  detail: string;
  metric?: string;
}

export interface AiAction {
  title: string;
  detail: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface AiMenuEngineering {
  stars: string[];       // high popularity, high revenue — promote
  puzzles: string[];     // low popularity, high revenue — market these
  plowhorses: string[];  // high popularity, low revenue — reprice
  dogs: string[];        // low popularity, low revenue — rework or drop
  note: string;
}

export interface AiReportContent {
  healthScore: number; // 0-100
  healthLabel: 'Strong' | 'Stable' | 'Needs attention' | 'At risk';
  executiveSummary: string;
  insights: AiInsight[];
  menuEngineering: AiMenuEngineering;
  actions: AiAction[];
  forecast: { nextWeekRevenue: number; confidence: 'low' | 'medium' | 'high'; note: string };
}

// ─── Table ────────────────────────────────────────────────────────────────────

export type TableStatus = 'available' | 'occupied' | 'needs_attention';

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionStatus = 'open' | 'closed';

// ─── Menu ─────────────────────────────────────────────────────────────────────

export type MenuItemTag = 'vegan' | 'vegetarian' | 'spicy' | 'gluten_free' | 'halal';

// ─── Order ────────────────────────────────────────────────────────────────────

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// ─── Bill ─────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'esewa' | 'khalti' | 'mobile_banking' | 'split';
export type BillStatus = 'open' | 'paid';

export interface BillLineItem {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

// ─── Socket Events ────────────────────────────────────────────────────────────

export const SocketEvents = {
  // Kitchen receives
  ORDER_NEW: 'order:new',
  ORDER_CANCELLED: 'order:cancelled',
  // Guest receives
  ITEM_STATUS_CHANGED: 'item:status_changed',
  SESSION_CLOSED: 'session:closed',
  BILL_UPDATED: 'bill:updated',
  // Cashier receives
  ORDER_COMPLETED: 'order:completed',
  WAITER_CALLED: 'waiter:called',
  PAYMENT_CLAIMED: 'payment:claimed',
} as const;

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<SubscriptionPlan, { tables: number; menuItems: number; staff: number }> = {
  trial:  { tables: 5,  menuItems: 20, staff: 3 },
  basic:  { tables: 10, menuItems: 50, staff: 5 },
  pro:    { tables: Infinity, menuItems: Infinity, staff: Infinity },
};
