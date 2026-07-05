import { test, expect } from '@playwright/test';
import { USERS, login, getTableQrToken } from '../helpers';

test.describe('Guest portal', () => {
  let qrToken: string;

  test.beforeAll(async ({ request }) => {
    qrToken = await getTableQrToken(request, await login(request, USERS.gfOwner));
  });

  test('QR page loads themed portal with menu', async ({ page }) => {
    await page.goto(`/r/golden-fork/table/${qrToken}`);
    await expect(page.getByText('The Golden Fork').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /call waiter/i })).toBeVisible();
    await expect(page.getByText('Momo (8 pcs)')).toBeVisible();
  });

  test('add to cart → upsell chips appear → chip adds the item', async ({ page }) => {
    await page.goto(`/r/golden-fork/table/${qrToken}`);
    await expect(page.getByText('Momo (8 pcs)')).toBeVisible({ timeout: 15_000 });

    // add momo from the menu card
    await page.locator('div', { hasText: /^Momo \(8 pcs\)/ }).locator('button', { hasText: '+' }).last().click();
    await page.getByRole('button', { name: /cart \(1\)/i }).click();

    await expect(page.getByText('Your cart')).toBeVisible();
    await expect(page.getByText('Goes well with your order')).toBeVisible({ timeout: 10_000 });

    // clicking a suggestion chip adds it to the cart
    const chip = page.locator('button', { hasText: /NPR/ }).filter({ hasText: /Dal Bhat|Lassi|Thali|Tea/ }).first();
    const chipName = (await chip.textContent())!.replace(/·.*$/, '').trim();
    await chip.click();
    await expect(page.getByRole('button', { name: /cart \(2\)/i })).toBeVisible();
    await expect(page.locator('div.bg-white', { hasText: chipName }).first()).toBeVisible();
  });
});
