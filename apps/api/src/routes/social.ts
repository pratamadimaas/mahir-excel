import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { computeStreak, type ReviewDueItem } from '@excellab/shared';
import type { Ctx } from '../app';
import { row, rows, run } from '../db/pool';
import { buildCertificate } from '../lib/certificate';
import { AppError, notFound, parse } from '../middleware/errors';

const SHARE_TOKEN = /^[a-f0-9]{32}$/;
const CERT_CODE = /^[A-F0-9]{16}$/;
const scopeSchema = z.string().regex(/^(semua|[a-z0-9][a-z0-9-]{0,79})$/, 'Cakupan sertifikat tidak valid.');

const iso = (v: string): string => new Date(`${v.replace(' ', 'T')}Z`).toISOString();

/** Jadwal ulang, bagikan progres, dan sertifikat. */
export function socialRoutes({ db, config, auth }: Ctx): Router {
  const r = Router();

  // ---- ulang terjadwal ----
  r.get('/progress/review-due', auth.requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const due = await rows<{ slug: string; title: string; topic: string; box: number; due_at: string }>(
      db,
      `SELECT e.slug, e.title, e.topic, rs.box, rs.due_at
       FROM review_schedule rs JOIN exercises e ON e.id = rs.exercise_id
       WHERE rs.user_id = ? AND e.published = 1 AND rs.due_at <= UTC_TIMESTAMP() ORDER BY rs.due_at LIMIT 50`,
      [userId],
    );
    const upcoming = await row<{ n: number; next_due: string | null }>(
      db,
      `SELECT COUNT(*) AS n, MIN(rs.due_at) AS next_due FROM review_schedule rs JOIN exercises e ON e.id = rs.exercise_id
       WHERE rs.user_id = ? AND e.published = 1 AND rs.due_at > UTC_TIMESTAMP()`,
      [userId],
    );
    const items: ReviewDueItem[] = due.map((d) => ({ slug: d.slug, title: d.title, topic: d.topic, box: d.box, dueAt: iso(d.due_at) }));
    res.json({ data: { due: items, upcoming: Number(upcoming?.n ?? 0), nextDueAt: upcoming?.next_due ? iso(upcoming.next_due) : null } });
  });

  // ---- bagikan progres ----
  r.get('/progress/share', auth.requireAuth, async (req, res) => {
    const u = await row<{ share_token: string | null }>(db, 'SELECT share_token FROM users WHERE id = ?', [req.user!.id]);
    res.json({ data: { token: u?.share_token ?? null } });
  });

  r.post('/progress/share', auth.requireAuth, async (req, res) => {
    const token = crypto.randomBytes(16).toString('hex');
    // Pertahankan token yang ada agar tautan lama tetap berlaku; buat baru bila belum ada.
    await run(db, 'UPDATE users SET share_token = COALESCE(share_token, ?) WHERE id = ?', [token, req.user!.id]);
    const u = await row<{ share_token: string }>(db, 'SELECT share_token FROM users WHERE id = ?', [req.user!.id]);
    res.status(201).json({ data: { token: u!.share_token } });
  });

  r.delete('/progress/share', auth.requireAuth, async (req, res) => {
    await run(db, 'UPDATE users SET share_token = NULL WHERE id = ?', [req.user!.id]);
    res.json({ data: { token: null } });
  });

  // Publik: hanya nama tampilan dan ringkasan angka (tanpa email).
  r.get('/share/:token', async (req, res) => {
    const token = parse(z.string().regex(SHARE_TOKEN), req.params.token);
    const u = await row<{ id: number; display_name: string }>(db, 'SELECT id, display_name FROM users WHERE share_token = ?', [token]);
    if (!u) throw notFound('Tautan bagikan');
    const [lessons, exercises, points, days, modules] = await Promise.all([
      row<{ done: number; total: number }>(
        db,
        `SELECT (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.published = 1) AS done,
                (SELECT COUNT(*) FROM lessons WHERE published = 1) AS total`,
        [u.id],
      ),
      row<{ done: number; total: number }>(
        db,
        `SELECT (SELECT COUNT(*) FROM exercise_completions ec JOIN exercises e ON e.id = ec.exercise_id WHERE ec.user_id = ? AND e.published = 1) AS done,
                (SELECT COUNT(*) FROM exercises WHERE published = 1) AS total`,
        [u.id],
      ),
      row<{ s: number | null }>(db, 'SELECT SUM(points) AS s FROM exercise_completions WHERE user_id = ?', [u.id]),
      rows<{ day: string }>(db, 'SELECT day FROM learning_days WHERE user_id = ? ORDER BY day', [u.id]),
      rows<{ title: string; done: number; total: number }>(
        db,
        `SELECT m.title,
                (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.module_id = m.id AND l.published = 1) AS done,
                (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id AND l.published = 1) AS total
         FROM modules m WHERE m.published = 1 ORDER BY m.sort_order`,
        [u.id],
      ),
    ]);
    res.json({
      data: {
        displayName: u.display_name,
        totalPoints: Number(points?.s ?? 0),
        streak: computeStreak(days.map((d) => d.day)),
        lessons: { done: Number(lessons?.done ?? 0), total: Number(lessons?.total ?? 0) },
        exercises: { done: Number(exercises?.done ?? 0), total: Number(exercises?.total ?? 0) },
        modules: modules.map((m) => ({ title: m.title, done: Number(m.done), total: Number(m.total) })),
      },
    });
  });

  // ---- sertifikat ----
  async function eligibility(userId: number, scope: string): Promise<{ title: string; total: number; done: number }> {
    if (scope === 'semua') {
      const t = await row<{ total: number; done: number }>(
        db,
        `SELECT COUNT(*) AS total, SUM(lp.user_id IS NOT NULL) AS done
         FROM lessons l JOIN modules m ON m.id = l.module_id AND m.published = 1
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
         WHERE l.published = 1`,
        [userId],
      );
      return { title: 'seluruh materi Mahir Excel', total: Number(t?.total ?? 0), done: Number(t?.done ?? 0) };
    }
    const m = await row<{ id: number; title: string; sort_order: number }>(
      db,
      'SELECT id, title, sort_order FROM modules WHERE slug = ? AND published = 1',
      [scope],
    );
    if (!m) throw notFound('Modul');
    const t = await row<{ total: number; done: number }>(
      db,
      `SELECT COUNT(*) AS total, SUM(lp.user_id IS NOT NULL) AS done
       FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
       WHERE l.module_id = ? AND l.published = 1`,
      [userId, m.id],
    );
    return { title: `modul ${m.sort_order}: ${m.title}`, total: Number(t?.total ?? 0), done: Number(t?.done ?? 0) };
  }

  // Sertifikat PDF adalah fitur Premium; verifikasi publik lewat kode (di bawah) tetap gratis.
  r.get('/progress/certificate', auth.requireAuth, auth.requirePremium, async (req, res) => {
    const scope = parse(scopeSchema, req.query.scope);
    const user = req.user!;
    const e = await eligibility(user.id, scope);
    if (e.total === 0) throw notFound('Pelajaran untuk sertifikat');
    if (e.done < e.total) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Sertifikat tersedia setelah semua pelajaran selesai. Masih ada ${e.total - e.done} pelajaran lagi.`,
      );
    }
    await run(db, 'INSERT IGNORE INTO certificates (user_id, scope, code) VALUES (?,?,?)', [
      user.id,
      scope,
      crypto.randomBytes(8).toString('hex').toUpperCase(),
    ]);
    const cert = await row<{ code: string; issued_at: string }>(
      db,
      'SELECT code, issued_at FROM certificates WHERE user_id = ? AND scope = ?',
      [user.id, scope],
    );
    const base = config.webOrigins[0] ?? '';
    const doc = buildCertificate({
      name: user.displayName,
      scopeTitle: e.title,
      lessons: e.total,
      issuedAt: new Date(`${cert!.issued_at.replace(' ', 'T')}Z`),
      code: cert!.code,
      verifyUrl: `${base}/sertifikat/${cert!.code}`,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sertifikat-excellab-${scope}.pdf"`);
    doc.pipe(res);
  });

  // Publik: memeriksa keaslian sertifikat dari kodenya.
  r.get('/certificates/:code', async (req, res) => {
    const code = parse(z.string().toUpperCase().regex(CERT_CODE), req.params.code);
    const c = await row<{ scope: string; issued_at: string; display_name: string }>(
      db,
      'SELECT c.scope, c.issued_at, u.display_name FROM certificates c JOIN users u ON u.id = c.user_id WHERE c.code = ?',
      [code],
    );
    if (!c) throw notFound('Sertifikat');
    let title = 'seluruh materi Mahir Excel';
    if (c.scope !== 'semua') {
      const m = await row<{ title: string; sort_order: number }>(db, 'SELECT title, sort_order FROM modules WHERE slug = ?', [c.scope]);
      title = m ? `modul ${m.sort_order}: ${m.title}` : c.scope;
    }
    res.json({ data: { valid: true, name: c.display_name, scope: title, issuedAt: iso(c.issued_at), code } });
  });

  return r;
}
