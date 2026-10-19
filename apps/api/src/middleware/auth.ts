import crypto from 'node:crypto';
import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Config } from '../config';
import { row, type Db } from '../db/pool';
import { AppError } from './errors';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  premiumUntil: string | null;
  /** Premium aktif (admin selalu dianggap premium). */
  premium: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const SESSION_COOKIE = 'excellab_session';
export const CSRF_COOKIE = 'excellab_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SESSION_DAYS = 7;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Login dan registrasi tidak membawa sesi yang perlu dilindungi CSRF. */
const CSRF_EXEMPT = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/email/request',
  '/api/auth/email/verify',
  '/api/auth/google',
  '/api/track',
  '/api/placement',
]);

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function createAuth(db: Db, config: Config) {
  const baseCookie = (httpOnly: boolean): CookieOptions => ({
    httpOnly,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });

  function startSession(res: Response, userId: number): string {
    const token = jwt.sign({ sub: String(userId) }, config.jwtSecret, { algorithm: 'HS256', expiresIn: `${SESSION_DAYS}d` });
    const csrf = crypto.randomBytes(24).toString('hex');
    res.cookie(SESSION_COOKIE, token, baseCookie(true));
    // Cookie CSRF sengaja dapat dibaca JavaScript (double-submit); tidak berisi rahasia sesi.
    res.cookie(CSRF_COOKIE, csrf, baseCookie(false));
    return csrf;
  }

  function endSession(res: Response): void {
    const { maxAge: _m, ...clear } = baseCookie(true);
    res.clearCookie(SESSION_COOKIE, clear);
    res.clearCookie(CSRF_COOKIE, { ...clear, httpOnly: false });
  }

  /** Memuat pengguna dari cookie sesi (jika ada) dan memeriksa CSRF untuk permintaan yang mengubah data. */
  const optionalAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
      if (!token) return next();
      let sub: string;
      try {
        const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
        sub = String((payload as jwt.JwtPayload).sub);
      } catch {
        return next(); // token kedaluwarsa/rusak: perlakukan sebagai anonim
      }
      const u = await row<{
        id: number;
        email: string;
        display_name: string;
        role: 'user' | 'admin';
        email_verified_at: string | null;
        premium_until: string | null;
        premium_active: number;
      }>(
        db,
        'SELECT id, email, display_name, role, email_verified_at, premium_until, (premium_until IS NOT NULL AND premium_until > UTC_TIMESTAMP()) AS premium_active FROM users WHERE id=?',
        [Number(sub)],
      );
      if (!u) return next();
      if (
        !SAFE_METHODS.has(req.method) &&
        !CSRF_EXEMPT.has(req.baseUrl + req.path) &&
        !(req.baseUrl + req.path).startsWith('/api/sprint/')
      ) {
        const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
        const header = req.get(CSRF_HEADER);
        if (!cookie || !header || !safeEqual(cookie, header)) {
          return next(new AppError(403, 'CSRF_INVALID', 'Token keamanan (CSRF) tidak valid. Muat ulang halaman lalu coba lagi.'));
        }
      }
      req.user = {
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        emailVerified: !!u.email_verified_at,
        premiumUntil: u.premium_until ? new Date(`${u.premium_until.replace(' ', 'T')}Z`).toISOString() : null,
        premium: u.role === 'admin' || !!Number(u.premium_active),
      };
      next();
    } catch (e) {
      next(e);
    }
  };

  const requireAuth: RequestHandler = (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.'));
    next();
  };

  /** Fitur premium (sertifikat PDF, kunci jawaban worksheet). */
  const requirePremium: RequestHandler = (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.'));
    if (!req.user.premium) return next(new AppError(402, 'PREMIUM_REQUIRED', 'Fitur ini khusus anggota Premium.'));
    next();
  };

  const requireAdmin: RequestHandler = (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.'));
    if (req.user.role !== 'admin') return next(new AppError(403, 'FORBIDDEN', 'Anda tidak memiliki izin untuk tindakan ini.'));
    next();
  };

  return { optionalAuth, requireAuth, requireAdmin, requirePremium, startSession, endSession };
}

export type Auth = ReturnType<typeof createAuth>;
