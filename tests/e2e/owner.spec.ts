import { test, expect, Page } from '@playwright/test';
import { USERS } from '../helpers';

async function loginUI(page: Page, user: { email: string; password: string }, landing: RegExp) {
  await page.goto('/login');
  await page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first().fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('form button').click();
  await page.waitForURL(landing, { timeout: 15_000 });
}

test.describe('Owner app', () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page, USERS.gfOwner, /dashboard/);
  });

  test('dashboard renders KPIs, revenue trend and the upsell tile', async ({ page }) => {
    await expect(page.getByText('Revenue · 7 days')).toBeVisible();
    await expect(page.getByText(/Upsells earned · 30 days/)).toBeVisible();
    await expect(page.getByText('Revenue trend')).toBeVisible();
    await expect(page.getByText('Floor right now')).toBeVisible();
    // Seeded history must not render as zeros (the classic ObjectId-cast bug)
    await expect(page.getByText(/30-day total NPR/)).not.toContainText('NPR 0');
  });

  test('inventory page: all four tabs work', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('button', { name: 'Ingredients', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Ingredients', exact: true }).click();
    await expect(page.getByText('Chicken keema')).toBeVisible();

    await page.getByRole('button', { name: "Tomorrow's prep" }).click();
    await expect(page.getByText(/Prep for /)).toBeVisible();
    await expect(page.getByText('Shopping list')).toBeVisible();

    await page.getByRole('button', { name: 'Stock log' }).click();
    await expect(page.locator('table').getByText(/restock|sale|adjustment/).first()).toBeVisible();
  });

  test('branding page shows guest portal preview', async ({ page }) => {
    await page.goto('/branding');
    await expect(page.getByText('Guest portal preview')).toBeVisible({ timeout: 10_000 });
  });
});
