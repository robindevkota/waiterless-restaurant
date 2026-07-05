import { test, expect } from '@playwright/test';
import { API, USERS, login, auth } from '../helpers';

test.describe('Auth & roles', () => {
  test('owner login returns access token and safe user object', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, { data: USERS.gfOwner });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.role).toBe('owner');
    // No secret material may ever leave the API
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toMatch(/gsk_|AIza/);
  });

  test('wrong password is rejected', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: USERS.gfOwner.email, password: 'WrongPass@1' },
    });
    expect(res.status()).toBe(401);
  });

  test('unauthenticated request to a protected route is rejected', async ({ request }) => {
    const res = await request.get(`${API}/inventory/overview`);
    expect(res.status()).toBe(401);
  });

  test('kitchen role cannot access owner-only inventory routes', async ({ request }) => {
    const token = await login(request, USERS.gfKitchen);
    const res = await request.get(`${API}/inventory/overview`, auth(token));
    expect(res.status()).toBe(403);
  });

  test('kitchen role CAN read the prep forecast', async ({ request }) => {
    const token = await login(request, USERS.gfKitchen);
    const res = await request.get(`${API}/inventory/prep`, auth(token));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.weekday).toBeTruthy();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('cashier cannot generate AI reports (owner-only)', async ({ request }) => {
    const token = await login(request, USERS.gfCashier);
    const res = await request.get(`${API}/ai/reports`, auth(token));
    expect(res.status()).toBe(403);
  });

  test('settings response exposes key flags, never key material', async ({ request }) => {
    const token = await login(request, USERS.gfOwner);
    const res = await request.get(`${API}/restaurant/me`, auth(token));
    expect(res.status()).toBe(200);
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toMatch(/gsk_|AIza|v1:[A-Za-z0-9+/]/);
  });
});
