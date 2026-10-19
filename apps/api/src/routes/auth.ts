import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Ctx } from '../app';
import { isDuplicateError, row, run } from '../db/pool';
import { toPublicUser } from '../lib/publicUser';
import { CSRF_COOKIE } from '../middleware/auth';
import { AppError, errorBody, parse } from '../middleware/errors';

const email = z.string().trim().toLowerCase().max(255).pipe(z.email('Format email tidak valid.'));

const registerBody = z.object({
  email,
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.').max(72, 'Kata sandi maksimal 72 karakter.'),
  displayName: z.string().trim().min(1, 'Nama tampilan wajib diisi.').max(80),
});

const loginBody = z.object({ email, password: z.string().min(1).max(72) });

// Hash dummy supaya waktu respons login tidak membocorkan apakah email terdaftar.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 4);

export function authRoutes({ db, config, auth, google }: Ctx): Router {
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

  const publicUser = toPublicUser;

  r.post('/register', limiter(10), async (req, res) => {
    const body = parse(registerBody, req.body);
    const hash = await bcrypt.hash(body.password, config.bcryptRounds);
    let id: number;
    try {
      const result = await run(db, "INSERT INTO users (email, password_hash, display_name, role) VALUES (?,?,?, 'user')", [
        body.email,
        hash,
        body.displayName,
      ]);
      id = result.insertId;
    } catch (e) {
      if (isDuplicateError(e)) throw new AppError(409, 'CONFLICT', 'Email ini sudah terdaftar. Coba masuk.');
      throw e;
    }
    await run(db, 'UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    const csrfToken = auth.startSession(res, id);
    res.status(201).json({ data: { user: publicUser({ id, email: body.email, displayName: body.displayName, role: 'user' }), csrfToken } });
  });

  r.post('/login', limiter(20), async (req, res) => {
    const body = parse(loginBody, req.body);
    const u = await row<{
      id: number;
      email: string;
      password_hash: string;
      display_name: string;
      role: string;
      email_verified_at: string | null;
      premium_until: string | null;
    }>(db, 'SELECT id, email, password_hash, display_name, role, email_verified_at, premium_until FROM users WHERE email = ?', [
      body.email,
    ]);
    const ok = await bcrypt.compare(body.password, u?.password_hash ?? DUMMY_HASH);
    if (!u || !ok) throw new AppError(401, 'UNAUTHENTICATED', 'Email atau kata sandi salah.');
    await run(db, 'UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [u.id]);
    const csrfToken = auth.startSession(res, u.id);
    res.json({
      data: {
        user: publicUser({
          id: u.id,
          email: u.email,
          displayName: u.display_name,
          role: u.role,
          emailVerified: !!u.email_verified_at,
          premiumUntil: u.premium_until,
        }),
        csrfToken,
      },
    });
  });

  // Masuk atau daftar dengan akun Google. Token diverifikasi di server; email Google harus terverifikasi.
  // Akun admin tetap wajib memakai kata sandi.
  r.post('/google', limiter(20), async (req, res) => {
    if (!google.clientId) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Login dengan Google belum tersedia.');
    const { credential } = parse(z.object({ credential: z.string().min(20).max(4000) }), req.body);
    let profile;
    try {
      profile = await google.verify(credential);
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Login dengan Google gagal. Coba lagi.');
    }
    if (!profile.emailVerified) throw new AppError(403, 'FORBIDDEN', 'Email akun Google ini belum terverifikasi.');

    type Found = {
      id: number;
      email: string;
      display_name: string;
      role: 'user' | 'admin';
      google_sub: string | null;
      premium_until: string | null;
    };
    let user = await row<Found>(
      db,
      'SELECT id, email, display_name, role, google_sub, premium_until FROM users WHERE google_sub = ? OR email = ? ORDER BY (google_sub = ?) DESC LIMIT 1',
      [profile.sub, profile.email, profile.sub],
    );
    let isNew = false;
    if (user) {
      if (user.role === 'admin') throw new AppError(403, 'FORBIDDEN', 'Akun admin harus masuk dengan kata sandi.');
      if (user.google_sub && user.google_sub !== profile.sub)
        throw new AppError(403, 'FORBIDDEN', 'Email ini sudah terhubung ke akun Google lain.');
      await run(
        db,
        'UPDATE users SET google_sub = COALESCE(google_sub, ?), email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()), last_login_at = UTC_TIMESTAMP() WHERE id = ?',
        [profile.sub, user.id],
      );
    } else {
      const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), config.bcryptRounds);
      const name = (profile.name?.trim() || profile.email.split('@')[0]!).slice(0, 80);
      try {
        const result = await run(
          db,
          "INSERT INTO users (email, password_hash, display_name, role, has_password, email_verified_at, last_login_at, google_sub) VALUES (?,?,?, 'user', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP(), ?)",
          [profile.email, unusable, name, profile.sub],
        );
        user = {
          id: result.insertId,
          email: profile.email,
          display_name: name,
          role: 'user',
          google_sub: profile.sub,
          premium_until: null,
        };
        isNew = true;
      } catch (e) {
        if (!isDuplicateError(e)) throw e;
        throw new AppError(409, 'CONFLICT', 'Akun dengan email ini sudah ada. Coba masuk lagi.');
      }
    }
    const csrfToken = auth.startSession(res, user.id);
    res.status(isNew ? 201 : 200).json({
      data: {
        user: publicUser({
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          emailVerified: true,
          premiumUntil: user.premium_until,
        }),
        csrfToken,
        isNew,
      },
    });
  });

  r.post('/logout', (_req, res) => {
    auth.endSession(res);
    res.json({ data: { ok: true } });
  });

  // Menghapus akun beserta seluruh progresnya (ON DELETE CASCADE). Butuh login, token CSRF, dan kata sandi.
  r.delete('/account', auth.requireAuth, async (req, res) => {
    const body = parse(z.object({ password: z.string().min(1).max(72) }), req.body);
    const u = await row<{ password_hash: string }>(db, 'SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!u || !(await bcrypt.compare(body.password, u.password_hash))) throw new AppError(401, 'UNAUTHENTICATED', 'Kata sandi salah.');
    await run(db, 'DELETE FROM users WHERE id = ?', [req.user!.id]);
    auth.endSession(res);
    res.json({ data: { ok: true } });
  });

  // Pengunjung anonim mendapat { user: null } (bukan 401) agar klien tidak menampilkan galat saat memuat halaman.
  r.get('/me', (req, res) => {
    res.json({
      data: {
        user: req.user ? publicUser(req.user) : null,
        csrfToken: req.user ? ((req.cookies?.[CSRF_COOKIE] as string | undefined) ?? null) : null,
      },
    });
  });

  return r;
}
