import { defineConfig, devices } from '@playwright/test';

/**
 * Tes end-to-end memakai database terpisah (excellab_test), API di port 4100, dan web di port 5190
 * sehingga tidak menyentuh data pengembangan. globalSetup mengosongkan dan mengisi ulang database tes.
 * Butuh MySQL (npm run db:up).
 */
const E2E_ENV = {
  NODE_ENV: 'test',
  DB_NAME: 'excellab_test',
  JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
  API_PORT: '4100',
  WEB_ORIGIN: 'http://localhost:5190',
  RATE_LIMIT_ENABLED: 'false',
  BCRYPT_ROUNDS: '4',
  MAIL_MODE: 'console',
  ADMIN_EMAIL: 'admin-e2e@excellab.local',
  ADMIN_PASSWORD: 'admin-e2e-password-1234',
  WORKSHEET_DIR: 'apps/api/storage/e2e-worksheets',
  SPRINT_SECONDS: '8',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:5190', trace: 'retain-on-failure', locale: 'id-ID', acceptDownloads: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx apps/api/src/server.ts',
      url: 'http://localhost:4100/api/health',
      env: E2E_ENV,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite apps/web --port 5190 --strictPort',
      url: 'http://localhost:5190',
      env: { API_PROXY_TARGET: 'http://localhost:4100', WEB_PORT: '5190' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

export const E2E_ADMIN = { email: E2E_ENV.ADMIN_EMAIL, password: E2E_ENV.ADMIN_PASSWORD };
