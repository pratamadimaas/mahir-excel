import { Router } from 'express';
import { z } from 'zod';
import { jakartaDate } from '@excellab/shared';
import type { Ctx } from '../app';
import { row, rows, run, withTransaction } from '../db/pool';
import { notFound, parse } from '../middleware/errors';
import { buildProgressView, touchLearningDay } from '../lib/progress';
import { buildReport } from '../lib/report';
import { bump } from './track';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const snapshotBody = z.object({
  snapshot: z.object({
    version: z.literal(1).optional(),
    completedLessons: z.array(slug).max(200).default([]),
    exercises: z
      .record(slug, z.object({ completedAt: z.string().max(40).optional(), attempts: z.number().int().min(1).max(100_000).optional() }))
      .default({}),
    reviews: z.record(slug, z.object({ at: z.string().max(40).optional(), message: z.string().max(500) })).default({}),
    activeDays: z.array(day).max(400).default([]),
    schedule: z.record(slug, z.object({ box: z.number().int().min(0).max(5), dueAt: z.string().max(40) })).default({}),
  }),
});

const putBody = z.object({ lessonSlug: slug, completed: z.boolean() });

const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(',');

function dayNumber(d: string): number {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, dd) / 86_400_000);
}

export function progressRoutes({ db, auth }: Ctx): Router {
  const r = Router();
  r.use(auth.requireAuth);

  r.get('/', async (req, res) => {
    res.json({ data: await buildProgressView(db, req.user!.id) });
  });

  // Laporan kemajuan pribadi (Premium): topik terlemah dan rekomendasi latihan dari data yang sudah ada.
  r.get('/report', auth.requirePremium, async (req, res) => {
    bump(db, jakartaDate(), 'feature', 'laporan-kemajuan').catch(() => undefined);
    res.json({ data: await buildReport(db, req.user!.id) });
  });

  // Menandai atau membatalkan penyelesaian pelajaran. Idempoten.
  r.put('/', async (req, res) => {
    const body = parse(putBody, req.body);
    const userId = req.user!.id;
    const lesson = await row<{ id: number }>(db, 'SELECT id FROM lessons WHERE slug = ? AND published = 1', [body.lessonSlug]);
    if (!lesson) throw notFound('Pelajaran');
    if (body.completed) {
      await run(db, 'INSERT IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?,?)', [userId, lesson.id]);
      await touchLearningDay(db, userId, jakartaDate());
    } else {
      await run(db, 'DELETE FROM lesson_progress WHERE user_id=? AND lesson_id=?', [userId, lesson.id]);
    }
    res.json({ data: await buildProgressView(db, userId) });
  });

  /**
   * Menggabungkan progres lokal (anonim) ke akun. Aturan:
   * - hanya slug yang ada di server yang diterima; sisanya dilewati,
   * - poin SELALU dihitung dari definisi latihan di server (nilai poin dari klien diabaikan),
   * - latihan yang sudah selesai di server tidak diberi poin lagi (idempoten),
   * - setelah sinkronisasi, respons berisi progres dari server sebagai sumber kebenaran.
   */
  r.post('/sync', async (req, res) => {
    const { snapshot } = parse(snapshotBody, req.body);
    const userId = req.user!.id;
    const today = jakartaDate();
    const todayN = dayNumber(today);
    const imported = { lessons: 0, exercises: 0, pointsAdded: 0, skipped: 0 };

    await withTransaction(db, async (conn) => {
      const lessonSlugs = [...new Set(snapshot.completedLessons)];
      if (lessonSlugs.length) {
        const found = await rows<{ id: number; slug: string }>(
          conn,
          `SELECT id, slug FROM lessons WHERE published = 1 AND slug IN (${placeholders(lessonSlugs.length)})`,
          lessonSlugs,
        );
        imported.skipped += lessonSlugs.length - found.length;
        for (const l of found) {
          const ins = await run(conn, 'INSERT IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?,?)', [userId, l.id]);
          imported.lessons += ins.affectedRows;
        }
      }

      const exSlugs = Object.keys(snapshot.exercises);
      if (exSlugs.length) {
        const found = await rows<{ id: number; slug: string; points: number }>(
          conn,
          `SELECT id, slug, points FROM exercises WHERE published = 1 AND slug IN (${placeholders(exSlugs.length)})`,
          exSlugs,
        );
        imported.skipped += exSlugs.length - found.length;
        for (const e of found) {
          const claim = snapshot.exercises[e.slug]!;
          let when = new Date();
          if (claim.completedAt) {
            const parsed = new Date(claim.completedAt);
            if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now() && parsed.getFullYear() >= 2020) when = parsed;
          }
          const ins = await run(
            conn,
            'INSERT IGNORE INTO exercise_completions (user_id, exercise_id, points, attempts, completed_at) VALUES (?,?,?,?,?)',
            [userId, e.id, e.points, claim.attempts ?? 1, when.toISOString().slice(0, 19).replace('T', ' ')],
          );
          if (ins.affectedRows === 1) {
            imported.exercises++;
            imported.pointsAdded += e.points;
            await run(conn, 'DELETE FROM review_items WHERE user_id=? AND exercise_id=?', [userId, e.id]);
          }
        }
      }

      const reviewSlugs = Object.keys(snapshot.reviews);
      if (reviewSlugs.length) {
        const found = await rows<{ id: number; slug: string }>(
          conn,
          `SELECT id, slug FROM exercises WHERE published = 1 AND slug IN (${placeholders(reviewSlugs.length)})`,
          reviewSlugs,
        );
        for (const e of found) {
          // Jangan mengisi tinjauan untuk latihan yang sudah selesai.
          await run(
            conn,
            `INSERT IGNORE INTO review_items (user_id, exercise_id, message)
             SELECT ?, ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM exercise_completions WHERE user_id=? AND exercise_id=?)`,
            [userId, e.id, snapshot.reviews[e.slug]!.message, userId, e.id],
          );
        }
      }

      const scheduleSlugs = Object.keys(snapshot.schedule);
      if (scheduleSlugs.length) {
        const found = await rows<{ id: number; slug: string }>(
          conn,
          `SELECT id, slug FROM exercises WHERE published = 1 AND slug IN (${placeholders(scheduleSlugs.length)})`,
          scheduleSlugs,
        );
        for (const e of found) {
          const s = snapshot.schedule[e.slug]!;
          const due = new Date(s.dueAt);
          const now = Date.now();
          // Hanya jadwal yang masuk akal (dalam setahun ke depan atau ke belakang); selebihnya jatuh tempo sekarang.
          const when =
            !Number.isNaN(due.getTime()) && due.getTime() > now - 366 * 86_400_000 && due.getTime() < now + 366 * 86_400_000
              ? due
              : new Date(now);
          await run(conn, 'INSERT IGNORE INTO review_schedule (user_id, exercise_id, box, due_at) VALUES (?,?,?,?)', [
            userId,
            e.id,
            s.box,
            when.toISOString().slice(0, 19).replace('T', ' '),
          ]);
        }
      }

      for (const d of new Set(snapshot.activeDays)) {
        const n = dayNumber(d);
        const valid = Number.isFinite(n) && n <= todayN && n >= todayN - 400 && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
        if (valid) await touchLearningDay(conn, userId, d);
      }
    });

    res.json({ data: { progress: await buildProgressView(db, userId), imported } });
  });

  r.get('/review', async (req, res) => {
    const list = await rows<{ slug: string; title: string; topic: string; message: string; created_at: string }>(
      db,
      `SELECT e.slug, e.title, e.topic, ri.message, ri.created_at
       FROM review_items ri JOIN exercises e ON e.id = ri.exercise_id
       WHERE ri.user_id = ? AND e.published = 1 ORDER BY ri.created_at DESC`,
      [req.user!.id],
    );
    res.json({
      data: list.map((x) => ({
        slug: x.slug,
        title: x.title,
        topic: x.topic,
        message: x.message,
        at: new Date(`${x.created_at.replace(' ', 'T')}Z`).toISOString(),
      })),
    });
  });

  return r;
}
