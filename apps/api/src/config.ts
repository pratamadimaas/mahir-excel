import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** Mencari root monorepo (package.json dengan "workspaces") ke atas dari cwd. */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = start;
  for (;;) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        if (JSON.parse(fs.readFileSync(pkg, 'utf8')).workspaces) return dir;
      } catch {
        /* lanjut naik */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

export const repoRoot = findRepoRoot();
dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

const bool = z.string().transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3307),
  DB_USER: z.string().default('excellab'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('excellab'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 karakter'),
  COOKIE_SECURE: bool.default(false),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(11),
  RATE_LIMIT_ENABLED: bool.default(true),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  WORKSHEET_DIR: z.string().optional(),
  MAIL_MODE: z.enum(['smtp', 'console', 'memory', 'disabled']).optional(),
  MAIL_FROM: z.string().default('Mahir Excel <no-reply@localhost>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  SPRINT_SECONDS: z.coerce.number().int().min(5).max(180).default(60),
  PREMIUM_PRICE_LABEL: z.string().default('Rp 29.000 untuk 12 bulan'),
  PREMIUM_CONTACT_URL: z.string().optional(),
  PREMIUM_PRICE_IDR: z.coerce.number().int().min(1500).max(10_000_000).default(29000),
  PREMIUM_MONTHS: z.coerce.number().int().min(1).max(60).default(12),
  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_CALLBACK_TOKEN: z.string().optional(),
  PROGRAM_ENABLED: bool.default(true),
  PROGRAM_QUOTA: z.coerce.number().int().min(1).max(5000).default(100),
  PROGRAM_MIN_EXERCISES: z.coerce.number().int().min(1).max(54).default(5),
});

export type MailMode = 'smtp' | 'console' | 'memory' | 'disabled';

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  webOrigins: string[];
  db: { host: string; port: number; user: string; password: string; database: string };
  jwtSecret: string;
  cookieSecure: boolean;
  bcryptRounds: number;
  rateLimitEnabled: boolean;
  adminEmail?: string;
  adminPassword?: string;
  worksheetDir: string;
  migrationsDir: string;
  googleClientId?: string;
  /** Lama satu ronde Sprint dalam detik (bawaan 60). */
  sprintSeconds: number;
  premium: { priceLabel: string; contactUrl?: string; priceIdr: number; months: number };
  /** Pembayaran QRIS lewat Xendit; aktif bila kunci rahasia dan token callback sama-sama diisi. */
  payments: { secretKey?: string; callbackToken?: string; callbackUrl: string };
  /** Program Perintis: sertifikat gratis untuk pengguna pertama yang memenuhi syarat. */
  program: { enabled: boolean; quota: number; minExercises: number };
  mail: { mode: MailMode; from: string; smtp?: { host: string; port: number; secure: boolean; user?: string; pass?: string } };
}

export function loadConfig(overrides: Record<string, string | undefined> = {}): Config {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Konfigurasi .env tidak valid: ${msg}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production' && !e.COOKIE_SECURE) {
    throw new Error('Di produksi COOKIE_SECURE harus true (gunakan HTTPS).');
  }
  // Mode email: SMTP bila dikonfigurasi; saat pengembangan kode dicetak ke konsol; di produksi tanpa SMTP fitur email dimatikan.
  const mailMode: MailMode = e.MAIL_MODE ?? (e.SMTP_HOST ? 'smtp' : e.NODE_ENV === 'production' ? 'disabled' : 'console');
  if (mailMode === 'smtp' && !e.SMTP_HOST) throw new Error('MAIL_MODE=smtp membutuhkan SMTP_HOST.');
  return {
    env: e.NODE_ENV,
    port: e.API_PORT,
    webOrigins: e.WEB_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    db: { host: e.DB_HOST, port: e.DB_PORT, user: e.DB_USER, password: e.DB_PASSWORD, database: e.DB_NAME },
    jwtSecret: e.JWT_SECRET,
    cookieSecure: e.COOKIE_SECURE,
    bcryptRounds: e.BCRYPT_ROUNDS,
    rateLimitEnabled: e.RATE_LIMIT_ENABLED,
    adminEmail: e.ADMIN_EMAIL || undefined,
    adminPassword: e.ADMIN_PASSWORD || undefined,
    worksheetDir: path.resolve(e.WORKSHEET_DIR || path.join(repoRoot, 'apps/api/storage/worksheets')),
    migrationsDir: path.join(repoRoot, 'database/migrations'),
    googleClientId: e.GOOGLE_CLIENT_ID?.trim() || undefined,
    sprintSeconds: e.SPRINT_SECONDS,
    premium: {
      priceLabel: e.PREMIUM_PRICE_LABEL,
      contactUrl: e.PREMIUM_CONTACT_URL?.trim() || undefined,
      priceIdr: e.PREMIUM_PRICE_IDR,
      months: e.PREMIUM_MONTHS,
    },
    payments: {
      secretKey: e.XENDIT_SECRET_KEY?.trim() || undefined,
      callbackToken: e.XENDIT_CALLBACK_TOKEN?.trim() || undefined,
      callbackUrl: `${(e.WEB_ORIGIN.split(',')[0] ?? '').trim().replace(/\/$/, '')}/api/payments/xendit/callback`,
    },
    program: { enabled: e.PROGRAM_ENABLED, quota: e.PROGRAM_QUOTA, minExercises: e.PROGRAM_MIN_EXERCISES },
    mail: {
      mode: mailMode,
      from: e.MAIL_FROM,
      smtp: e.SMTP_HOST
        ? { host: e.SMTP_HOST, port: e.SMTP_PORT, secure: e.SMTP_SECURE, user: e.SMTP_USER || undefined, pass: e.SMTP_PASS || undefined }
        : undefined,
    },
  };
}
