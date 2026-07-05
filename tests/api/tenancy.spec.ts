import { test, expect } from '@playwright/test';
import { API, USERS, login, auth, getIngredients } from '../helpers';

/**
 * Cross-tenant isolation: a spice-garden owner armed with golden-fork ids
 * must get 404 (not 403 — ids from other tenants should look nonexistent).
 */
test.describe('Tenant isolation', () => {
  let gfToken: string;
  let sgToken: string;
  let gfIngredientId: string;
  let gfMenuItemId: string;

  test.beforeAll(async ({ request }) => {
    gfToken = await login(request, USERS.gfOwner);
    sgToken = await login(request, USERS.sgOwner);
    gfIngredientId = (await getIngredients(request, gfToken))[0]._id;
    const menuRes = await request.get(`${API}/menu/items`, auth(gfToken));
    gfMenuItemId = (await menuRes.json()).items[0]._id;
  });

  test('foreign ingredient restock → 404', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients/${gfIngredientId}/restock`, {
      ...auth(sgToken), data: { qty: 5 },
    });
    expect(res.status()).toBe(404);
  });

  test('foreign ingredient stocktake → 404', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients/${gfIngredientId}/stocktake`, {
      ...auth(sgToken), data: { countedQty: 999 },
    });
    expect(res.status()).toBe(404);
  });

  test('foreign menu item recipe write → 404', async ({ request }) => {
    const res = await request.put(`${API}/inventory/recipes/${gfMenuItemId}`, {
      ...auth(sgToken), data: { lines: [] },
    });
    expect(res.status()).toBe(404);
  });

  test('foreign menu item availability toggle → 404', async ({ request }) => {
    const res = await request.patch(`${API}/menu/items/${gfMenuItemId}/availability`, {
      ...auth(sgToken), data: { available: false },
    });
    expect(res.status()).toBe(404);
  });

  test('tenant reports are isolated (different revenue data)', async ({ request }) => {
    const [gf, sg] = await Promise.all([
      request.get(`${API}/reports/overview`, auth(gfToken)),
      request.get(`${API}/reports/overview`, auth(sgToken)),
    ]);
    const gfDays = (await gf.json()).days as { revenue: number }[];
    const sgDays = (await sg.json()).days as { revenue: number }[];
    const total = (d: { revenue: number }[]) => d.reduce((s, x) => s + x.revenue, 0);
    // golden-fork has 30 days of seeded history; spice-garden must not see it
    expect(total(gfDays)).toBeGreaterThan(0);
    expect(total(sgDays)).not.toBe(total(gfDays));
  });
});
