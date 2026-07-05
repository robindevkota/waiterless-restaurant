import { defineConfig } from '@playwright/test';

/**
 * Two projects:
 *  - api  : request-level integration tests against the Express API (:5000)
 *  - e2e  : headless Chromium tests against the Next.js app (:3001)
 *
 * Both need the dev stack running with seeded data:
 *   npm run dev  (root)   +   npm run seed && npm run seed:demo && npm run seed:inventory  (apps/server)
 * If the stack isn't up, `webServer` below starts it (first run takes ~30s).
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: false, // tests share one seeded DB — keep ordering deterministic
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/last-run.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3001',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testDir: 'tests/api' },
    { name: 'e2e', testDir: 'tests/e2e' },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
