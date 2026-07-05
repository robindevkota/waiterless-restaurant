import { test, expect } from '@playwright/test';
import { API, USERS, login, auth, getTableQrToken, guestSession } from '../helpers';

// 1×1 transparent PNG — stands in for a merchant QR image
const QR_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Static-QR payments (Nepal reality): the QR is just an image the owner
 * uploads; "I've paid" is an advisory flag. Only the cashier settles bills.
 */
test.describe('Payments: static QR + paid claim', () => {
  let ownerToken: string;

  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, USERS.gfOwner);
  });

  test.afterAll(async ({ request }) => {
    // leave the tenant with no payment QR configured (as seeded)
    await request.patch(`${API}/restaurant/me/settings`, { ...auth(ownerToken), data: { paymentQrUrl: '' } });
  });

  test('owner sets a payment QR; it appears on the public branding payload', async ({ request }) => {
    const save = await request.patch(`${API}/restaurant/me/settings`, {
      ...auth(ownerToken), data: { paymentQrUrl: QR_DATA_URI },
    });
    expect(save.status()).toBe(200);
    expect((await save.json()).settings.paymentQrUrl).toBe(QR_DATA_URI);

    const pub = await request.get(`${API}/restaurant/public/golden-fork/branding`);
    expect(pub.status()).toBe(200);
    expect((await pub.json()).paymentQrUrl).toBe(QR_DATA_URI);
  });

  test('garbage paymentQrUrl is rejected', async ({ request }) => {
    const res = await request.patch(`${API}/restaurant/me/settings`, {
      ...auth(ownerToken), data: { paymentQrUrl: 'javascript:alert(1)' },
    });
    expect(res.status()).toBe(400);
  });

  test('guest claim-paid flags the session for the cashier — bill stays open', async ({ request }) => {
    const guestToken = await guestSession(request, await getTableQrToken(request, ownerToken));

    const claim = await request.post(`${API}/sessions/my/claim-paid`, auth(guestToken));
    expect(claim.status()).toBe(200);

    // Cashier's active-session list carries the flag + claimed amount
    const cashierToken = await login(request, USERS.gfCashier);
    const { sessions } = await (await request.get(`${API}/sessions/active`, auth(cashierToken))).json() as
      { sessions: { paidClaimedAt?: string; paidClaimAmount?: number }[] };
    const claimed = sessions.filter((s) => s.paidClaimedAt);
    expect(claimed.length).toBeGreaterThan(0);
    expect(claimed[0].paidClaimAmount).toBeGreaterThanOrEqual(0);

    // The claim must NOT have marked the bill paid
    const bill = (await (await request.get(`${API}/billing/my`, auth(guestToken))).json()).bill;
    expect(bill.status ?? 'open').not.toBe('paid');
  });

  test('cashier can dismiss a false paid claim (flag cleared, session stays open)', async ({ request }) => {
    const guestToken = await guestSession(request, await getTableQrToken(request, ownerToken));
    await request.post(`${API}/sessions/my/claim-paid`, auth(guestToken));

    const cashierToken = await login(request, USERS.gfCashier);
    const { sessions } = await (await request.get(`${API}/sessions/active`, auth(cashierToken))).json() as
      { sessions: { _id: string; paidClaimedAt?: string }[] };
    const flagged = sessions.find((s) => s.paidClaimedAt);
    expect(flagged).toBeTruthy();

    const clear = await request.post(`${API}/sessions/${flagged!._id}/clear-paid-claim`, auth(cashierToken));
    expect(clear.status()).toBe(200);

    const after = await (await request.get(`${API}/sessions/active`, auth(cashierToken))).json() as
      { sessions: { _id: string; paidClaimedAt?: string; status?: string }[] };
    const same = after.sessions.find((s) => s._id === flagged!._id);
    expect(same, 'session must still be open after dismiss').toBeTruthy();
    expect(same!.paidClaimedAt).toBeUndefined();

    // guests can't clear flags on their own session either
    const guestClear = await request.post(`${API}/sessions/${flagged!._id}/clear-paid-claim`, auth(guestToken));
    expect([401, 403]).toContain(guestClear.status());
  });

  test('claim-paid is idempotent and guests still cannot settle bills', async ({ request }) => {
    const guestToken = await guestSession(request, await getTableQrToken(request, ownerToken));
    const again = await request.post(`${API}/sessions/my/claim-paid`, auth(guestToken));
    expect(again.status()).toBe(200);

    // No guest-reachable settle: session close is cashier-only
    const { sessions } = await (await request.get(`${API}/sessions/active`,
      auth(await login(request, USERS.gfCashier)))).json() as { sessions: { _id: string }[] };
    const close = await request.post(`${API}/sessions/${sessions[0]._id}/close`, {
      ...auth(guestToken), data: { paymentMethod: 'esewa' },
    });
    expect([401, 403]).toContain(close.status());
  });
});
