import { test, expect } from '@playwright/test';
import { API, USERS, login, auth, getTableQrToken, guestSession, getIngredients } from '../helpers';

/**
 * The money path: QR scan → menu → order → inventory deduction → running bill.
 * Mutates the dev DB (one 1x-Momo order per run) — that's fine for seeded data.
 */
test.describe('Guest order flow', () => {
  let ownerToken: string;
  let guestToken: string;

  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, USERS.gfOwner);
    guestToken = await guestSession(request, await getTableQrToken(request, ownerToken));
  });

  test('guest menu hides unavailable items; staff see everything', async ({ request }) => {
    const [guestRes, ownerRes] = await Promise.all([
      request.get(`${API}/menu/items`, auth(guestToken)),
      request.get(`${API}/menu/items`, auth(ownerToken)),
    ]);
    const guestItems = (await guestRes.json()).items as { available: boolean }[];
    const ownerItems = (await ownerRes.json()).items as { available: boolean }[];
    expect(guestItems.every((i) => i.available)).toBe(true);
    expect(ownerItems.length).toBeGreaterThanOrEqual(guestItems.length);
  });

  test('placing an order deducts recipe ingredients and updates the bill', async ({ request }) => {
    const items = (await (await request.get(`${API}/menu/items`, auth(guestToken))).json()).items as
      { _id: string; name: string; price: number }[];
    const momo = items.find((i) => /momo/i.test(i.name));
    expect(momo, 'seeded Momo item present').toBeTruthy();

    const keemaBefore = (await getIngredients(request, ownerToken)).find((i) => /keema/i.test(i.name))!;

    const orderRes = await request.post(`${API}/orders`, {
      ...auth(guestToken), data: { items: [{ menuItemId: momo!._id, qty: 1 }] },
    });
    expect(orderRes.status()).toBe(201);
    const { order } = await orderRes.json();
    expect(order.items[0].name).toBe(momo!.name);

    // Momo recipe uses 0.2kg keema per serving (seed:inventory)
    const keemaAfter = (await getIngredients(request, ownerToken)).find((i) => /keema/i.test(i.name))!;
    expect(keemaBefore.stock - keemaAfter.stock).toBeCloseTo(0.2, 3);

    const bill = (await (await request.get(`${API}/billing/my`, auth(guestToken))).json()).bill;
    expect(bill.subtotal).toBeGreaterThanOrEqual(momo!.price);
  });

  test('order for an unknown/foreign menu item is rejected', async ({ request }) => {
    const res = await request.post(`${API}/orders`, {
      ...auth(guestToken), data: { items: [{ menuItemId: '000000000000000000000000', qty: 1 }] },
    });
    expect(res.status()).toBe(422);
  });

  test('guest token cannot reach staff endpoints', async ({ request }) => {
    for (const path of ['/inventory/overview', '/reports/overview', '/orders/active']) {
      const res = await request.get(`${API}${path}`, auth(guestToken));
      expect([401, 403], `${path} must reject guest tokens`).toContain(res.status());
    }
  });

  test('upsell suggestions pair with the cart and never suggest cart items', async ({ request }) => {
    const items = (await (await request.get(`${API}/menu/items`, auth(guestToken))).json()).items as
      { _id: string; name: string }[];
    const momo = items.find((i) => /momo/i.test(i.name))!;
    const res = await request.get(`${API}/orders/upsell?with=${momo._id}`, auth(guestToken));
    expect(res.status()).toBe(200);
    const { suggestions } = await res.json() as { suggestions: { menuItemId: string; name: string; price: number; pairCount: number }[] };
    expect(suggestions.length).toBeGreaterThan(0); // 30 days of seeded co-occurrence
    expect(suggestions.length).toBeLessThanOrEqual(3);
    for (const s of suggestions) {
      expect(s.menuItemId).not.toBe(momo._id);
      expect(s.pairCount).toBeGreaterThanOrEqual(2);
      expect(s.price).toBeGreaterThan(0);
    }
  });

  test('upsell with an empty cart returns no suggestions', async ({ request }) => {
    const res = await request.get(`${API}/orders/upsell?with=`, auth(guestToken));
    expect(res.status()).toBe(200);
    expect((await res.json()).suggestions).toEqual([]);
  });
});
