import { spawnSync } from 'node:child_process';

/** Mengosongkan dan mengisi ulang database tes e2e (migrasi + seed + file worksheet). */
export default function globalSetup(): void {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_NAME: 'excellab_test',
    JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
    MAIL_MODE: 'console',
    BCRYPT_ROUNDS: '4',
    ADMIN_EMAIL: 'admin-e2e@excellab.local',
    ADMIN_PASSWORD: 'admin-e2e-password-1234',
    WORKSHEET_DIR: 'apps/api/storage/e2e-worksheets',
  };
  const reset = spawnSync('npx', ['tsx', 'apps/api/src/db/reset.ts'], { env, stdio: 'inherit', shell: true });
  if (reset.status !== 0) throw new Error('Reset database e2e gagal. Pastikan MySQL berjalan (npm run db:up).');
  const sheets = spawnSync('npx', ['tsx', 'apps/api/src/worksheets/generate.ts'], { env, stdio: 'inherit', shell: true });
  if (sheets.status !== 0) throw new Error('Pembuatan worksheet e2e gagal.');
}
