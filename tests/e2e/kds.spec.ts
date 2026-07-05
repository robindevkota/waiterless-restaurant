import { test, expect } from '@playwright/test';
import { USERS } from '../helpers';

test.describe('Kitchen display', () => {
  test('kitchen login lands on KDS and the prep drawer opens', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(USERS.gfKitchen.email);
    await page.locator('input[type="password"]').fill(USERS.gfKitchen.password);
    await page.locator('form button').click();
    await page.waitForURL(/kds/, { timeout: 15_000 });

    await expect(page.getByText(/Active Orders/)).toBeVisible();

    await page.getByRole('button', { name: "Tomorrow's prep" }).click();
    await expect(page.getByText(/plates/)).toBeVisible({ timeout: 10_000 });
    // forecast rows render with quantities
    await expect(page.locator('div.bg-gray-800').first()).toBeVisible();
  });
});
