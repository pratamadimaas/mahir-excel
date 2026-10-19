import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Request } from 'express';
import type { Ctx } from '../app';
import { isDuplicateError, row, run } from '../db/pool';
import { toPublicUser } from '../lib/publicUser';
import { CSRF_COOKIE, CSRF_HEADER } from '../middleware/auth';
import { AppError, errorBody, parse } from '../middleware/errors';

const CODE_TTL_MINUTES = 10;
const COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const email = z.string().trim().toLowerCase().max(255).pipe(z.email('Format email tidak valid.'));
const purpose = z.enum(['login', 'reset', 'verify']);
const password = z.string().min(8, 'Kata sandi minimal 8 karakter.').max(72, 'Kata sandi maksimal 72 karakter.');

const requestBody = z.object({ email, purpose });
const verifyBody = z.object({
  email,
  purpose,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Kode terdiri dari 6 angka.'),
  newPassword: password.optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
});

const BAD_CODE = 'Kode salah atau sudah kedaluwarsa. Minta kode baru bila perlu.';

/**
 * Login tanpa kata sandi lewat kode email, dan reset kata sandi.
 * Keamanan: kode 6 digit acak (crypto.randomInt), disimpan sebagai HMAC, kedaluwarsa 10 menit,
 * maksimal 5 percobaan, sekali pakai, jeda 60 detik per email, pembatasan laju per IP,
 * dan respons permintaan selalu sama (tidak membocorkan apakah email terdaftar).
 */
export function emailAuthRoutes({ db, config, auth, mailer, google, payments }: Ctx): Router {
  const r = Router();

  const limiter = (limit: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => !config.rateLimitEnabled,
      handler: (_req, res) => {
        res.status(429).json(errorBody('RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'));
      },
    });

  const hashCode = (addr: string, p: string, code: string): string =>
    crypto.createHmac('sha256', config.jwtSecret).update(`${addr}:${p}:${code}`).digest('hex');

  const safeEqual = (a: string, b: string): boolean => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

  /** Untuk tujuan "verify": pengguna harus sedang login dan token CSRF wajib (endpoint ini dikecualikan dari pemeriksaan global). */
  const selfEmail = (req: Request): string => {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
    const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const header = req.get(CSRF_HEADER);
    if (!cookie || !header || !safeEqual(cookie, header)) {
      throw new AppError(403, 'CSRF_INVALID', 'Token keamanan (CSRF) tidak valid. Muat ulang halaman lalu coba lagi.');
    }
    return req.user.email;
  };

  r.get('/config', (_req, res) => {
    res.json({
      data: {
        emailEnabled: mailer.enabled,
        googleClientId: google.clientId,
        premium: {
          priceLabel: config.premium.priceLabel,
          contactUrl: config.premium.contactUrl ?? null,
          paymentEnabled: payments.enabled,
          priceIdr: config.premium.priceIdr,
          months: config.premium.months,
        },
      },
    });
  });

  r.post('/email/request', limiter(10), async (req, res) => {
    const parsed = parse(requestBody, req.body);
    const body = parsed.purpose === 'verify' ? { ...parsed, email: selfEmail(req) } : parsed;
    if (!mailer.enabled) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Login lewat email belum diaktifkan di server ini. Gunakan kata sandi.');
    }
    const user = await row<{ id: number; role: string; email_verified_at: string | null }>(
      db,
      'SELECT id, role, email_verified_at FROM users WHERE email = ?',
      [body.email],
    );

    // Admin wajib memakai kata sandi untuk login; akun yang tidak ada tidak dapat mereset.
    const eligible =
      body.purpose === 'login' ? !user || user.role !== 'admin' : body.purpose === 'reset' ? !!user : !!user && !user.email_verified_at;
    if (eligible) {
      const recent = await row<{ id: number }>(
        db,
        `SELECT id FROM email_codes WHERE email = ? AND purpose = ? AND created_at > (UTC_TIMESTAMP() - INTERVAL ${COOLDOWN_SECONDS} SECOND) LIMIT 1`,
        [body.email, body.purpose],
      );
      if (!recent) {
        const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        await run(
          db,
          `INSERT INTO email_codes (email, purpose, code_hash, expires_at) VALUES (?,?,?, UTC_TIMESTAMP() + INTERVAL ${CODE_TTL_MINUTES} MINUTE)`,
          [body.email, body.purpose, hashCode(body.email, body.purpose, code)],
        );
        const subject =
          body.purpose === 'login'
            ? 'Kode masuk Mahir Excel'
            : body.purpose === 'reset'
              ? 'Kode atur ulang kata sandi Mahir Excel'
              : 'Kode verifikasi email Mahir Excel';
        const intro =
          body.purpose === 'login'
            ? 'Gunakan kode ini untuk masuk ke Mahir Excel. Jika kamu belum punya akun, akun akan dibuat otomatis.'
            : body.purpose === 'reset'
              ? 'Gunakan kode ini untuk mengatur ulang kata sandi Mahir Excel-mu.'
              : 'Gunakan kode ini untuk memverifikasi alamat email akun Mahir Excel-mu.';
        try {
          await mailer.send({
            to: body.email,
            subject,
            text: `${intro}\n\nKode: ${code}\n\nKode berlaku ${CODE_TTL_MINUTES} menit dan hanya bisa dipakai sekali. Jangan bagikan kode ini kepada siapa pun. Jika bukan kamu yang meminta, abaikan email ini.\n\nMahir Excel`,
          });
        } catch (e) {
          // Kegagalan SMTP dicatat tanpa kode; respons tetap generik agar tidak membocorkan status akun.
          console.error('[mail-error]', e instanceof Error ? e.message : 'gagal mengirim email');
        }
      }
    }
    res.json({ data: { sent: true, cooldownSeconds: COOLDOWN_SECONDS } });
  });

  r.post('/email/verify', limiter(20), async (req, res) => {
    const parsed = parse(verifyBody, req.body);
    const body = parsed.purpose === 'verify' ? { ...parsed, email: selfEmail(req) } : parsed;
    if (!mailer.enabled) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Login lewat email belum diaktifkan di server ini.');
    if (body.purpose === 'reset' && !body.newPassword) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Kata sandi baru wajib diisi.', [
        { path: 'newPassword', message: 'Kata sandi baru wajib diisi.' },
      ]);
    }

    const rec = await row<{ id: number; code_hash: string; attempts: number }>(
      db,
      `SELECT id, code_hash, attempts FROM email_codes
       WHERE email = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
       ORDER BY id DESC LIMIT 1`,
      [body.email, body.purpose],
    );
    if (!rec) throw new AppError(400, 'VALIDATION_ERROR', BAD_CODE);
    if (rec.attempts >= MAX_ATTEMPTS) {
      await run(db, 'UPDATE email_codes SET used_at = UTC_TIMESTAMP() WHERE id = ?', [rec.id]);
      throw new AppError(400, 'VALIDATION_ERROR', BAD_CODE);
    }
    await run(db, 'UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?', [rec.id]);
    if (!safeEqual(rec.code_hash, hashCode(body.email, body.purpose, body.code))) throw new AppError(400, 'VALIDATION_ERROR', BAD_CODE);

    // Sekali pakai: hanya satu permintaan yang boleh menandai kode terpakai (mencegah balapan/ulang).
    const used = await run(db, 'UPDATE email_codes SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL', [rec.id]);
    if (used.affectedRows !== 1) throw new AppError(400, 'VALIDATION_ERROR', BAD_CODE);

    if (body.purpose === 'verify') {
      // Hanya menandai email terverifikasi; tidak membuat sesi baru.
      await run(db, 'UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?', [req.user!.id]);
      res.json({ data: { verified: true } });
      return;
    }

    let user = await row<{ id: number; email: string; display_name: string; role: 'user' | 'admin'; premium_until?: string | null }>(
      db,
      'SELECT id, email, display_name, role, premium_until FROM users WHERE email = ?',
      [body.email],
    );
    let isNew = false;

    if (body.purpose === 'reset') {
      if (!user) throw new AppError(400, 'VALIDATION_ERROR', BAD_CODE);
      const hash = await bcrypt.hash(body.newPassword!, config.bcryptRounds);
      await run(
        db,
        'UPDATE users SET password_hash = ?, has_password = 1, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()), last_login_at = UTC_TIMESTAMP() WHERE id = ?',
        [hash, user.id],
      );
      await run(db, 'UPDATE email_codes SET used_at = UTC_TIMESTAMP() WHERE email = ? AND used_at IS NULL', [body.email]);
    } else {
      if (user?.role === 'admin') throw new AppError(403, 'FORBIDDEN', 'Akun admin harus masuk dengan kata sandi.');
      if (!user) {
        // Akun baru tanpa kata sandi: hash acak yang tidak dapat ditebak (kata sandi bisa diatur lewat "lupa kata sandi").
        const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), config.bcryptRounds);
        const name = body.displayName ?? body.email.split('@')[0]!.slice(0, 80);
        try {
          const result = await run(
            db,
            "INSERT INTO users (email, password_hash, display_name, role, has_password, email_verified_at, last_login_at) VALUES (?,?,?, 'user', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())",
            [body.email, unusable, name],
          );
          user = { id: result.insertId, email: body.email, display_name: name, role: 'user' };
          isNew = true;
        } catch (e) {
          if (!isDuplicateError(e)) throw e;
          user = await row(db, 'SELECT id, email, display_name, role, premium_until FROM users WHERE email = ?', [body.email]);
        }
      } else {
        await run(
          db,
          'UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()), last_login_at = UTC_TIMESTAMP() WHERE id = ?',
          [user.id],
        );
      }
    }
    if (!user) throw new AppError(400, 'VALIDATION_ERROR', BAD_CODE);

    const csrfToken = auth.startSession(res, user.id);
    res.json({
      data: {
        user: toPublicUser({
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          emailVerified: true,
          premiumUntil: user.premium_until ?? null,
        }),
        csrfToken,
        isNew,
      },
    });
  });

  return r;
}
