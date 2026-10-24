import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { jakartaDate } from '@excellab/shared';
import type { Ctx } from '../app';
import { row, run, type Queryable } from '../db/pool';
import { errorBody, parse } from '../middleware/errors';

const SECTIONS = new Set([
  'belajar',
  'latihan',
  'shortcut',
  'worksheet',
  'template',
  'wizard',
  'laporan',
  'tantangan',
  'kemajuan',
  'masuk',
  'daftar',
  'profil',
  'tentang',
  'privasi',
  'lupa-sandi',
  'tes-penempatan',
  'bagikan',
  'sertifikat',
  'sprint',
]);
const DETAIL_TABLE: Record<string, string> = { belajar: 'lessons', latihan: 'exercises', worksheet: 'worksheet_resources' };

export async function bump(db: Queryable, day: string, metric: string, item: string, by = 1): Promise<void> {
  await run(
    db,
    'INSERT INTO daily_stats (day, metric, item, total) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE total = total + VALUES(total)',
    [day, metric, item.slice(0, 100), by],
  );
}

/**
 * Pencatatan kunjungan yang ramah privasi, tanpa cookie dan tanpa menyimpan IP:
 * - hanya hitungan harian per halaman (rute dinormalisasi, slug harus ada di database),
 * - pengunjung unik per hari dihitung dari hash(garam harian acak + IP + User-Agent); garam dan hash dihapus setelah 2 hari,
 * - menghormati sinyal Do Not Track dan Global Privacy Control.
 */
export function trackRoutes({ db, config }: Ctx): Router {
  const r = Router();
  const saltCache = new Map<string, string>();

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.rateLimitEnabled,
    handler: (_req, res) => {
      res.status(429).json(errorBody('RATE_LIMITED', 'Terlalu banyak permintaan.'));
    },
  });

  async function dailySalt(day: string): Promise<string> {
    const cached = saltCache.get(day);
    if (cached) return cached;
    await run(db, 'INSERT IGNORE INTO analytics_salts (day, salt) VALUES (?, ?)', [day, crypto.randomBytes(16).toString('hex')]);
    const rec = await row<{ salt: string }>(db, 'SELECT salt FROM analytics_salts WHERE day = ?', [day]);
    const salt = rec!.salt;
    saltCache.set(day, salt);
    if (saltCache.size > 3) saltCache.delete(saltCache.keys().next().value as string);
    return salt;
  }

  async function normalize(path: string): Promise<string | null> {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '/';
    const section = parts[0]!;
    if (section === 'admin') return null; // area admin tidak dicatat
    if (!SECTIONS.has(section)) return '/(lain)';
    if (parts.length === 1) return `/${section}`;
    const table = DETAIL_TABLE[section];
    if (!table || parts.length > 2) return `/${section}`;
    const slug = parts[1]!;
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) return `/${section}/(tidak-ada)`;
    const found = await row<{ id: number }>(db, `SELECT id FROM ${table} WHERE slug = ?`, [slug]);
    return found ? `/${section}/${slug}` : `/${section}/(tidak-ada)`;
  }

  r.post('/track', limiter, async (req, res) => {
    if (req.get('dnt') === '1' || req.get('sec-gpc') === '1') {
      res.status(202).json({ data: { counted: false } });
      return;
    }
    const { path } = parse(
      z.object({
        path: z
          .string()
          .max(120)
          .regex(/^\/[A-Za-z0-9\-_/]*$/),
      }),
      req.body,
    );
    const route = await normalize(path);
    if (!route) {
      res.status(202).json({ data: { counted: false } });
      return;
    }
    const day = jakartaDate();
    const salt = await dailySalt(day);
    const hash = crypto
      .createHash('sha256')
      .update(`${salt}|${req.ip ?? ''}|${req.get('user-agent') ?? ''}`)
      .digest('hex')
      .slice(0, 32);
    const inserted = await run(db, 'INSERT IGNORE INTO visitor_hashes (day, hash) VALUES (?, ?)', [day, hash]);
    if (inserted.affectedRows === 1) await bump(db, day, 'visitor', 'all');
    await bump(db, day, 'pageview', route);

    // Pembersihan berkala: hapus hash/garam lama supaya pengunjung tidak dapat dilacak antar hari.
    if (Math.random() < 0.02) {
      await run(db, 'DELETE FROM visitor_hashes WHERE day < (UTC_DATE() - INTERVAL 2 DAY)');
      await run(db, 'DELETE FROM analytics_salts WHERE day < (UTC_DATE() - INTERVAL 2 DAY)');
    }
    res.status(202).json({ data: { counted: true } });
  });

  return r;
}
