import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  FUNCTION_COUNT,
  PUBLIC_LESSON_SLUGS,
  isFreeWorksheet,
  dailyIndex,
  isPublicLesson,
  jakartaDate,
  solutionCells,
  toPublicExercise,
  mergeSubmission,
  validateSubmission,
  type ExerciseDef,
} from '@excellab/shared';
import type { Ctx } from '../app';
import { row, rows, run, withTransaction } from '../db/pool';
import { AppError, notFound, parse } from '../middleware/errors';
import {
  EXERCISE_SELECT,
  asJson,
  exerciseSummary,
  rowToExercise,
  rowToShortcut,
  rowToWorksheet,
  type ExerciseRow,
  type ShortcutRow,
  type WorksheetRow,
} from '../lib/mappers';
import { touchLearningDay } from '../lib/progress';
import { recordReview } from '../lib/review';

const previewCache = new Map<string, { mtime: number; rows: string[][]; sheet: string }>();

/** Membaca beberapa baris pertama sheet latihan sebagai pratinjau (sel jawaban masih kosong). */
async function readPreview(file: string): Promise<{ sheet: string; rows: string[][] } | null> {
  try {
    const mtime = fs.statSync(file).mtimeMs;
    const hit = previewCache.get(file);
    if (hit && hit.mtime === mtime) return { sheet: hit.sheet, rows: hit.rows };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('Latihan') ?? wb.worksheets[1] ?? wb.worksheets[0];
    if (!ws) return null;
    const cols = Math.min(ws.columnCount, 9);
    const rowsOut: string[][] = [];
    for (let r = 1; r <= Math.min(ws.rowCount, 9); r++) {
      const line: string[] = [];
      for (let c = 1; c <= cols; c++) {
        const v = ws.getCell(r, c).value;
        if (v === null || v === undefined) line.push('');
        else if (v instanceof Date) line.push(v.toLocaleDateString('id-ID'));
        else if (typeof v === 'object')
          line.push('formula' in v ? String((v as { result?: unknown }).result ?? '') : String((v as { text?: string }).text ?? ''));
        else line.push(String(v));
      }
      rowsOut.push(line);
    }
    previewCache.set(file, { mtime, rows: rowsOut, sheet: ws.name });
    return { sheet: ws.name, rows: rowsOut };
  } catch {
    return null;
  }
}

const slugParam = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const DIFFICULTIES = ['mudah', 'sedang', 'sulit'] as const;

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const submitBody = z.object({
  cells: z.record(z.string().max(12), z.string().max(500)).refine((o) => Object.keys(o).length <= 200, 'Terlalu banyak sel.'),
});

export function contentRoutes({ db, config, auth }: Ctx): Router {
  const r = Router();
  // Seluruh materi belajar hanya untuk pengguna yang sudah masuk. Uji Kemampuan Excel, berbagi progres, dan verifikasi sertifikat tetap publik.
  // Pengecualian: beberapa pelajaran contoh (PUBLIC_LESSON_SLUGS) boleh dibaca tanpa login sebagai etalase.
  r.use(['/modules', '/lessons', '/exercises', '/shortcuts', '/worksheets', '/challenges'], (req, res, next) => {
    const pathname = req.originalUrl.split('?')[0] ?? '';
    const m = /^\/api\/lessons\/([^/]+)\/?$/.exec(pathname);
    if (req.method === 'GET' && m && isPublicLesson(decodeURIComponent(m[1]!))) return next();
    auth.requireAuth(req, res, next);
  });

  // Ringkasan kurikulum untuk beranda pengunjung: hanya judul dan angka, tanpa isi pelajaran.
  r.get('/public/overview', async (_req, res) => {
    const mods = await rows<{ slug: string; title: string; summary: string; lessons: number; exercises: number }>(
      db,
      `SELECT m.slug, m.title, m.summary,
         (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id AND l.published = 1) AS lessons,
         (SELECT COUNT(*) FROM exercises e JOIN lessons l ON l.id = e.lesson_id WHERE l.module_id = m.id AND l.published = 1 AND e.published = 1) AS exercises
       FROM modules m WHERE m.published = 1 ORDER BY m.sort_order`,
    );
    const count = async (table: string): Promise<number> =>
      Number((await row<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table} WHERE published = 1`))?.n ?? 0);
    const modules = mods.map((m) => ({
      slug: m.slug,
      title: m.title,
      summary: m.summary,
      lessons: Number(m.lessons),
      exercises: Number(m.exercises),
    }));
    res.json({
      data: {
        counts: {
          modules: modules.length,
          lessons: modules.reduce((n, m) => n + m.lessons, 0),
          exercises: await count('exercises'),
          shortcuts: await count('shortcuts'),
          worksheets: await count('worksheet_resources'),
          functions: FUNCTION_COUNT,
        },
        modules,
      },
    });
  });

  r.get('/public/lessons', async (_req, res) => {
    const list = await rows<{ slug: string; title: string; summary: string; minutes: number; module_title: string }>(
      db,
      `SELECT l.slug, l.title, l.summary, l.minutes, m.title AS module_title
       FROM lessons l JOIN modules m ON m.id = l.module_id
       WHERE l.published = 1 AND m.published = 1 AND l.slug IN (${PUBLIC_LESSON_SLUGS.map(() => '?').join(',')})
       ORDER BY m.sort_order, l.sort_order`,
      [...PUBLIC_LESSON_SLUGS],
    );
    res.json({
      data: list.map((l) => ({ slug: l.slug, title: l.title, summary: l.summary, minutes: l.minutes, moduleTitle: l.module_title })),
    });
  });

  const isPreview = (req: Request): boolean => req.user?.role === 'admin' && req.query.preview === '1';

  async function loadExercise(slug: string, preview: boolean): Promise<{ def: ExerciseDef; id: number }> {
    const rec = await row<ExerciseRow>(db, `${EXERCISE_SELECT} WHERE e.slug = ?${preview ? '' : ' AND e.published = 1'}`, [slug]);
    if (!rec) throw notFound('Latihan');
    return { def: rowToExercise(rec), id: rec.id };
  }

  r.get('/modules', async (_req, res) => {
    const mods = await rows<{ id: number; slug: string; title: string; summary: string; sort_order: number }>(
      db,
      'SELECT id, slug, title, summary, sort_order FROM modules WHERE published = 1 ORDER BY sort_order',
    );
    const lessons = await rows<{
      module_id: number;
      slug: string;
      title: string;
      summary: string;
      minutes: number;
      sort_order: number;
      exercise_count: number;
    }>(
      db,
      `SELECT l.module_id, l.slug, l.title, l.summary, l.minutes, l.sort_order,
         (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id AND e.published = 1) AS exercise_count
       FROM lessons l WHERE l.published = 1 ORDER BY l.sort_order`,
    );
    res.json({
      data: mods.map((m) => ({
        slug: m.slug,
        title: m.title,
        summary: m.summary,
        sortOrder: m.sort_order,
        lessons: lessons
          .filter((l) => l.module_id === m.id)
          .map((l) => ({
            slug: l.slug,
            title: l.title,
            summary: l.summary,
            minutes: l.minutes,
            sortOrder: l.sort_order,
            exerciseCount: Number(l.exercise_count),
          })),
      })),
    });
  });

  r.get('/modules/:slug', async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const m = await row<{ id: number; slug: string; title: string; summary: string; sort_order: number }>(
      db,
      'SELECT id, slug, title, summary, sort_order FROM modules WHERE slug = ? AND published = 1',
      [slug],
    );
    if (!m) throw notFound('Modul');
    const lessons = await rows<{ slug: string; title: string; summary: string; minutes: number; sort_order: number }>(
      db,
      'SELECT slug, title, summary, minutes, sort_order FROM lessons WHERE module_id = ? AND published = 1 ORDER BY sort_order',
      [m.id],
    );
    res.json({
      data: {
        slug: m.slug,
        title: m.title,
        summary: m.summary,
        sortOrder: m.sort_order,
        lessons: lessons.map((l) => ({ ...l, sortOrder: l.sort_order })),
      },
    });
  });

  r.get('/lessons/:slug', async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const preview = isPreview(req);
    const l = await row<{
      id: number;
      module_id: number;
      slug: string;
      title: string;
      summary: string;
      minutes: number;
      content: unknown;
      published: number;
    }>(
      db,
      `SELECT id, module_id, slug, title, summary, minutes, content, published FROM lessons WHERE slug = ?${preview ? '' : ' AND published = 1'}`,
      [slug],
    );
    if (!l) throw notFound('Pelajaran');
    const mod = await row<{ slug: string; title: string }>(db, 'SELECT slug, title FROM modules WHERE id = ?', [l.module_id]);
    // Urutan global: modul lalu pelajaran, hanya yang terbit.
    const order = await rows<{ slug: string; title: string }>(
      db,
      `SELECT l.slug, l.title FROM lessons l JOIN modules m ON m.id = l.module_id
       WHERE l.published = 1 AND m.published = 1 ORDER BY m.sort_order, l.sort_order`,
    );
    const idx = order.findIndex((o) => o.slug === l.slug);
    const exs = await rows<ExerciseRow>(
      db,
      `${EXERCISE_SELECT} WHERE e.lesson_id = ?${preview ? '' : ' AND e.published = 1'} ORDER BY e.sort_order`,
      [l.id],
    );
    res.json({
      data: {
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        minutes: l.minutes,
        published: !!l.published,
        module: mod,
        siblings: await rows<{ slug: string; title: string }>(
          db,
          'SELECT slug, title FROM lessons WHERE module_id = ? AND published = 1 ORDER BY sort_order',
          [l.module_id],
        ),
        content: asJson(l.content),
        prev: idx > 0 ? order[idx - 1] : null,
        next: idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null,
        exercises: exs.map((e) => exerciseSummary(rowToExercise(e))),
      },
    });
  });

  r.get('/exercises', async (req, res) => {
    const q = parse(
      pageQuery.extend({
        topic: slugParam.optional(),
        difficulty: z.enum(DIFFICULTIES).optional(),
        lesson: slugParam.optional(),
      }),
      req.query,
    );
    const where: string[] = ['e.published = 1'];
    const params: unknown[] = [];
    if (q.topic) {
      where.push('e.topic = ?');
      params.push(q.topic);
    }
    if (q.difficulty) {
      where.push('e.difficulty = ?');
      params.push(q.difficulty);
    }
    if (q.lesson) {
      where.push('l.slug = ?');
      params.push(q.lesson);
    }
    const clause = where.join(' AND ');
    const total = await row<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM exercises e LEFT JOIN lessons l ON l.id = e.lesson_id WHERE ${clause}`,
      params,
    );
    const limit = Math.trunc(q.pageSize);
    const offset = Math.trunc((q.page - 1) * q.pageSize);
    const list = await rows<ExerciseRow>(
      db,
      `${EXERCISE_SELECT} WHERE ${clause} ORDER BY e.sort_order LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    res.json({
      data: list.map((e) => exerciseSummary(rowToExercise(e))),
      meta: { page: q.page, pageSize: q.pageSize, total: Number(total?.n ?? 0) },
    });
  });

  r.get('/exercises/:slug', async (req, res) => {
    const { def } = await loadExercise(parse(slugParam, req.params.slug), isPreview(req));
    res.json({ data: toPublicExercise(def) });
  });

  r.post('/exercises/:slug/submit', async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const body = parse(submitBody, req.body);
    const { def, id } = await loadExercise(slug, isPreview(req));
    const result = validateSubmission(def, body.cells);

    let pointsAwarded = 0;
    let alreadyCompleted = false;
    let totalPoints: number | undefined;
    const user = req.user;
    if (user) {
      const merged = mergeSubmission(def, body.cells);
      const submitted = Object.fromEntries(Object.entries(merged).filter(([k]) => k in body.cells));
      await withTransaction(db, async (conn) => {
        await run(conn, 'INSERT INTO exercise_attempts (user_id, exercise_id, correct, message, submitted) VALUES (?,?,?,?,?)', [
          user.id,
          id,
          result.correct ? 1 : 0,
          result.message.slice(0, 500),
          JSON.stringify(submitted),
        ]);
        await touchLearningDay(conn, user.id, jakartaDate());
        await recordReview(conn, user.id, id, result.correct);
        if (result.correct) {
          const [{ n }] = (await rows<{ n: number }>(
            conn,
            'SELECT COUNT(*) AS n FROM exercise_attempts WHERE user_id=? AND exercise_id=?',
            [user.id, id],
          )) as [{ n: number }];
          // Kunci utama (user_id, exercise_id) memastikan poin hanya diberikan sekali walau ada submit ganda.
          const ins = await run(conn, 'INSERT IGNORE INTO exercise_completions (user_id, exercise_id, points, attempts) VALUES (?,?,?,?)', [
            user.id,
            id,
            def.points,
            Number(n),
          ]);
          if (ins.affectedRows === 1) pointsAwarded = def.points;
          else alreadyCompleted = true;
          await run(conn, 'DELETE FROM review_items WHERE user_id=? AND exercise_id=?', [user.id, id]);
        } else {
          const msg = (result.targets.find((t) => !t.ok)?.message ?? result.message).slice(0, 500);
          await run(
            conn,
            'INSERT INTO review_items (user_id, exercise_id, message) VALUES (?,?,?) ON DUPLICATE KEY UPDATE message=VALUES(message), created_at=CURRENT_TIMESTAMP',
            [user.id, id, msg],
          );
        }
        const sum = await row<{ s: number | null }>(conn, 'SELECT SUM(points) AS s FROM exercise_completions WHERE user_id=?', [user.id]);
        totalPoints = Number(sum?.s ?? 0);
      });
    }

    res.json({
      data: {
        ...result,
        pointsAwarded,
        alreadyCompleted,
        ...(totalPoints === undefined ? {} : { totalPoints }),
        // Penjelasan dan solusi hanya dibuka setelah jawaban benar.
        ...(result.correct ? { explanation: def.explanation, solution: solutionCells(def) } : {}),
      },
    });
  });

  // Solusi langsung: Premium kapan saja. Akun gratis mendapat cicipan: satu solusi setiap 7 hari.
  // Membuka lagi solusi yang pernah dibuka tidak memakai jatah. Petunjuk bertahap selalu gratis.
  const FREE_SOLUTION_MS = 7 * 86_400_000;

  async function solutionQuota(userId: number): Promise<{ available: boolean; nextFreeAt: string | null; unlocked: string[] }> {
    const used = await rows<{ slug: string; unlocked_at: string }>(
      db,
      `SELECT e.slug, su.unlocked_at FROM solution_unlocks su JOIN exercises e ON e.id = su.exercise_id
       WHERE su.user_id = ? ORDER BY su.unlocked_at DESC`,
      [userId],
    );
    const lastMs = used[0] ? new Date(`${used[0].unlocked_at.replace(' ', 'T')}Z`).getTime() : null;
    const blocked = lastMs !== null && lastMs + FREE_SOLUTION_MS > Date.now();
    return {
      available: !blocked,
      nextFreeAt: blocked && lastMs !== null ? new Date(lastMs + FREE_SOLUTION_MS).toISOString() : null,
      unlocked: used.map((u) => u.slug),
    };
  }

  r.get('/solution-quota', auth.requireAuth, async (req, res) => {
    const user = req.user!;
    if (user.premium) {
      res.json({ data: { premium: true, available: true, nextFreeAt: null, unlocked: [] } });
      return;
    }
    res.json({ data: { premium: false, ...(await solutionQuota(user.id)) } });
  });

  // Menyerah/lihat solusi: tidak memberi poin dan tidak menandai latihan selesai.
  r.post('/exercises/:slug/reveal', async (req, res) => {
    const { def, id } = await loadExercise(parse(slugParam, req.params.slug), isPreview(req));
    const user = req.user!;
    let free = false;
    let nextFreeAt: string | null = null;
    if (!user.premium) {
      free = true;
      // Kunci baris pengguna supaya permintaan paralel tidak melewati batas satu solusi per minggu.
      nextFreeAt = await withTransaction(db, async (conn) => {
        await row(conn, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);
        const already = await row<{ x: number }>(conn, 'SELECT 1 AS x FROM solution_unlocks WHERE user_id = ? AND exercise_id = ?', [user.id, id]);
        const last = await row<{ unlocked_at: string }>(conn, 'SELECT MAX(unlocked_at) AS unlocked_at FROM solution_unlocks WHERE user_id = ?', [user.id]);
        const lastMs = last?.unlocked_at ? new Date(`${last.unlocked_at.replace(' ', 'T')}Z`).getTime() : null;
        const blocked = lastMs !== null && lastMs + FREE_SOLUTION_MS > Date.now();
        if (already) return blocked && lastMs !== null ? new Date(lastMs + FREE_SOLUTION_MS).toISOString() : null;
        if (blocked && lastMs !== null) {
          throw new AppError(402, 'PREMIUM_REQUIRED', 'Jatah solusi gratis minggu ini sudah terpakai.', {
            nextFreeAt: new Date(lastMs + FREE_SOLUTION_MS).toISOString(),
          });
        }
        await run(conn, 'INSERT INTO solution_unlocks (user_id, exercise_id) VALUES (?,?)', [user.id, id]);
        // Tanggal jatah berikutnya dihitung dari waktu yang tersimpan di database, sama dengan /solution-quota.
        const saved = await row<{ unlocked_at: string }>(conn, 'SELECT unlocked_at FROM solution_unlocks WHERE user_id = ? AND exercise_id = ?', [user.id, id]);
        return new Date(new Date(`${saved!.unlocked_at.replace(' ', 'T')}Z`).getTime() + FREE_SOLUTION_MS).toISOString();
      });
    }
    res.json({ data: { explanation: def.explanation, solution: solutionCells(def), pointsAwarded: 0, free, nextFreeAt } });
  });

  // Laporan soal dari pengguna. Satu laporan terbuka per pengguna dan latihan, dan paling banyak 10 laporan sehari.
  const reportBody = z.object({
    reason: z.enum(['tidak-jelas', 'jawaban-meragukan', 'salah-ketik', 'lainnya']),
    note: z.string().trim().max(500).optional(),
  });

  r.post('/exercises/:slug/report', async (req, res) => {
    const body = parse(reportBody, req.body);
    const { id } = await loadExercise(parse(slugParam, req.params.slug), false);
    const userId = req.user!.id;
    const open = await row<{ id: number }>(db, 'SELECT id FROM exercise_reports WHERE user_id = ? AND exercise_id = ? AND resolved_at IS NULL', [userId, id]);
    if (open) {
      res.json({ data: { id: open.id, duplicate: true } });
      return;
    }
    const today = await row<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM exercise_reports WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)', [userId]);
    if (Number(today?.n ?? 0) >= 10) throw new AppError(429, 'RATE_LIMITED', 'Terlalu banyak laporan hari ini. Coba lagi besok.');
    const ins = await run(db, 'INSERT INTO exercise_reports (user_id, exercise_id, reason, note) VALUES (?,?,?,?)', [
      userId,
      id,
      body.reason,
      body.note ? body.note : null,
    ]);
    res.status(201).json({ data: { id: ins.insertId, duplicate: false } });
  });

  r.get('/shortcuts', async (req, res) => {
    const q = parse(
      pageQuery
        .extend({
          category: z.enum(['navigasi', 'edit-sel', 'format', 'seleksi', 'data', 'rumus', 'lembar-kerja']).optional(),
          platform: z.enum(['windows', 'mac']).optional(),
          q: z.string().trim().max(80).optional(),
        })
        .partial({ page: true, pageSize: true }),
      req.query,
    );
    const where = ['published = 1'];
    const params: unknown[] = [];
    if (q.category) {
      where.push('category = ?');
      params.push(q.category);
    }
    if (q.platform === 'windows') where.push('keys_windows IS NOT NULL');
    if (q.platform === 'mac') where.push('keys_mac IS NOT NULL');
    if (q.q) {
      const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(action LIKE ? OR keys_windows LIKE ? OR keys_mac LIKE ? OR explanation LIKE ?)');
      params.push(like, like, like, like);
    }
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 200;
    const clause = where.join(' AND ');
    const total = await row<{ n: number }>(db, `SELECT COUNT(*) AS n FROM shortcuts WHERE ${clause}`, params);
    const list = await rows<ShortcutRow>(
      db,
      `SELECT * FROM shortcuts WHERE ${clause} ORDER BY FIELD(category,'navigasi','edit-sel','format','seleksi','data','rumus','lembar-kerja'), id LIMIT ${Math.trunc(pageSize)} OFFSET ${Math.trunc((page - 1) * pageSize)}`,
      params,
    );
    res.json({ data: list.map(rowToShortcut), meta: { page, pageSize, total: Number(total?.n ?? 0) } });
  });

  const fileInfo = (name: string | null): { available: boolean; size: number | null } => {
    if (!name || !/^[a-z0-9][a-z0-9-]*\.xlsx$/.test(name)) return { available: false, size: null };
    const p = path.resolve(config.worksheetDir, name);
    if (!p.startsWith(path.resolve(config.worksheetDir) + path.sep)) return { available: false, size: null };
    try {
      return { available: true, size: fs.statSync(p).size };
    } catch {
      return { available: false, size: null };
    }
  };

  const worksheetView = (w: WorksheetRow) => {
    const v = rowToWorksheet(w);
    const f = fileInfo(v.fileName);
    const k = fileInfo(v.keyFileName);
    return {
      slug: v.slug,
      title: v.title,
      description: v.description,
      objective: v.objective,
      difficulty: v.difficulty,
      skills: v.skills,
      instructions: v.instructions,
      premiumOnly: !isFreeWorksheet(v.slug),
      fileType: 'xlsx',
      fileSize: f.size,
      available: f.available,
      keyAvailable: k.available,
      keySize: k.size,
    };
  };

  r.get('/worksheets', async (_req, res) => {
    const list = await rows<WorksheetRow>(db, 'SELECT * FROM worksheet_resources WHERE published = 1 ORDER BY sort_order');
    res.json({ data: list.map(worksheetView) });
  });

  r.get('/worksheets/:slug', async (req, res) => {
    const w = await row<WorksheetRow>(db, 'SELECT * FROM worksheet_resources WHERE slug = ? AND published = 1', [
      parse(slugParam, req.params.slug),
    ]);
    if (!w) throw notFound('Worksheet');
    const view = worksheetView(w);
    const preview = view.available ? await readPreview(path.resolve(config.worksheetDir, w.file_name)) : null;
    res.json({ data: { ...view, preview } });
  });

  r.get('/worksheets/:slug/download', async (req, res) => {
    const w = await row<WorksheetRow>(db, 'SELECT * FROM worksheet_resources WHERE slug = ? AND published = 1', [
      parse(slugParam, req.params.slug),
    ]);
    if (!w) throw notFound('Worksheet');
    const wantKey = req.query.answer === '1';
    if (wantKey && !req.user?.premium) throw new AppError(402, 'PREMIUM_REQUIRED', 'Kunci jawaban worksheet khusus anggota Premium.');
    if (!isFreeWorksheet(w.slug) && !req.user?.premium) {
      throw new AppError(402, 'PREMIUM_REQUIRED', 'Worksheet ini khusus anggota Premium.');
    }
    const name = wantKey ? w.key_file_name : w.file_name;
    const info = fileInfo(name);
    if (!name || !info.available) throw new AppError(404, 'NOT_FOUND', 'File worksheet belum tersedia di server.');
    res.download(path.resolve(config.worksheetDir, name), name);
  });

  r.get('/challenges/today', async (_req, res) => {
    const list = await rows<ExerciseRow>(db, `${EXERCISE_SELECT} WHERE e.published = 1 ORDER BY e.sort_order, e.id`);
    if (list.length === 0) throw notFound('Tantangan');
    const date = jakartaDate();
    const picked = rowToExercise(list[dailyIndex(list.length, date)]!);
    res.json({ data: { date, exercise: toPublicExercise(picked) } });
  });

  return r;
}
