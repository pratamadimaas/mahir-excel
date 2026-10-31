import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { jakartaDate, pathBySlug } from '@excellab/shared';
import type { Ctx } from '../app';
import { row, run, type Queryable } from '../db/pool';
import { errorBody, parse } from '../middleware/errors';

const SECTIONS = new Set([
  'belajar',
  'latihan',
  'shortcut',
  'worksheet',
  'template',
  'jalur',
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
  'data-latihan',
]);
const DETAIL_TABLE: Record<string, string> = { belajar: 'lessons', latihan: 'exercises', worksheet: 'worksheet_resources' };

/** Nama sumber kunjungan yang ramah dibaca dari asal tautan (host) atau parameter utm_source. */
export function sourceLabel(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/^www\./, '');
  if (!s || s === 'langsung') return 'Langsung';
  const known: [RegExp, string][] = [
    [/(^|\.)threads\.(net|com)$|^threads$/, 'Threads'],
    [/instagram\.com$|^instagram$|^ig$/, 'Instagram'],
    [/tiktok\.com$|^tiktok$/, 'TikTok'],
    [/google\.[a-z.]+$|^google$/, 'Google'],
    [/facebook\.com$|(^|\.)fb\.com$|^facebook$/, 'Facebook'],
    [/(^|\.)t\.co$|twitter\.com$|(^|\.)x\.com$|^twitter$/, 'X'],
    [/youtube\.com$|youtu\.be$|^youtube$/, 'YouTube'],
    [/whatsapp\.com$|(^|\.)wa\.me$|^whatsapp$|^wa$/, 'WhatsApp'],
    [/linkedin\.com$|lnkd\.in$|^linkedin$/, 'LinkedIn'],
    [/bing\.com$/, 'Bing'],
    [/duckduckgo\.com$/, 'DuckDuckGo'],
  ];
  for (const [re, name] of known) if (re.test(s)) return name;
  return s.slice(0, 60);
}

/** Mencatat alamat yang tidak ada (404), dibatasi jumlah alamat berbeda per hari supaya pemindai bot tidak memenuhi tabel. */
export async function countNotFound(db: Queryable, path: string): Promise<void> {
  const clean = path.replace(/[^A-Za-z0-9\-_./]/g, '').slice(0, 100) || '/';
  const day = jakartaDate();
  const seen = await row<{ n: number }>(db, "SELECT COUNT(*) AS n FROM daily_stats WHERE day = ? AND metric = 'notfound'", [day]);
  const exists = await row<{ n: number }>(db, "SELECT COUNT(*) AS n FROM daily_stats WHERE day = ? AND metric = 'notfound' AND item = ?", [day, clean]);
  if (Number(seen?.n ?? 0) >= 200 && Number(exists?.n ?? 0) === 0) return;
  await bump(db, day, 'notfound', clean);
}

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
    if (section === 'jalur') return parts.length === 2 && pathBySlug(parts[1]!) ? `/jalur/${parts[1]}` : parts.length === 2 ? '/jalur/(tidak-ada)' : '/jalur';
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
    const { path, src } = parse(
      z.object({
        path: z
          .string()
          .max(120)
          .regex(/^\/[A-Za-z0-9\-_/]*$/),
        // Asal kunjungan pertama dalam satu sesi tab: host pengarah atau utm_source, atau "langsung".
        src: z
          .string()
          .max(60)
          .regex(/^[A-Za-z0-9.\-_]+$/)
          .optional(),
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
    if (inserted.affectedRows === 1) {
      await bump(db, day, 'visitor', 'all');
      // Sumber hanya dihitung pada kunjungan pertama pengunjung itu hari ini, sehingga angkanya sebanding dengan pengunjung.
      if (src) await bump(db, day, 'source', sourceLabel(src));
    }
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
