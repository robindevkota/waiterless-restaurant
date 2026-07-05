import { test, expect } from '@playwright/test';
import { API, USERS, login, auth } from '../helpers';

/**
 * Inventory v1+v2 on a dedicated throwaway ingredient (created and deleted
 * per run) so the suite never disturbs the seeded Nepali ratios.
 */
test.describe('Inventory lifecycle', () => {
  const NAME = `__test_ingredient_${Date.now()}`;
  let token: string;
  let id: string;

  test.beforeAll(async ({ request }) => {
    token = await login(request, USERS.gfOwner);
  });

  test.afterAll(async ({ request }) => {
    if (id) await request.delete(`${API}/inventory/ingredients/${id}`, auth(token));
  });

  test('create ingredient', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients`, {
      ...auth(token),
      data: { name: NAME, unit: 'kg', stock: 10, costPrice: 100, lowStockThreshold: 2, category: 'kitchen' },
    });
    expect(res.status()).toBe(201);
    id = (await res.json()).ingredient._id;
  });

  test('invalid unit is rejected', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients`, {
      ...auth(token), data: { name: `${NAME}_bad`, unit: 'barrel', costPrice: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('restock adds stock and logs the movement', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients/${id}/restock`, {
      ...auth(token), data: { qty: 2.5, note: 'test restock' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ingredient.stock).toBeCloseTo(12.5, 3);
  });

  test('stocktake overrides stock and reports the variance', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients/${id}/stocktake`, {
      ...auth(token), data: { countedQty: 11, note: 'test count' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.stock).toBe(11);
    expect(body.variance).toBeCloseTo(-1.5, 3);
  });

  test('negative stocktake count is rejected', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients/${id}/stocktake`, {
      ...auth(token), data: { countedQty: -1 },
    });
    expect(res.status()).toBe(400);
  });

  test('stock log records the restock and the stocktake', async ({ request }) => {
    const res = await request.get(`${API}/inventory/logs?limit=20`, auth(token));
    expect(res.status()).toBe(200);
    const { logs } = await res.json() as { logs: { type: string; qty: number; note?: string; ingredientId: { name: string } | null }[] };
    const mine = logs.filter((l) => l.ingredientId?.name === NAME);
    expect(mine.some((l) => l.type === 'restock' && l.qty === 2.5)).toBe(true);
    expect(mine.some((l) => l.type === 'adjustment' && Math.abs(l.qty + 1.5) < 0.001)).toBe(true);
  });

  test('CSV import: upserts good rows, reports bad rows', async ({ request }) => {
    const res = await request.post(`${API}/inventory/ingredients/import`, {
      ...auth(token),
      data: {
        rows: [
          { name: NAME, unit: 'kg', stock: '7', costPrice: '120', lowStockThreshold: '1', category: 'kitchen' }, // update
          { name: '', unit: 'kg', costPrice: '5' },            // missing name
          { name: 'x', unit: 'barrel', costPrice: '5' },       // bad unit
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(1);
    expect(body.created).toBe(0);
    expect(body.errors).toHaveLength(2);
  });

  test('prep forecast has a coherent shape and real seeded demand', async ({ request }) => {
    const res = await request.get(`${API}/inventory/prep`, auth(token));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.forDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.counts.totalPlates).toBeGreaterThan(0); // 30 days of history seeded
    for (const item of body.items) {
      expect(item.forecastQty).toBeGreaterThan(0);
      expect(item.daysSeen).toBeLessThanOrEqual(body.basedOnWeeks);
    }
    for (const ing of body.ingredients) {
      expect(ing.shortfall).toBeGreaterThanOrEqual(0);
      expect(ing.required).toBeGreaterThan(0);
    }
  });

  test('soft-deleted ingredient disappears from overview', async ({ request }) => {
    const del = await request.delete(`${API}/inventory/ingredients/${id}`, auth(token));
    expect(del.status()).toBe(200);
    const overview = await (await request.get(`${API}/inventory/overview`, auth(token))).json();
    expect(overview.ingredients.some((i: { name: string }) => i.name === NAME)).toBe(false);
    id = ''; // already cleaned up
  });
});
