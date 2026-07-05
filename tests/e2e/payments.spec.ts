import { test, expect } from '@playwright/test';
import { API, USERS, login, auth, getTableQrToken } from '../helpers';

const QR_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.describe('Guest bill: static QR + I\'ve paid', () => {
  let qrToken: string;
  let ownerToken: string;

  test.beforeAll(async ({ request }) => {
    ownerToken = await login(request, USERS.gfOwner);
    qrToken = await getTableQrToken(request, ownerToken);
    await request.patch(`${API}/restaurant/me/settings`, { ...auth(ownerToken), data: { paymentQrUrl: QR_DATA_URI } });
  });

  test.afterAll(async ({ request }) => {
    await request.patch(`${API}/restaurant/me/settings`, { ...auth(ownerToken), data: { paymentQrUrl: '' } });
  });

  test('bill screen shows payment QR and the paid signal notifies', async ({ page }) => {
    await page.goto(`/r/golden-fork/table/${qrToken}`);
    await expect(page.getByText('Momo (8 pcs)')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'bill' }).click();
    await expect(page.getByText('Pay from your table')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByAltText('Payment QR')).toBeVisible();

    await page.getByRole('button', { name: "I've paid" }).click();
    await expect(page.getByText(/Cashier notified/)).toBeVisible({ timeout: 10_000 });
  });
});
