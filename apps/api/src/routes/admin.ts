import { isDeepStrictEqual } from 'node:util';
import { Router, type Response } from 'express';
import { z, type ZodType } from 'zod';
import {
  evaluatePlacement,
  jakartaDate,
  lessons as bundledLessons,
  placementQuestions,
  solutionCells,
  validateSubmission,
  type ExerciseDef,
  type LessonContent,
  type PlacementLevel,
} from '@excellab/shared';
import type { Ctx } from '../app';
import { datasetCatalog } from '../datasets';
import { row, rows, run, type Db } from '../db/pool';
import { AppError, notFound, parse } from '../middleware/errors';
import {
  EXERCISE_SELECT,
  asJson,
  rowToExercise,
  rowToShortcut,
  rowToWorksheet,
  type ExerciseRow,
  type ShortcutRow,
  type WorksheetRow,
} from '../lib/mappers';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/, 'Slug hanya huruf kecil, angka, dan tanda hubung.');
const difficulty = z.enum(['mudah', 'sedang', 'sulit']);
const text = (max: number) => z.string().trim().min(1).max(max);
const refPattern = /^[A-Za-z]{1,2}\d{1,3}(:[A-Za-z]{1,2}\d{1,3})?$/;
const toolRange = /^[A-Za-z]{1,2}\d{1,3}:[A-Za-z]{1,2}\d{1,3}$/;
const fileName = z.string().regex(/^[a-z0-9][a-z0-9-]*\.xlsx$/, 'Nama file harus huruf kecil/angka/tanda hubung dan berakhiran .xlsx.');

const lessonContent = z.object({
  guide: z.boolean().optional(),
  objectives: z.array(text(300)).min(1),
  sections: z.array(z.object({ heading: text(160), paragraphs: z.array(text(2000)).min(1) })).min(1),
  syntax: z
    .object({
      signature: text(300),
      params: z.array(z.object({ name: text(80), description: text(400) })),
      notes: z.array(text(400)).optional(),
    })
    .optional(),
  example: z.object({
    title: text(160),
    description: text(400),
    table: z
      .array(z.array(z.union([z.string().max(200), z.number()])).max(20))
      .min(1)
      .max(40),
    formula: text(300),
    result: text(300),
    walkthrough: text(800),
  }),
  mistakes: z.array(z.object({ title: text(160), detail: text(600) })).min(1),
  playgroundNote: z.string().max(600).optional(),
  quiz: z
    .array(
      z
        .object({
          question: text(300),
          options: z.array(text(200)).min(2).max(6),
          answerIndex: z.number().int().min(0),
          explanation: text(500),
        })
        .refine((q) => q.answerIndex < q.options.length, { message: 'answerIndex di luar daftar opsi.' }),
    )
    .min(1),
});

const validation = z.object({
  targets: z
    .array(
      z.object({
        cell: z.string().regex(/^[A-Za-z]{1,2}\d{1,3}$/),
        solution: z.string().max(500),
        requireFunction: z.string().max(20).optional(),
        exactText: z.boolean().optional(),
      }),
    )
    .min(1),
  requirePatterns: z
    .array(z.object({ pattern: z.string().max(200), message: z.string().max(400), cells: z.array(z.string().max(20)).max(50).optional() }))
    .optional(),
  rules: z.array(z.object({ pattern: z.string().max(200), message: z.string().max(400) })).optional(),
  variants: z
    .array(z.record(z.string().max(12), z.string().max(500)))
    .max(10)
    .optional(),
  tolerance: z.number().min(0).max(1).optional(),
  requireFormula: z.boolean().optional(),
});

const schemas = {
  modules: z.object({ slug, title: text(160), summary: text(1000), sortOrder: z.number().int().min(0).max(10000), published: z.boolean() }),
  lessons: z.object({
    moduleSlug: slug,
    slug,
    title: text(160),
    summary: text(300),
    minutes: z.number().int().min(1).max(600),
    sortOrder: z.number().int().min(0).max(10000),
    published: z.boolean(),
    content: lessonContent,
  }),
  exercises: z.object({
    slug,
    title: text(160),
    description: text(300),
    topic: slug,
    difficulty,
    rows: z.number().int().min(1).max(40),
    cols: z.number().int().min(1).max(20),
    cells: z.record(z.string().max(12), z.string().max(500)),
    editable: z.array(z.string().regex(refPattern)).min(1),
    task: text(1000),
    hints: z.array(text(400)).min(1).max(8),
    explanation: text(1500),
    points: z.number().int().min(1).max(100),
    lessonSlug: slug.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000),
    published: z.boolean(),
    validation,
    tools: z
      .object({
        sort: z.object({ range: z.string().regex(toolRange) }).optional(),
        filter: z.object({ range: z.string().regex(toolRange) }).optional(),
      })
      .nullable()
      .optional(),
  }),
  shortcuts: z
    .object({
      slug,
      action: text(160),
      keysWindows: z.string().trim().max(80).nullable(),
      keysMac: z.string().trim().max(80).nullable(),
      category: z.enum(['navigasi', 'edit-sel', 'format', 'seleksi', 'data', 'rumus', 'lembar-kerja']),
      explanation: text(1000),
      example: z.string().trim().max(500).nullable().optional(),
      verification: text(300),
      published: z.boolean(),
    })
    .refine((s) => s.keysWindows || s.keysMac, { message: 'Isi minimal satu kombinasi tombol (Windows atau Mac).' }),
  worksheets: z.object({
    slug,
    title: text(160),
    description: text(400),
    objective: text(400),
    difficulty,
    skills: z.array(text(60)).min(1).max(12),
    instructions: z.array(text(400)).min(1).max(12),
    fileName,
    keyFileName: fileName.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000),
    published: z.boolean(),
  }),
} satisfies Record<string, ZodType>;

type ResourceName = keyof typeof schemas;
const isResource = (s: string): s is ResourceName => s in schemas;

const b = (v: boolean): number => (v ? 1 : 0);

interface Handler {
  list(db: Db, limit: number, offset: number): Promise<{ items: unknown[]; total: number }>;
  get(db: Db, id: number): Promise<unknown | undefined>;
  /** Mengembalikan kolom untuk INSERT/UPDATE. */
  columns(db: Db, body: never): Promise<Record<string, unknown>>;
  /** Kolom tambahan saat UPDATE, dihitung dari data sebelum dan sesudah (mis. penanda diedit). */
  onUpdate?(before: unknown, body: never): Record<string, unknown>;
  table: string;
}

const count = async (db: Db, table: string): Promise<number> =>
  Number((await row<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0);

const handlers: Record<ResourceName, Handler> = {
  modules: {
    table: 'modules',
    async list(db, limit, offset) {
      const r = await rows<{ id: number; slug: string; title: string; summary: string; sort_order: number; published: number }>(
        db,
        `SELECT * FROM modules ORDER BY sort_order, id LIMIT ${limit} OFFSET ${offset}`,
      );
      return { items: r.map(modView), total: await count(db, 'modules') };
    },
    async get(db, id) {
      const r = await row<{ id: number; slug: string; title: string; summary: string; sort_order: number; published: number }>(
        db,
        'SELECT * FROM modules WHERE id=?',
        [id],
      );
      return r && modView(r);
    },
    async columns(_db, body: z.infer<typeof schemas.modules>) {
      return { slug: body.slug, title: body.title, summary: body.summary, sort_order: body.sortOrder, published: b(body.published) };
    },
  },
  lessons: {
    table: 'lessons',
    async list(db, limit, offset) {
      const r = await rows<LessonRow>(
        db,
        `SELECT l.*, m.slug AS module_slug FROM lessons l JOIN modules m ON m.id=l.module_id ORDER BY m.sort_order, l.sort_order LIMIT ${limit} OFFSET ${offset}`,
      );
      return { items: r.map((x) => ({ ...lessonView(x), content: undefined })), total: await count(db, 'lessons') };
    },
    async get(db, id) {
      const r = await row<LessonRow>(
        db,
        'SELECT l.*, m.slug AS module_slug FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=?',
        [id],
      );
      return r && lessonView(r);
    },
    async columns(db, body: z.infer<typeof schemas.lessons>) {
      const m = await row<{ id: number }>(db, 'SELECT id FROM modules WHERE slug=?', [body.moduleSlug]);
      if (!m) throw new AppError(400, 'VALIDATION_ERROR', `Modul "${body.moduleSlug}" tidak ada.`);
      return {
        module_id: m.id,
        slug: body.slug,
        title: body.title,
        summary: body.summary,
        minutes: body.minutes,
        sort_order: body.sortOrder,
        published: b(body.published),
        content: JSON.stringify(body.content),
      };
    },
    // Hanya perubahan pada teks pelajaran yang membuatnya "diedit" (dilindungi dari seed). Menerbitkan atau mengurutkan tidak.
    onUpdate(before, body: z.infer<typeof schemas.lessons>) {
      const b4 = before as ReturnType<typeof lessonView>;
      const changed =
        b4.title !== body.title ||
        b4.summary !== body.summary ||
        b4.minutes !== body.minutes ||
        !isDeepStrictEqual(b4.content, body.content);
      return changed ? { edited: 1 } : {};
    },
  },
  exercises: {
    table: 'exercises',
    async list(db, limit, offset) {
      const r = await rows<ExerciseRow>(db, `${EXERCISE_SELECT} ORDER BY e.sort_order, e.id LIMIT ${limit} OFFSET ${offset}`);
      return { items: r.map(exView), total: await count(db, 'exercises') };
    },
    async get(db, id) {
      const r = await row<ExerciseRow>(db, `${EXERCISE_SELECT} WHERE e.id=?`, [id]);
      return r && exView(r);
    },
    async columns(db, body: z.infer<typeof schemas.exercises>) {
      let lessonId: number | null = null;
      if (body.lessonSlug) {
        const l = await row<{ id: number }>(db, 'SELECT id FROM lessons WHERE slug=?', [body.lessonSlug]);
        if (!l) throw new AppError(400, 'VALIDATION_ERROR', `Pelajaran "${body.lessonSlug}" tidak ada.`);
        lessonId = l.id;
      }
      // Kunci jawaban harus lolos validasinya sendiri; mencegah latihan yang tidak mungkin diselesaikan.
      const def: ExerciseDef = {
        slug: body.slug,
        title: body.title,
        description: body.description,
        topic: body.topic,
        difficulty: body.difficulty,
        rows: body.rows,
        cols: body.cols,
        cells: body.cells,
        editable: body.editable,
        task: body.task,
        hints: body.hints,
        explanation: body.explanation,
        points: body.points,
        sortOrder: body.sortOrder,
        validation: body.validation,
      };
      const check = validateSubmission(def, solutionCells(def));
      if (!check.correct) {
        const why = check.targets.find((t) => !t.ok)?.message ?? check.message;
        throw new AppError(400, 'VALIDATION_ERROR', `Jawaban acuan tidak lolos validasinya sendiri: ${why}`);
      }
      return {
        lesson_id: lessonId,
        topic: body.topic,
        slug: body.slug,
        title: body.title,
        description: body.description,
        difficulty: body.difficulty,
        points: body.points,
        rows_count: body.rows,
        cols_count: body.cols,
        cells: JSON.stringify(body.cells),
        editable: JSON.stringify(body.editable),
        task: body.task,
        hints: JSON.stringify(body.hints),
        explanation: body.explanation,
        validation: JSON.stringify(body.validation),
        tools: body.tools ? JSON.stringify(body.tools) : null,
        sort_order: body.sortOrder,
        published: b(body.published),
      };
    },
  },
  shortcuts: {
    table: 'shortcuts',
    async list(db, limit, offset) {
      const r = await rows<ShortcutRow>(db, `SELECT * FROM shortcuts ORDER BY id LIMIT ${limit} OFFSET ${offset}`);
      return { items: r.map(rowToShortcut), total: await count(db, 'shortcuts') };
    },
    async get(db, id) {
      const r = await row<ShortcutRow>(db, 'SELECT * FROM shortcuts WHERE id=?', [id]);
      return r && rowToShortcut(r);
    },
    async columns(_db, body: z.infer<typeof schemas.shortcuts>) {
      return {
        slug: body.slug,
        action: body.action,
        keys_windows: body.keysWindows || null,
        keys_mac: body.keysMac || null,
        category: body.category,
        explanation: body.explanation,
        example: body.example || null,
        verification: body.verification,
        published: b(body.published),
      };
    },
  },
  worksheets: {
    table: 'worksheet_resources',
    async list(db, limit, offset) {
      const r = await rows<WorksheetRow>(db, `SELECT * FROM worksheet_resources ORDER BY sort_order, id LIMIT ${limit} OFFSET ${offset}`);
      return { items: r.map(rowToWorksheet), total: await count(db, 'worksheet_resources') };
    },
    async get(db, id) {
      const r = await row<WorksheetRow>(db, 'SELECT * FROM worksheet_resources WHERE id=?', [id]);
      return r && rowToWorksheet(r);
    },
    async columns(_db, body: z.infer<typeof schemas.worksheets>) {
      return {
        slug: body.slug,
        title: body.title,
        description: body.description,
        objective: body.objective,
        difficulty: body.difficulty,
        skills: JSON.stringify(body.skills),
        instructions: JSON.stringify(body.instructions),
        file_name: body.fileName,
        key_file_name: body.keyFileName ?? null,
        sort_order: body.sortOrder,
        published: b(body.published),
      };
    },
  },
};

interface LessonRow {
  id: number;
  module_id: number;
  module_slug: string;
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  sort_order: number;
  published: number;
  content: unknown;
  edited: number;
}
const modView = (r: { id: number; slug: string; title: string; summary: string; sort_order: number; published: number }) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  sortOrder: r.sort_order,
  published: !!r.published,
});
const lessonView = (r: LessonRow) => ({
  id: r.id,
  moduleSlug: r.module_slug,
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  minutes: r.minutes,
  sortOrder: r.sort_order,
  published: !!r.published,
  content: asJson<LessonContent>(r.content),
  edited: !!r.edited,
  /** Ada versi bawaan di kode, jadi "Kembalikan ke bawaan" tersedia. */
  hasDefault: bundledLessons.some((l) => l.slug === r.slug),
});
const exView = (r: ExerciseRow) => ({ id: r.id, ...rowToExercise(r), lessonSlug: r.lesson_slug });

export function adminRoutes({ db, config, auth }: Ctx): Router {
  const r = Router();
  r.use(auth.requireAdmin);

  const idParam = z.coerce.number().int().positive();
  const pageQ = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  });

  r.get('/stats', async (_req, res) => {
    const one = async (sql: string): Promise<number> => Number((await row<{ n: number }>(db, sql))?.n ?? 0);
    const usage = await rows<{ slug: string; title: string; attempts: number; correct: number }>(
      db,
      `SELECT e.slug, e.title, COUNT(a.id) AS attempts, COALESCE(SUM(a.correct),0) AS correct
       FROM exercises e JOIN exercise_attempts a ON a.exercise_id = e.id
       GROUP BY e.id ORDER BY attempts DESC LIMIT 10`,
    );
    const perDay = await rows<{ day: string; attempts: number }>(
      db,
      `SELECT DATE(created_at) AS day, COUNT(*) AS attempts FROM exercise_attempts
       WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL 14 DAY) GROUP BY DATE(created_at) ORDER BY day`,
    );
    res.json({
      data: {
        users: await one('SELECT COUNT(*) AS n FROM users'),
        admins: await one("SELECT COUNT(*) AS n FROM users WHERE role='admin'"),
        attempts: await one('SELECT COUNT(*) AS n FROM exercise_attempts'),
        completions: await one('SELECT COUNT(*) AS n FROM exercise_completions'),
        lessonCompletions: await one('SELECT COUNT(*) AS n FROM lesson_progress'),
        publishedLessons: await one('SELECT COUNT(*) AS n FROM lessons WHERE published=1'),
        publishedExercises: await one('SELECT COUNT(*) AS n FROM exercises WHERE published=1'),
        exerciseUsage: usage.map((u) => ({ slug: u.slug, title: u.title, attempts: Number(u.attempts), correct: Number(u.correct) })),
        attemptsPerDay: perDay.map((d) => ({ day: d.day, attempts: Number(d.attempts) })),
        note: 'Statistik hanya mencakup pengguna terdaftar; progres anonim tidak dikirim ke server.',
      },
    });
  });

  // Hari paling awal yang punya data apa pun (kunjungan, pendaftaran, percobaan latihan); bila belum ada, hari ini.
  const earliestDay = async (): Promise<string> => {
    const [a, b, c] = await Promise.all([
      row<{ d: string | null }>(db, "SELECT MIN(day) AS d FROM daily_stats WHERE metric IN ('visitor', 'pageview')"),
      row<{ d: string | null }>(db, 'SELECT MIN(DATE(created_at + INTERVAL 7 HOUR)) AS d FROM users'),
      row<{ d: string | null }>(db, 'SELECT MIN(DATE(created_at + INTERVAL 7 HOUR)) AS d FROM exercise_attempts'),
    ]);
    const found = [a?.d, b?.d, c?.d].filter((d): d is string => !!d).map((d) => String(d).slice(0, 10));
    return found.length ? found.sort()[0]! : jakartaDate(new Date());
  };

  // Aktivitas harian untuk daftar tanggal tertentu (urutan hasil mengikuti urutan tanggal).
  const dailyFor = async (dates: string[]) => {
    const lo = [...dates].sort()[0]!;
    const hi = [...dates].sort().reverse()[0]!;
    const [stats, signups, attempts] = await Promise.all([
      rows<{ day: string; metric: string; total: number }>(
        db,
        "SELECT day, metric, SUM(total) AS total FROM daily_stats WHERE day BETWEEN ? AND ? AND metric IN ('visitor','pageview','anon_attempt','anon_correct') GROUP BY day, metric",
        [lo, hi],
      ),
      rows<{ day: string; n: number }>(
        db,
        'SELECT DATE(created_at + INTERVAL 7 HOUR) AS day, COUNT(*) AS n FROM users WHERE DATE(created_at + INTERVAL 7 HOUR) BETWEEN ? AND ? GROUP BY day',
        [lo, hi],
      ),
      rows<{ day: string; n: number }>(
        db,
        'SELECT DATE(created_at + INTERVAL 7 HOUR) AS day, COUNT(*) AS n FROM exercise_attempts WHERE DATE(created_at + INTERVAL 7 HOUR) BETWEEN ? AND ? GROUP BY day',
        [lo, hi],
      ),
    ]);
    const stat = (day: string, metric: string): number =>
      Number(stats.find((x) => String(x.day).slice(0, 10) === day && x.metric === metric)?.total ?? 0);
    const count = (list: { day: string; n: number }[], day: string): number =>
      Number(list.find((x) => String(x.day).slice(0, 10) === day)?.n ?? 0);
    return dates.map((day) => ({
      day,
      visitors: stat(day, 'visitor'),
      pageviews: stat(day, 'pageview'),
      newUsers: count(signups, day),
      attempts: count(attempts, day),
      anonAttempts: stat(day, 'anon_attempt'),
      anonCorrect: stat(day, 'anon_correct'),
    }));
  };

  // Aktivitas harian sejak data pertama, terbaru di atas, berhalaman (WIB).
  r.get('/stats/daily', async (req, res) => {
    const q = parse(
      z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(60).default(14) }),
      req.query,
    );
    const today = jakartaDate(new Date());
    const first = await earliestDay();
    const totalDays = Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1);
    const start = (q.page - 1) * q.pageSize;
    const count = Math.max(0, Math.min(q.pageSize, totalDays - start));
    const dates = Array.from({ length: count }, (_, i) => jakartaDate(new Date(Date.now() - (start + i) * 86_400_000)));
    res.json({ data: dates.length ? await dailyFor(dates) : [], meta: { page: q.page, pageSize: q.pageSize, total: totalDays } });
  });

  // Statistik penggunaan 14 hari terakhir (WIB): kunjungan, halaman populer, pendaftaran, percobaan latihan.
  r.get('/stats/usage', async (_req, res) => {
    const days = Array.from({ length: 14 }, (_, i) => jakartaDate(new Date(Date.now() - (13 - i) * 86_400_000)));
    const from = days[0]!;
    const [stats, signups, attempts] = await Promise.all([
      rows<{ day: string; metric: string; total: number }>(
        db,
        "SELECT day, metric, SUM(total) AS total FROM daily_stats WHERE day >= ? AND metric IN ('visitor','pageview','anon_attempt','anon_correct') GROUP BY day, metric",
        [from],
      ),
      rows<{ day: string; n: number }>(
        db,
        'SELECT DATE(created_at + INTERVAL 7 HOUR) AS day, COUNT(*) AS n FROM users WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL 15 DAY) GROUP BY day',
      ),
      rows<{ day: string; n: number }>(
        db,
        'SELECT DATE(created_at + INTERVAL 7 HOUR) AS day, COUNT(*) AS n FROM exercise_attempts WHERE created_at >= (UTC_TIMESTAMP() - INTERVAL 15 DAY) GROUP BY day',
      ),
    ]);
    const stat = (day: string, metric: string): number => Number(stats.find((x) => x.day === day && x.metric === metric)?.total ?? 0);
    const daily = days.map((day) => ({
      day,
      visitors: stat(day, 'visitor'),
      pageviews: stat(day, 'pageview'),
      newUsers: Number(signups.find((x) => x.day === day)?.n ?? 0),
      attempts: Number(attempts.find((x) => x.day === day)?.n ?? 0),
      anonAttempts: stat(day, 'anon_attempt'),
      anonCorrect: stat(day, 'anon_correct'),
    }));
    const week = daily.slice(-7);
    const sum = (k: 'visitors' | 'pageviews' | 'newUsers' | 'attempts' | 'anonAttempts' | 'anonCorrect'): number =>
      week.reduce((n, d) => n + d[k], 0);
    const weekFrom = week[0]!.day;
    const topPages = await rows<{ item: string; total: number }>(
      db,
      "SELECT item, SUM(total) AS total FROM daily_stats WHERE metric = 'pageview' AND day >= ? GROUP BY item ORDER BY total DESC LIMIT 10",
      [weekFrom],
    );
    const metricTop = (metric: string, limit: number) =>
      rows<{ item: string; total: number }>(
        db,
        `SELECT item, SUM(total) AS total FROM daily_stats WHERE metric = ? AND day >= ? GROUP BY item ORDER BY total DESC LIMIT ${Math.trunc(limit)}`,
        [metric, weekFrom],
      );
    const [sources, features, notFound] = await Promise.all([metricTop('source', 10), metricTop('feature', 15), metricTop('notfound', 10)]);
    const anonTop = await rows<{ item: string; attempts: number; correct: number }>(
      db,
      `SELECT a.item, SUM(a.total) AS attempts, COALESCE((SELECT SUM(c.total) FROM daily_stats c WHERE c.metric = 'anon_correct' AND c.item = a.item AND c.day >= ?), 0) AS correct
       FROM daily_stats a WHERE a.metric = 'anon_attempt' AND a.day >= ? GROUP BY a.item ORDER BY attempts DESC LIMIT 10`,
      [weekFrom, weekFrom],
    );
    const allTime = await row<{ visitors: number | null; pageviews: number | null; since: string | null }>(
      db,
      "SELECT SUM(CASE WHEN metric = 'visitor' THEN total ELSE 0 END) AS visitors, SUM(CASE WHEN metric = 'pageview' THEN total ELSE 0 END) AS pageviews, MIN(CASE WHEN metric = 'visitor' THEN day END) AS since FROM daily_stats WHERE metric IN ('visitor', 'pageview')",
    );
    res.json({
      data: {
        daily,
        total: {
          visitors: Number(allTime?.visitors ?? 0),
          pageviews: Number(allTime?.pageviews ?? 0),
          since: allTime?.since ? String(allTime.since).slice(0, 10) : null,
          firstDay: await earliestDay(),
        },
        week: {
          visitors: sum('visitors'),
          pageviews: sum('pageviews'),
          newUsers: sum('newUsers'),
          attempts: sum('attempts'),
          anonAttempts: sum('anonAttempts'),
          anonCorrect: sum('anonCorrect'),
        },
        today: daily[daily.length - 1],
        topPages: topPages.map((p) => ({ page: p.item, views: Number(p.total) })),
        sources: sources.map((s) => ({ source: s.item, visitors: Number(s.total) })),
        features: features.map((f) => ({ feature: f.item, count: Number(f.total) })),
        notFound: notFound.map((n) => ({ path: n.item, hits: Number(n.total) })),
        anonymousExercises: anonTop.map((a) => ({ slug: a.item, attempts: Number(a.attempts), correct: Number(a.correct) })),
        note: 'Pengunjung unik dihitung per hari tanpa cookie (hash harian acak). Jumlah 7 hari dan jumlah total adalah penjumlahan pengunjung harian, bukan pengunjung unik sepanjang periode. Pengunjung dengan Do Not Track tidak dihitung.',
      },
    });
  });

  // Data Latihan 30 hari terakhir (WIB): unduhan per file, per bidang, per format, dan pemeriksaan. Hanya penghitung harian, tanpa data pribadi.
  r.get('/stats/datasets', async (_req, res) => {
    const from = jakartaDate(new Date(Date.now() - 29 * 86_400_000));
    const found = await rows<{ item: string; total: number }>(
      db,
      `SELECT item, SUM(total) AS total FROM daily_stats
       WHERE metric = 'feature' AND day >= ?
         AND (item LIKE 'dataset:%' OR item LIKE 'dataset-check:%' OR item LIKE 'dataset-format:%' OR item LIKE 'worksheet-check:%')
       GROUP BY item`,
      [from],
    );
    const downloads = new Map<string, number>();
    const checks = new Map<string, number>();
    const formats: Record<string, number> = { xlsx: 0, csv: 0 };
    let worksheetChecks = 0;
    for (const f of found) {
      const n = Number(f.total);
      const [kind = '', rest = ''] = f.item.split(':');
      if (kind === 'dataset') downloads.set(rest, n);
      else if (kind === 'dataset-check') checks.set(rest, n);
      else if (kind === 'dataset-format') formats[rest] = (formats[rest] ?? 0) + n;
      else if (kind === 'worksheet-check') worksheetChecks += n;
    }
    const catalog = datasetCatalog();
    const byField = new Map<string, number>();
    const top = [...downloads.entries()]
      .map(([slug, count]) => {
        const c = catalog.find((d) => d.slug === slug);
        if (c) byField.set(c.field, (byField.get(c.field) ?? 0) + count);
        return { slug, title: c?.title ?? slug, field: c?.field ?? null, downloads: count, checks: checks.get(slug) ?? 0 };
      })
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);
    const sumOf = (m: Map<string, number>): number => [...m.values()].reduce((s, n) => s + n, 0);
    res.json({
      data: {
        days: 30,
        datasetTotal: catalog.length,
        downloads: sumOf(downloads),
        distinctDownloaded: downloads.size,
        checks: sumOf(checks),
        worksheetChecks,
        formats,
        byField: [...byField.entries()].map(([field, count]) => ({ field, downloads: count })).sort((a, b) => b.downloads - a.downloads),
        top,
        note: 'Dihitung dari penghitung harian 30 hari terakhir. Unduhan dihitung per permintaan, bukan per orang. Pemeriksaan hanya bisa dilakukan akun Premium.',
      },
    });
  });

  // Pendaftar baru dan pengguna aktif (akun yang mencoba latihan dalam 1, 7, dan 30 hari terakhir).
  r.get('/stats/activity', async (_req, res) => {
    const one = async (sql: string): Promise<number> => Number((await row<{ n: number }>(db, sql))?.n ?? 0);
    const signups = (d: number): Promise<number> =>
      one(`SELECT COUNT(*) AS n FROM users WHERE role = 'user' AND created_at >= (UTC_TIMESTAMP() - INTERVAL ${d} DAY)`);
    const active = (d: number): Promise<number> =>
      one(
        `SELECT COUNT(DISTINCT a.user_id) AS n FROM exercise_attempts a JOIN users u ON u.id = a.user_id
         WHERE u.role = 'user' AND a.created_at >= (UTC_TIMESTAMP() - INTERVAL ${d} DAY)`,
      );
    const [s1, s7, s30, a1, a7, a30, total] = await Promise.all([
      signups(1),
      signups(7),
      signups(30),
      active(1),
      active(7),
      active(30),
      one("SELECT COUNT(*) AS n FROM users WHERE role = 'user'"),
    ]);
    res.json({
      data: {
        signups: { d1: s1, d7: s7, d30: s30 },
        active: { d1: a1, d7: a7, d30: a30 },
        total,
        note: 'Aktif berarti akun yang mengerjakan latihan pada periode itu. Membaca pelajaran saja belum dihitung.',
      },
    });
  });

  // Daftar pengguna terdaftar (berisi email: data pribadi, hanya untuk admin).
  r.get('/users', async (req, res) => {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
        q: z.string().trim().max(80).optional(),
      }),
      req.query,
    );
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.q) {
      const like = `%${q.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
      where.push('(u.email LIKE ? OR u.display_name LIKE ?)');
      params.push(like, like);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await row<{ n: number }>(db, `SELECT COUNT(*) AS n FROM users u ${clause}`, params);
    const limit = Math.trunc(q.pageSize);
    const offset = Math.trunc((q.page - 1) * q.pageSize);
    const list = await rows<{
      id: number;
      email: string;
      display_name: string;
      role: string;
      created_at: string;
      last_login_at: string | null;
      email_verified_at: string | null;
      has_password: number;
      points: number | null;
      exercises_done: number;
      lessons_done: number;
      last_active: string | null;
      premium_until: string | null;
    }>(
      db,
      `SELECT u.id, u.email, u.display_name, u.role, u.created_at, u.last_login_at, u.email_verified_at, u.has_password, u.premium_until,
         (SELECT SUM(points) FROM exercise_completions WHERE user_id = u.id) AS points,
         (SELECT COUNT(*) FROM exercise_completions WHERE user_id = u.id) AS exercises_done,
         (SELECT COUNT(*) FROM lesson_progress WHERE user_id = u.id) AS lessons_done,
         (SELECT MAX(day) FROM learning_days WHERE user_id = u.id) AS last_active
       FROM users u ${clause} ORDER BY u.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const iso = (v: string | null): string | null => (v ? new Date(`${v.replace(' ', 'T')}Z`).toISOString() : null);
    res.json({
      data: list.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        createdAt: iso(u.created_at),
        lastLoginAt: iso(u.last_login_at),
        emailVerified: !!u.email_verified_at,
        hasPassword: !!u.has_password,
        points: Number(u.points ?? 0),
        exercisesDone: Number(u.exercises_done),
        lessonsDone: Number(u.lessons_done),
        lastActive: u.last_active,
        premiumUntil: iso(u.premium_until),
        premium: !!u.premium_until && new Date(`${u.premium_until.replace(' ', 'T')}Z`).getTime() > Date.now(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: Number(total?.n ?? 0) },
    });
  });

  // Ringkasan Premium: aktif, segera habis, dan riwayat aktivasi (dari log audit admin; perkiraan pendapatan memakai harga sekarang).
  r.get('/stats/premium', async (_req, res) => {
    const one = async (sql: string, params: unknown[] = []): Promise<number> => Number((await row<{ n: number }>(db, sql, params))?.n ?? 0);
    const users = await one("SELECT COUNT(*) AS n FROM users WHERE role = 'user'");
    const active = await one("SELECT COUNT(*) AS n FROM users WHERE role = 'user' AND premium_until > UTC_TIMESTAMP()");
    const expiring = await rows<{ email: string; display_name: string; premium_until: string }>(
      db,
      `SELECT email, display_name, premium_until FROM users
       WHERE role = 'user' AND premium_until > UTC_TIMESTAMP() AND premium_until < (UTC_TIMESTAMP() + INTERVAL 30 DAY)
       ORDER BY premium_until LIMIT 20`,
    );
    const grantWhere = "l.resource = 'users' AND l.action REGEXP '^premium-[0-9]+m$'";
    const totals = await row<{ grants: number; months: number | null; grants30: number; months30: number | null }>(
      db,
      `SELECT COUNT(*) AS grants,
         SUM(CAST(SUBSTRING(l.action, 9, LENGTH(l.action) - 9) AS UNSIGNED)) AS months,
         SUM(l.created_at >= (UTC_TIMESTAMP() - INTERVAL 30 DAY)) AS grants30,
         SUM(CASE WHEN l.created_at >= (UTC_TIMESTAMP() - INTERVAL 30 DAY) THEN CAST(SUBSTRING(l.action, 9, LENGTH(l.action) - 9) AS UNSIGNED) ELSE 0 END) AS months30
       FROM admin_audit_logs l WHERE ${grantWhere}`,
    );
    const recent = await rows<{ created_at: string; action: string; email: string | null }>(
      db,
      `SELECT l.created_at, l.action, u.email FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.resource_id
       WHERE ${grantWhere} ORDER BY l.id DESC LIMIT 20`,
    );
    const online = await row<{ orders: number; amount: number | null }>(
      db,
      "SELECT COUNT(*) AS orders, SUM(amount) AS amount FROM premium_orders WHERE status = 'paid'",
    );
    const { priceIdr, months: priceMonths } = config.premium;
    const estimate = (m: number | null): number => (priceIdr && priceMonths ? Math.round((Number(m ?? 0) / priceMonths) * priceIdr) : 0);
    res.json({
      data: {
        users,
        active,
        rate: users ? active / users : 0,
        grants: Number(totals?.grants ?? 0),
        grants30: Number(totals?.grants30 ?? 0),
        estimatedRevenue: estimate(totals?.months ?? 0),
        estimatedRevenue30: estimate(totals?.months30 ?? 0),
        onlineOrders: Number(online?.orders ?? 0),
        onlineRevenue: Number(online?.amount ?? 0),
        expiring: expiring.map((e) => ({
          email: e.email,
          name: e.display_name,
          until: new Date(`${e.premium_until.replace(' ', 'T')}Z`).toISOString(),
        })),
        recent: recent.map((g) => ({
          at: new Date(`${g.created_at.replace(' ', 'T')}Z`).toISOString(),
          months: Number(g.action.slice(8, -1)),
          email: g.email,
        })),
        note: 'Riwayat aktivasi diambil dari log tindakan admin. Perkiraan pendapatan memakai harga Premium saat ini dan ikut menghitung aktivasi hadiah, jadi ini batas atas, bukan catatan keuangan.',
      },
    });
  });

  // Perpanjang Premium N bulan dari sekarang atau dari akhir masa aktif; 0 mencabut. Mengembalikan akhir masa aktif (ISO) atau null.
  const setPremiumMonths = async (adminId: number, userId: number, months: number): Promise<string | null> => {
    if (months === 0) {
      await run(db, 'UPDATE users SET premium_until = NULL WHERE id = ?', [userId]);
    } else {
      await run(
        db,
        'UPDATE users SET premium_until = DATE_ADD(GREATEST(COALESCE(premium_until, UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL ? MONTH) WHERE id = ?',
        [months, userId],
      );
    }
    await audit(adminId, months === 0 ? 'premium-revoke' : `premium-${months}m`, 'users', userId);
    const u = await row<{ premium_until: string | null }>(db, 'SELECT premium_until FROM users WHERE id = ?', [userId]);
    return u?.premium_until ? new Date(`${u.premium_until.replace(' ', 'T')}Z`).toISOString() : null;
  };

  // Aktivasi Premium manual (pembayaran di luar aplikasi): perpanjang N bulan dari sekarang atau dari akhir masa aktif; 0 mencabut.
  r.put('/users/:id/premium', async (req, res) => {
    const id = parse(z.coerce.number().int().positive(), req.params.id);
    const { months } = parse(z.object({ months: z.number().int().min(0).max(36) }), req.body);
    const exists = await row<{ id: number; role: string }>(db, 'SELECT id, role FROM users WHERE id = ?', [id]);
    if (!exists) throw notFound('Pengguna');
    res.json({ data: { premiumUntil: await setPremiumMonths(req.user!.id, id, months) } });
  });

  // ---------- Catatan pembayaran manual (buku kas kecil; angka nyata, bukan perkiraan) ----------
  interface PaymentRow {
    id: number;
    user_id: number | null;
    payer: string;
    amount: number;
    months: number;
    paid_on: string;
    note: string | null;
    created_at: string;
    email: string | null;
  }
  const paymentOut = (p: PaymentRow) => ({
    id: Number(p.id),
    payer: p.payer,
    amount: Number(p.amount),
    months: Number(p.months),
    paidOn: String(p.paid_on).slice(0, 10),
    note: p.note,
    linkedEmail: p.email,
    createdAt: new Date(`${String(p.created_at).replace(' ', 'T')}Z`).toISOString(),
  });
  const PAYMENT_SELECT = `SELECT p.id, p.user_id, p.payer, p.amount, p.months, p.paid_on, p.note, p.created_at, u.email
    FROM manual_payments p LEFT JOIN users u ON u.id = p.user_id`;

  r.get('/payments', async (req, res) => {
    const q = parse(
      z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }),
      req.query,
    );
    const sum = await row<{ n: number; amount: number | null; months: number | null; amount30: number | null }>(
      db,
      `SELECT COUNT(*) AS n, SUM(amount) AS amount, SUM(months) AS months,
         SUM(CASE WHEN paid_on >= ? THEN amount ELSE 0 END) AS amount30 FROM manual_payments`,
      [jakartaDate(new Date(Date.now() - 29 * 86_400_000))],
    );
    const items = await rows<PaymentRow>(
      db,
      `${PAYMENT_SELECT} ORDER BY p.paid_on DESC, p.id DESC LIMIT ${Math.trunc(q.pageSize)} OFFSET ${Math.trunc((q.page - 1) * q.pageSize)}`,
    );
    res.json({
      data: {
        items: items.map(paymentOut),
        page: q.page,
        pageSize: q.pageSize,
        total: Number(sum?.n ?? 0),
        summary: {
          count: Number(sum?.n ?? 0),
          amount: Number(sum?.amount ?? 0),
          months: Number(sum?.months ?? 0),
          amount30: Number(sum?.amount30 ?? 0),
        },
      },
    });
  });

  r.post('/payments', async (req, res) => {
    const body = parse(
      z.object({
        payer: z.string().trim().min(1).max(255),
        amount: z.number().int().min(0).max(100_000_000),
        months: z.number().int().min(0).max(36).default(0),
        paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat TTTT-BB-HH.'),
        note: z.string().trim().max(255).optional(),
        activate: z.boolean().default(false),
      }),
      req.body,
    );
    const parsed = new Date(`${body.paidOn}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.paidOn) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Tanggal bayar tidak valid.');
    }
    if (body.paidOn > jakartaDate(new Date())) throw new AppError(400, 'VALIDATION_ERROR', 'Tanggal bayar tidak boleh di masa depan.');
    const user = await row<{ id: number }>(db, 'SELECT id FROM users WHERE email = ?', [body.payer.toLowerCase()]);
    if (body.activate) {
      if (!user) throw new AppError(400, 'VALIDATION_ERROR', 'Untuk mengaktifkan Premium, isi pembayar dengan email akun yang terdaftar.');
      if (body.months < 1) throw new AppError(400, 'VALIDATION_ERROR', 'Isi lama Premium (bulan) untuk mengaktifkan.');
    }
    const result = await run(
      db,
      'INSERT INTO manual_payments (user_id, payer, amount, months, paid_on, note, created_by) VALUES (?,?,?,?,?,?,?)',
      [user?.id ?? null, body.payer, body.amount, body.months, body.paidOn, body.note ?? null, req.user!.id],
    );
    const id = Number(result.insertId);
    await audit(req.user!.id, 'payment-add', 'manual_payments', id);
    if (body.activate && user) await setPremiumMonths(req.user!.id, user.id, body.months);
    const created = await row<PaymentRow>(db, `${PAYMENT_SELECT} WHERE p.id = ?`, [id]);
    res.status(201).json({ data: created ? paymentOut(created) : null });
  });

  // Pertumbuhan: corong akun (daftar sampai Premium) dan retensi per hari pendaftaran. Semua dari data akun, bukan pengunjung anonim.
  r.get('/stats/growth', async (_req, res) => {
    const one = async (sql: string, params: unknown[] = []): Promise<number> => Number((await row<{ n: number }>(db, sql, params))?.n ?? 0);
    const registered = await one("SELECT COUNT(*) AS n FROM users WHERE role = 'user'");
    const funnel = [
      { key: 'registered', label: 'Mendaftar', count: registered },
      {
        key: 'tried',
        label: 'Mencoba latihan',
        count: await one(
          "SELECT COUNT(DISTINCT a.user_id) AS n FROM exercise_attempts a JOIN users u ON u.id = a.user_id WHERE u.role = 'user'",
        ),
      },
      {
        key: 'solved1',
        label: 'Menyelesaikan 1 latihan',
        count: await one(
          "SELECT COUNT(DISTINCT c.user_id) AS n FROM exercise_completions c JOIN users u ON u.id = c.user_id WHERE u.role = 'user'",
        ),
      },
      {
        key: 'solved5',
        label: 'Menyelesaikan 5 latihan',
        count: await one(
          "SELECT COUNT(*) AS n FROM (SELECT c.user_id FROM exercise_completions c JOIN users u ON u.id = c.user_id WHERE u.role = 'user' GROUP BY c.user_id HAVING COUNT(*) >= 5) t",
        ),
      },
      {
        key: 'lesson',
        label: 'Menyelesaikan 1 pelajaran',
        count: await one(
          "SELECT COUNT(DISTINCT p.user_id) AS n FROM lesson_progress p JOIN users u ON u.id = p.user_id WHERE u.role = 'user'",
        ),
      },
      {
        key: 'premium',
        label: 'Premium aktif',
        count: await one("SELECT COUNT(*) AS n FROM users WHERE role = 'user' AND premium_until > UTC_TIMESTAMP()"),
      },
    ];

    // Retensi: "kembali" berarti mengerjakan latihan lagi pada hari sesudah mendaftar (kunjungan tanpa latihan tidak tercatat per akun).
    const today = jakartaDate(new Date());
    const shift = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const from = shift(today, -21);
    const [signups, activity] = await Promise.all([
      rows<{ id: number; day: string }>(
        db,
        "SELECT id, DATE(created_at + INTERVAL 7 HOUR) AS day FROM users WHERE role = 'user' AND DATE(created_at + INTERVAL 7 HOUR) >= ?",
        [from],
      ),
      rows<{ user_id: number; day: string }>(
        db,
        'SELECT user_id, DATE(created_at + INTERVAL 7 HOUR) AS day FROM exercise_attempts WHERE DATE(created_at + INTERVAL 7 HOUR) >= ? GROUP BY user_id, day',
        [from],
      ),
    ]);
    const active = new Map<number, Set<string>>();
    for (const a of activity) {
      const s = active.get(Number(a.user_id)) ?? new Set<string>();
      s.add(String(a.day).slice(0, 10));
      active.set(Number(a.user_id), s);
    }
    const byDay = new Map<string, number[]>();
    for (const s of signups) {
      const d = String(s.day).slice(0, 10);
      byDay.set(d, [...(byDay.get(d) ?? []), Number(s.id)]);
    }
    const cohorts = [...byDay.entries()]
      .sort((x, y) => (x[0] < y[0] ? 1 : -1))
      .map(([day, ids]) => {
        const comeBack = (lo: number, hi: number): number =>
          ids.filter((id) => {
            const days = active.get(id);
            if (!days) return false;
            for (let k = lo; k <= hi; k++) if (days.has(shift(day, k))) return true;
            return false;
          }).length;
        // Hanya dihitung bila seluruh jendelanya sudah lewat (hari ini belum selesai).
        return {
          day,
          signups: ids.length,
          day1: shift(day, 1) < today ? comeBack(1, 1) : null,
          week1: shift(day, 7) < today ? comeBack(1, 7) : null,
        };
      });
    res.json({
      data: {
        funnel,
        cohorts,
        note: 'Corong menghitung akun, bukan pengunjung. "Kembali" berarti mengerjakan latihan lagi pada hari sesudah mendaftar; hari ini belum dihitung karena belum selesai, dan tanda "-" berarti jendelanya belum lewat.',
      },
    });
  });

  r.delete('/payments/:id', async (req, res) => {
    const id = parse(z.coerce.number().int().positive(), req.params.id);
    const exists = await row<{ id: number }>(db, 'SELECT id FROM manual_payments WHERE id = ?', [id]);
    if (!exists) throw notFound('Catatan pembayaran');
    await run(db, 'DELETE FROM manual_payments WHERE id = ?', [id]);
    await audit(req.user!.id, 'payment-delete', 'manual_payments', id);
    res.json({ data: { deleted: true } });
  });

  // Latihan yang paling sering gagal (percobaan akun + tanpa akun), sebagai bahan memperbaiki petunjuk dan penjelasan.
  r.get('/stats/hard', async (_req, res) => {
    const list = await rows<{ slug: string; title: string; acc_att: number; acc_ok: number; anon_att: number; anon_ok: number }>(
      db,
      `SELECT e.slug, e.title,
         (SELECT COUNT(*) FROM exercise_attempts a WHERE a.exercise_id = e.id) AS acc_att,
         (SELECT COALESCE(SUM(a.correct), 0) FROM exercise_attempts a WHERE a.exercise_id = e.id) AS acc_ok,
         (SELECT COALESCE(SUM(d.total), 0) FROM daily_stats d WHERE d.metric = 'anon_attempt' AND d.item = e.slug) AS anon_att,
         (SELECT COALESCE(SUM(d.total), 0) FROM daily_stats d WHERE d.metric = 'anon_correct' AND d.item = e.slug) AS anon_ok
       FROM exercises e WHERE e.published = 1`,
    );
    const hard = list
      .map((x) => {
        const attempts = Number(x.acc_att) + Number(x.anon_att);
        const correct = Number(x.acc_ok) + Number(x.anon_ok);
        return { slug: x.slug, title: x.title, attempts, correct, rate: attempts ? correct / attempts : 1 };
      })
      .filter((x) => x.attempts >= 5 && x.rate < 0.5)
      .sort((a, b) => a.rate - b.rate || b.attempts - a.attempts)
      .slice(0, 10);
    res.json({ data: { hard, note: 'Hanya latihan dengan minimal 5 percobaan dan rasio benar di bawah 50% (semua waktu).' } });
  });

  // Moderasi papan peringkat Sprint: daftar skor terbaru (termasuk yang disembunyikan) dan tombol sembunyikan/tampilkan.
  r.get('/sprint', async (_req, res) => {
    const list = await rows<{
      id: number;
      name: string;
      score: number;
      correct: number;
      wrong: number;
      hidden: number;
      created_ms: number;
      email: string | null;
    }>(
      db,
      `SELECT s.id, s.name, s.score, s.correct, s.wrong, s.hidden, s.created_ms, u.email
       FROM sprint_scores s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.id DESC LIMIT 100`,
    );
    const total = await row<{ n: number; hidden: number | null }>(db, 'SELECT COUNT(*) AS n, SUM(hidden) AS hidden FROM sprint_scores');
    res.json({
      data: {
        total: Number(total?.n ?? 0),
        hidden: Number(total?.hidden ?? 0),
        entries: list.map((e) => ({
          id: e.id,
          name: e.name,
          score: e.score,
          correct: e.correct,
          wrong: e.wrong,
          hidden: !!e.hidden,
          at: new Date(Number(e.created_ms)).toISOString(),
          email: e.email,
        })),
      },
    });
  });

  r.put('/sprint/:id', async (req, res) => {
    const id = parse(z.coerce.number().int().positive(), req.params.id);
    const { hidden } = parse(z.object({ hidden: z.boolean() }), req.body);
    const upd = await run(db, 'UPDATE sprint_scores SET hidden = ? WHERE id = ?', [hidden ? 1 : 0, id]);
    if (upd.affectedRows !== 1) throw notFound('Skor');
    await audit(req.user!.id, hidden ? 'sprint-hide' : 'sprint-show', 'sprint_scores', id);
    res.json({ data: { id, hidden } });
  });

  // Hasil uji kemampuan Excel (terbuka tanpa akun): ringkasan, sebaran tingkat, soal tersulit, akurasi per modul, tren mingguan, dan 50 hasil terbaru.
  // Tingkat dihitung ulang dari jawaban yang tersimpan, jadi hasil versi lama (12 soal) ikut dinilai dengan aturan yang sama.
  const PLACEMENT_SAMPLE = 5000;
  r.get('/stats/placement', async (req, res) => {
    const filter = parse(
      z.object({ level: z.enum(['Pemula', 'Menengah', 'Mahir']).optional(), account: z.literal('1').optional() }),
      req.query,
    );
    const sum = await row<{ n: number; avg: number | null; with_account: number | null }>(
      db,
      'SELECT COUNT(*) AS n, AVG(score) AS avg, SUM(user_id IS NOT NULL) AS with_account FROM placement_results',
    );
    const byModule = await rows<{ start_module: string | null; n: number }>(
      db,
      'SELECT start_module, COUNT(*) AS n FROM placement_results GROUP BY start_module ORDER BY n DESC',
    );
    const latest = await rows<{
      id: number;
      user_id: number | null;
      score: number;
      total: number;
      start_module: string | null;
      answers: unknown;
      version: number;
      created_at: string;
      display_name: string | null;
      email: string | null;
    }>(
      db,
      `SELECT p.id, p.user_id, p.score, p.total, p.start_module, p.answers, p.version, p.created_at, u.display_name, u.email
       FROM placement_results p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT ${PLACEMENT_SAMPLE}`,
    );

    const levels: Record<PlacementLevel, number> = { Pemula: 0, Menengah: 0, Mahir: 0 };
    const perQuestion = new Map<string, { asked: number; wrong: number }>();
    const perModuleAcc = new Map<string, { correct: number; total: number }>();
    const weeks = new Map<string, { count: number; pct: number }>();
    let legacy = 0;
    const listed: {
      id: number;
      score: number;
      total: number;
      level: PlacementLevel | null;
      legacy: boolean;
      startModule: string | null;
      at: string;
      user: { displayName: string | null; email: string } | null;
    }[] = [];
    let matching = 0;

    for (const p of latest) {
      const raw =
        typeof p.answers === 'string' ? (JSON.parse(p.answers) as Record<string, number>) : ((p.answers ?? {}) as Record<string, number>);
      const asked = placementQuestions.filter((q) => Number.isInteger(raw[q.id]));
      const result = asked.length > 0 ? evaluatePlacement(raw, asked) : null;
      const isLegacy = Number(p.version) < 2;
      if (isLegacy) legacy++;
      if (result) {
        levels[result.level]++;
        for (const q of asked) {
          const cur = perQuestion.get(q.id) ?? { asked: 0, wrong: 0 };
          cur.asked++;
          if (raw[q.id] !== q.answerIndex) cur.wrong++;
          perQuestion.set(q.id, cur);
        }
        for (const m of result.perModule) {
          const cur = perModuleAcc.get(m.module) ?? { correct: 0, total: 0 };
          cur.correct += m.correct;
          cur.total += m.total;
          perModuleAcc.set(m.module, cur);
        }
      }
      const ms = new Date(`${p.created_at.replace(' ', 'T')}Z`).getTime();
      const wib = new Date(ms + 7 * 3_600_000);
      const monday = new Date(wib.getTime() - ((wib.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
      const wk = weeks.get(monday) ?? { count: 0, pct: 0 };
      wk.count++;
      wk.pct += p.total > 0 ? p.score / p.total : 0;
      weeks.set(monday, wk);

      const level = result?.level ?? null;
      if ((filter.level && level !== filter.level) || (filter.account && p.user_id === null)) continue;
      matching++;
      if (listed.length < 50) {
        listed.push({
          id: p.id,
          score: p.score,
          total: p.total,
          level,
          legacy: isLegacy,
          startModule: p.start_module,
          at: new Date(ms).toISOString(),
          user: p.email ? { displayName: p.display_name, email: p.email } : null,
        });
      }
    }

    const questionOf = new Map(placementQuestions.map((q) => [q.id, q]));
    res.json({
      data: {
        total: Number(sum?.n ?? 0),
        averageScore: sum?.avg === null || sum?.avg === undefined ? null : Math.round(Number(sum.avg) * 10) / 10,
        withAccount: Number(sum?.with_account ?? 0),
        byStartModule: byModule.map((m) => ({ module: m.start_module, count: Number(m.n) })),
        sampled: latest.length,
        legacy,
        levels,
        hardest: [...perQuestion.entries()]
          .map(([id, v]) => ({
            id,
            question: questionOf.get(id)?.question ?? id,
            module: questionOf.get(id)?.module ?? '',
            asked: v.asked,
            wrong: v.wrong,
          }))
          .sort((a, b) => b.wrong / b.asked - a.wrong / a.asked || b.asked - a.asked)
          .slice(0, 8),
        moduleAccuracy: [...perModuleAcc.entries()].map(([module, v]) => ({ module, correct: v.correct, total: v.total })),
        weekly: [...weeks.entries()]
          .sort(([a], [b]) => (a < b ? 1 : -1))
          .slice(0, 8)
          .map(([week, v]) => ({ week, count: v.count, avgPercent: Math.round((v.pct / v.count) * 100) })),
        matching,
        recent: listed,
      },
    });
  });

  // Ekspor CSV. Sel yang diawali = + - @ diberi tanda petik agar tidak dieksekusi sebagai rumus oleh Excel (CSV injection).
  const csvCell = (v: unknown): string => {
    let t = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const sendCsv = (res: Response, name: string, header: string[], data: unknown[][]): void => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send('﻿' + [header, ...data].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
  };

  r.get('/users.csv', async (_req, res) => {
    const list = await rows<{
      id: number;
      email: string;
      display_name: string;
      role: string;
      created_at: string;
      last_login_at: string | null;
      email_verified_at: string | null;
      has_password: number;
      points: number | null;
      exercises_done: number;
      lessons_done: number;
    }>(
      db,
      `SELECT u.id, u.email, u.display_name, u.role, u.created_at, u.last_login_at, u.email_verified_at, u.has_password,
         (SELECT SUM(points) FROM exercise_completions WHERE user_id = u.id) AS points,
         (SELECT COUNT(*) FROM exercise_completions WHERE user_id = u.id) AS exercises_done,
         (SELECT COUNT(*) FROM lesson_progress WHERE user_id = u.id) AS lessons_done
       FROM users u ORDER BY u.id`,
    );
    sendCsv(
      res,
      'pengguna-excellab.csv',
      [
        'id',
        'nama',
        'email',
        'peran',
        'daftar_utc',
        'terakhir_masuk_utc',
        'email_terverifikasi',
        'masuk_dengan',
        'poin',
        'latihan_selesai',
        'pelajaran_selesai',
      ],
      list.map((u) => [
        u.id,
        u.display_name,
        u.email,
        u.role,
        u.created_at,
        u.last_login_at ?? '',
        u.email_verified_at ? 'ya' : 'tidak',
        u.has_password ? 'kata sandi' : 'kode email',
        Number(u.points ?? 0),
        u.exercises_done,
        u.lessons_done,
      ]),
    );
  });

  r.get('/stats/usage.csv', async (_req, res) => {
    const from = jakartaDate(new Date(Date.now() - 89 * 86_400_000));
    const stats = await rows<{ day: string; metric: string; total: number }>(
      db,
      "SELECT day, metric, SUM(total) AS total FROM daily_stats WHERE day >= ? AND metric IN ('visitor','pageview','anon_attempt','anon_correct') GROUP BY day, metric ORDER BY day",
      [from],
    );
    const signups = await rows<{ day: string; n: number }>(
      db,
      'SELECT DATE(created_at + INTERVAL 7 HOUR) AS day, COUNT(*) AS n FROM users GROUP BY day',
    );
    const attempts = await rows<{ day: string; n: number }>(
      db,
      'SELECT DATE(created_at + INTERVAL 7 HOUR) AS day, COUNT(*) AS n FROM exercise_attempts GROUP BY day',
    );
    const days = [
      ...new Set([
        ...stats.map((x) => x.day),
        ...signups.map((x) => x.day).filter((d) => d >= from),
        ...attempts.map((x) => x.day).filter((d) => d >= from),
      ]),
    ].sort();
    const stat = (d: string, m: string): number => Number(stats.find((x) => x.day === d && x.metric === m)?.total ?? 0);
    sendCsv(
      res,
      'statistik-excellab.csv',
      ['tanggal_wib', 'pengunjung', 'halaman_dibuka', 'pendaftar_baru', 'percobaan_akun', 'percobaan_tanpa_akun', 'benar_tanpa_akun'],
      days.map((d) => [
        d,
        stat(d, 'visitor'),
        stat(d, 'pageview'),
        Number(signups.find((x) => x.day === d)?.n ?? 0),
        Number(attempts.find((x) => x.day === d)?.n ?? 0),
        stat(d, 'anon_attempt'),
        stat(d, 'anon_correct'),
      ]),
    );
  });

  // Laporan soal dari pengguna.
  r.get('/reports', async (req, res) => {
    const status = z
      .enum(['open', 'all'])
      .default('open')
      .parse(req.query.status ?? 'open');
    const list = await rows<{
      id: number;
      reason: string;
      note: string | null;
      created_at: string;
      resolved_at: string | null;
      exercise_slug: string;
      exercise_title: string;
      email: string;
      reports_for_exercise: number;
    }>(
      db,
      `SELECT r.id, r.reason, r.note, r.created_at, r.resolved_at, e.slug AS exercise_slug, e.title AS exercise_title, u.email,
         (SELECT COUNT(*) FROM exercise_reports r2 WHERE r2.exercise_id = r.exercise_id AND r2.resolved_at IS NULL) AS reports_for_exercise
       FROM exercise_reports r JOIN exercises e ON e.id = r.exercise_id JOIN users u ON u.id = r.user_id
       ${status === 'open' ? 'WHERE r.resolved_at IS NULL' : ''}
       ORDER BY r.resolved_at IS NOT NULL, r.created_at DESC LIMIT 200`,
    );
    const iso = (s: string | null): string | null => (s ? new Date(`${s.replace(' ', 'T')}Z`).toISOString() : null);
    res.json({
      data: list.map((x) => ({
        id: x.id,
        reason: x.reason,
        note: x.note,
        createdAt: iso(x.created_at),
        resolvedAt: iso(x.resolved_at),
        exerciseSlug: x.exercise_slug,
        exerciseTitle: x.exercise_title,
        email: x.email,
        openForExercise: Number(x.reports_for_exercise),
      })),
    });
  });

  r.put('/reports/:id/resolve', async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const r1 = await run(db, 'UPDATE exercise_reports SET resolved_at = NOW() WHERE id = ? AND resolved_at IS NULL', [id]);
    if (r1.affectedRows === 0) {
      const exists = await row<{ id: number }>(db, 'SELECT id FROM exercise_reports WHERE id = ?', [id]);
      if (!exists) throw notFound('Laporan');
    }
    await audit(req.user!.id, 'report-resolve', 'exercise_reports', id);
    res.json({ data: { id, resolved: true } });
  });

  r.use('/:resource', (req, _res, next) => {
    if (!isResource(String(req.params.resource))) return next(notFound('Sumber daya'));
    next();
  });

  const audit = (adminId: number, action: string, resource: string, id: string | number) =>
    run(db, 'INSERT INTO admin_audit_logs (admin_id, action, resource, resource_id) VALUES (?,?,?,?)', [
      adminId,
      action,
      resource,
      String(id),
    ]);

  r.get('/:resource', async (req, res) => {
    const name = req.params.resource as ResourceName;
    const q = parse(pageQ, req.query);
    const { items, total } = await handlers[name].list(db, Math.trunc(q.pageSize), Math.trunc((q.page - 1) * q.pageSize));
    res.json({ data: items, meta: { page: q.page, pageSize: q.pageSize, total } });
  });

  r.get('/:resource/:id', async (req, res) => {
    const name = req.params.resource as ResourceName;
    const item = await handlers[name].get(db, parse(idParam, req.params.id));
    if (!item) throw notFound();
    res.json({ data: item });
  });

  r.post('/:resource', async (req, res) => {
    const name = req.params.resource as ResourceName;
    const body = parse(schemas[name] as ZodType, req.body);
    const h = handlers[name];
    const cols = await h.columns(db, body as never);
    const keys = Object.keys(cols);
    try {
      const result = await run(
        db,
        `INSERT INTO ${h.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        keys.map((k) => cols[k]),
      );
      await audit(req.user!.id, 'create', name, result.insertId);
      res.status(201).json({ data: await h.get(db, result.insertId) });
    } catch (e) {
      throw mapDbError(e);
    }
  });

  r.put('/:resource/:id', async (req, res) => {
    const name = req.params.resource as ResourceName;
    const id = parse(idParam, req.params.id);
    const h = handlers[name];
    const before = await h.get(db, id);
    if (!before) throw notFound();
    const body = parse(schemas[name] as ZodType, req.body);
    const cols = { ...(await h.columns(db, body as never)), ...h.onUpdate?.(before, body as never) };
    const keys = Object.keys(cols);
    try {
      await run(db, `UPDATE ${h.table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, [...keys.map((k) => cols[k]), id]);
    } catch (e) {
      throw mapDbError(e);
    }
    await audit(req.user!.id, 'update', name, id);
    res.json({ data: await h.get(db, id) });
  });

  // Mengembalikan teks pelajaran ke versi bawaan di kode dan melepas perlindungan dari seed.
  r.post('/lessons/:id/reset', async (req, res) => {
    const id = parse(idParam, req.params.id);
    const current = (await handlers.lessons.get(db, id)) as ReturnType<typeof lessonView> | undefined;
    if (!current) throw notFound();
    const bundled = bundledLessons.find((l) => l.slug === current.slug);
    if (!bundled) throw new AppError(400, 'VALIDATION_ERROR', 'Pelajaran ini dibuat lewat admin dan tidak punya versi bawaan.');
    await run(db, 'UPDATE lessons SET title=?, summary=?, minutes=?, content=?, edited=0 WHERE id=?', [
      bundled.title,
      bundled.summary,
      bundled.minutes,
      JSON.stringify(bundled.content),
      id,
    ]);
    await audit(req.user!.id, 'lesson-reset', 'lessons', id);
    res.json({ data: await handlers.lessons.get(db, id) });
  });

  r.delete('/:resource/:id', async (req, res) => {
    const name = req.params.resource as ResourceName;
    const id = parse(idParam, req.params.id);
    const h = handlers[name];
    try {
      const result = await run(db, `DELETE FROM ${h.table} WHERE id=?`, [id]);
      if (result.affectedRows === 0) throw notFound();
    } catch (e) {
      throw mapDbError(e);
    }
    await audit(req.user!.id, 'delete', name, id);
    res.json({ data: { ok: true } });
  });

  return r;
}

function mapDbError(e: unknown): unknown {
  const code = (e as { code?: string })?.code;
  if (code === 'ER_DUP_ENTRY') return new AppError(409, 'CONFLICT', 'Slug sudah dipakai oleh data lain.');
  if (code === 'ER_ROW_IS_REFERENCED_2')
    return new AppError(
      409,
      'CONFLICT',
      'Data ini masih dipakai oleh data lain (mis. modul masih punya pelajaran). Pindahkan atau hapus data terkait dulu.',
    );
  return e;
}
