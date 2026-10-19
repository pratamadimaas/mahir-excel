import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from './app';
import { createMailer, type Mailer } from './lib/mailer';
import type { GoogleProfile, GoogleVerifier } from './lib/google';
import type { PaymentGateway, QrOrderInput, QrOrderResult } from './lib/xendit';
import { loadConfig, type Config } from './config';
import { createPool, run, type Db } from './db/pool';
import { resetDatabase } from './db/reset';
import { generateWorksheets } from './worksheets/generate';

export const ADMIN_EMAIL = 'admin-test@excellab.local';
export const ADMIN_PASSWORD = 'admin-test-password-1234';
export const CALLBACK_TOKEN = 'token-callback-uji-123';

export function testConfig(extra: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    DB_NAME: 'excellab_test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    RATE_LIMIT_ENABLED: 'false',
    MAIL_MODE: 'memory',
    BCRYPT_ROUNDS: '4',
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    WORKSHEET_DIR: path.join(os.tmpdir(), 'excellab-test-worksheets'),
    XENDIT_SECRET_KEY: 'xnd_development_test',
    XENDIT_CALLBACK_TOKEN: CALLBACK_TOKEN,
    ...extra,
  });
}

export interface TestEnv {
  db: Db;
  config: Config;
  app: ReturnType<typeof createApp>;
  mailer: Mailer;
  google: FakeGoogle;
  payments: FakePayments;
  close: () => Promise<void>;
}

/** Menyiapkan database tes bersih (migrasi + seed) dan file worksheet sementara. */
export async function setupTestEnv(): Promise<TestEnv> {
  const config = testConfig();
  const db = createPool(config);
  await resetDatabase(db, config);
  fs.rmSync(config.worksheetDir, { recursive: true, force: true });
  await generateWorksheets(config.worksheetDir);
  const mailer = createMailer(config);
  const google = createFakeGoogle();
  const payments = createFakePayments();
  return { db, config, mailer, google, payments, app: createApp(db, config, mailer, google, payments), close: () => db.end() };
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  userId: number;
  email: string;
}

let counter = 0;
export async function registerUser(app: TestEnv['app'], name = 'Pengguna Tes'): Promise<Session> {
  const email = `user${Date.now()}${counter++}@example.com`;
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ email, password: 'sandi-aman-123', displayName: name });
  if (res.status !== 201) throw new Error(`register gagal: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: res.body.data.csrfToken, userId: res.body.data.user.id, email };
}

export async function loginAdmin(app: TestEnv['app']): Promise<Session> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (res.status !== 200) throw new Error(`login admin gagal: ${res.status}`);
  return { agent, csrf: res.body.data.csrfToken, userId: res.body.data.user.id, email: ADMIN_EMAIL };
}

/** Pemverifikasi Google palsu: token uji dipetakan ke profil; token lain ditolak seperti token Google yang rusak. */
export interface FakeGoogle extends GoogleVerifier {
  profiles: Record<string, GoogleProfile>;
}

export function createFakeGoogle(clientId: string | null = 'test-client.apps.googleusercontent.com'): FakeGoogle {
  const profiles: Record<string, GoogleProfile> = {};
  return {
    clientId,
    profiles,
    async verify(credential: string): Promise<GoogleProfile> {
      const p = profiles[credential];
      if (!p) throw new Error('token tidak valid');
      return p;
    },
  };
}

/** Gateway pembayaran palsu: mencatat permintaan QR dan bisa dipaksa gagal. */
export interface FakePayments extends PaymentGateway {
  created: QrOrderInput[];
  failNext: boolean;
}

export function createFakePayments(): FakePayments {
  const fake: FakePayments = {
    enabled: true,
    created: [],
    failNext: false,
    async createQr(input: QrOrderInput): Promise<QrOrderResult> {
      if (fake.failNext) {
        fake.failNext = false;
        throw new Error('gagal uji');
      }
      fake.created.push(input);
      return { qrId: `qr_uji_${fake.created.length}`, qrString: `00020101021226QRIS-UJI-${input.reference}` };
    },
  };
  return fake;
}

/** Mengaktifkan Premium langsung lewat SQL (pembayaran di luar aplikasi; admin biasanya memakai endpoint). */
export async function grantPremium(env: TestEnv, userId: number, months = 12): Promise<void> {
  await run(env.db, 'UPDATE users SET premium_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MONTH) WHERE id = ?', [months, userId]);
}
