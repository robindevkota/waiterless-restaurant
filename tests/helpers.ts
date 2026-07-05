import { APIRequestContext, expect } from '@playwright/test';

export const API = 'http://localhost:5000/api';

export const USERS = {
  gfOwner:   { email: 'owner@goldenfork.com',   password: 'Owner@1234' },
  gfCashier: { email: 'cashier@goldenfork.com', password: 'Cashier@1234' },
  gfKitchen: { email: 'kitchen@goldenfork.com', password: 'Kitchen@1234' },
  sgOwner:   { email: 'owner@spicegarden.com',  password: 'Owner@1234' },
  admin:     { email: 'admin@waiterless.app',   password: 'Admin@1234' },
} as const;

export async function login(request: APIRequestContext, user: { email: string; password: string }): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: user });
  expect(res.status(), `login as ${user.email}`).toBe(200);
  const body = await res.json();
  expect(body.accessToken).toBeTruthy();
  return body.accessToken as string;
}

export function auth(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/** Owner-side lookup of a table's QR token (guests receive it via the printed QR). */
export async function getTableQrToken(request: APIRequestContext, ownerToken: string): Promise<string> {
  const res = await request.get(`${API}/tables`, auth(ownerToken));
  expect(res.status()).toBe(200);
  const { tables } = await res.json();
  expect(tables.length).toBeGreaterThan(0);
  return tables[0].qrToken as string;
}

/** Scan the QR: opens/joins a table session and returns a guest JWT. */
export async function guestSession(request: APIRequestContext, qrToken: string): Promise<string> {
  const res = await request.post(`${API}/qr/${qrToken}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.guestToken).toBeTruthy();
  return body.guestToken as string;
}

export async function getIngredients(request: APIRequestContext, ownerToken: string) {
  const res = await request.get(`${API}/inventory/overview`, auth(ownerToken));
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.ingredients as { _id: string; name: string; stock: number; unit: string }[];
}
