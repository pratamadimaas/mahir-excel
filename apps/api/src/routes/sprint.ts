import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Ctx } from '../app';
import { row, rows, run } from '../db/pool';
import { AppError, errorBody, notFound, parse } from '../middleware/errors';
import { applyAnswer, cleanName, nextQuestion, usableShortcuts, type Rng, type ShortcutItem, type SprintQuestion } from '../lib/sprint';

/** Toleransi keterlambatan jaringan setelah waktu habis, dan jeda minimum manusiawi antara soal tampil dan dijawab. */
const GRACE_MS = 1500;
const MIN_THINK_MS = 400;
const MAX_QUESTIONS = 400;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

const cryptoRng: Rng = () => crypto.randomInt(0, 2 ** 30) / 2 ** 30;

interface SessionRow {
  id: number;
  token: string;
  user_id: number | null;
  started_ms: number;
  ends_ms: number;
  issued_ms: number;
  q_index: number;
  answer_idx: number | null;
  score: number;
  correct: number;
  wrong: number;
  streak: number;
  finished: number;
  submitted: number;
}

const tokenSchema = z.string().regex(/^[a-f0-9]{48}$/, 'Token tidak valid.');

/** Soal yang dikirim ke klien: tanpa kunci jawaban. */
const publicQuestion = (q: SprintQuestion, index: number) => ({
  index,
  kind: q.kind,
  prompt: q.prompt,
  table: q.table,
  formula: q.formula,
  options: q.options,
});

type Period = 'today' | 'week' | 'all';
/** Awal "hari ini" menurut WIB, dalam milidetik epoch UTC. */
export function periodStart(period: Period, now: number): number {
  if (period === 'all') return 0;
  if (period === 'week') return now - 7 * 24 * 60 * 60 * 1000;
  const wib = now + JAKARTA_OFFSET_MS;
  return wib - (wib % (24 * 60 * 60 * 1000)) - JAKARTA_OFFSET_MS;
}

export function sprintRoutes({ db, config }: Ctx, rng: Rng = cryptoRng): Router {
  const r = Router();
  const durationMs = config.sprintSeconds * 1000;

  const limiter = (windowMs: number, limit: number, message: string) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => !config.rateLimitEnabled,
      handler: (_req, res) => {
        res.status(429).json(errorBody('RATE_LIMITED', message));
      },
    });
  const startLimiter = limiter(15 * 60 * 1000, 40, 'Terlalu banyak ronde dimulai. Tunggu beberapa menit lalu coba lagi.');
  const answerLimiter = limiter(60 * 1000, 600, 'Terlalu banyak permintaan. Pelan sedikit.');
  const submitLimiter = limiter(15 * 60 * 1000, 30, 'Terlalu banyak percobaan menyimpan skor. Coba lagi nanti.');

  let shortcutCache: { at: number; list: ShortcutItem[] } | null = null;
  async function shortcuts(): Promise<ShortcutItem[]> {
    if (shortcutCache && Date.now() - shortcutCache.at < 10 * 60 * 1000) return shortcutCache.list;
    const list = await rows<{ action: string; keys_windows: string | null }>(
      db,
      'SELECT action, keys_windows FROM shortcuts WHERE published = 1',
    );
    const usable = usableShortcuts(list.map((s) => ({ action: s.action, keysWindows: s.keys_windows })));
    shortcutCache = { at: Date.now(), list: usable };
    return usable;
  }

  async function load(token: string): Promise<SessionRow> {
    const s = await row<SessionRow>(db, 'SELECT * FROM sprint_sessions WHERE token = ?', [token]);
    if (!s) throw notFound('Ronde');
    return s;
  }

  /** Peringkat bila skor ini dimasukkan: jumlah nama berbeda yang punya skor terbaik lebih tinggi, ditambah satu. */
  async function rankOf(score: number, period: Period): Promise<number> {
    const since = periodStart(period, Date.now());
    const better = await row<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM (
         SELECT LOWER(name) AS nm, MAX(score) AS best FROM sprint_scores WHERE hidden = 0 AND created_ms >= ? GROUP BY nm HAVING best > ?
       ) t`,
      [since, score],
    );
    return Number(better?.n ?? 0) + 1;
  }

  const summary = async (s: SessionRow) => ({
    score: s.score,
    correct: s.correct,
    wrong: s.wrong,
    rankToday: await rankOf(s.score, 'today'),
    rankAll: await rankOf(s.score, 'all'),
    canSubmit: s.score > 0 && !s.submitted,
    submitted: !!s.submitted,
  });

  r.post('/sprint/start', startLimiter, async (req, res) => {
    const now = Date.now();
    const token = crypto.randomBytes(24).toString('hex');
    const q = nextQuestion(rng, 0, await shortcuts());
    await run(
      db,
      'INSERT INTO sprint_sessions (token, user_id, started_ms, ends_ms, issued_ms, q_index, answer_idx) VALUES (?,?,?,?,?,0,?)',
      [token, req.user?.id ?? null, now, now + durationMs, now, q.answerIndex],
    );
    if (Math.random() < 0.02) {
      // Sesi yang ditinggalkan dan tidak pernah dipakai mengirim skor dibersihkan setelah sehari.
      await run(db, 'DELETE FROM sprint_sessions WHERE started_ms < ? AND id NOT IN (SELECT session_id FROM sprint_scores)', [
        now - 24 * 60 * 60 * 1000,
      ]);
    }
    res.status(201).json({ data: { token, durationMs, endsAtMs: now + durationMs, serverNowMs: now, question: publicQuestion(q, 0) } });
  });

  r.post('/sprint/:token/answer', answerLimiter, async (req, res) => {
    const token = parse(tokenSchema, req.params.token);
    const body = parse(z.object({ q: z.number().int().min(0), choice: z.number().int().min(0).max(3) }), req.body);
    const s = await load(token);
    const now = Date.now();
    if (s.finished) throw new AppError(409, 'CONFLICT', 'Ronde ini sudah selesai.');

    // Waktu habis: jawaban terlambat tidak dihitung.
    if (now > s.ends_ms + GRACE_MS) {
      await run(db, 'UPDATE sprint_sessions SET finished = 1 WHERE id = ? AND finished = 0', [s.id]);
      res.json({ data: { finished: true, accepted: false, score: s.score, serverNowMs: now } });
      return;
    }
    if (body.q !== s.q_index || s.answer_idx === null) throw new AppError(409, 'CONFLICT', 'Soal tidak sesuai dengan soal aktif.');
    if (now - s.issued_ms < MIN_THINK_MS) throw new AppError(429, 'RATE_LIMITED', 'Terlalu cepat. Baca soalnya dulu.');

    const correct = body.choice === s.answer_idx;
    const after = applyAnswer({ score: s.score, streak: s.streak }, correct);
    const over = now >= s.ends_ms || s.q_index + 1 >= MAX_QUESTIONS;
    const next = over ? null : nextQuestion(rng, after.streak, await shortcuts());
    // Pembaruan bersyarat: dua jawaban bersamaan untuk soal yang sama tidak bisa sama-sama dihitung.
    const upd = await run(
      db,
      `UPDATE sprint_sessions SET score = ?, streak = ?, correct = correct + ?, wrong = wrong + ?, q_index = q_index + 1,
         answer_idx = ?, issued_ms = ?, finished = ? WHERE id = ? AND q_index = ? AND finished = 0`,
      [after.score, after.streak, correct ? 1 : 0, correct ? 0 : 1, next ? next.answerIndex : null, now, over ? 1 : 0, s.id, s.q_index],
    );
    if (upd.affectedRows !== 1) throw new AppError(409, 'CONFLICT', 'Jawaban untuk soal ini sudah diterima.');
    res.json({
      data: {
        accepted: true,
        correct,
        correctIndex: s.answer_idx,
        delta: after.delta,
        score: after.score,
        streak: after.streak,
        correctCount: s.correct + (correct ? 1 : 0),
        wrongCount: s.wrong + (correct ? 0 : 1),
        finished: over,
        question: next ? publicQuestion(next, s.q_index + 1) : null,
        serverNowMs: now,
      },
    });
  });

  r.post('/sprint/:token/finish', answerLimiter, async (req, res) => {
    const token = parse(tokenSchema, req.params.token);
    const s = await load(token);
    const now = Date.now();
    if (!s.finished) {
      if (now < s.ends_ms - 500) throw new AppError(409, 'CONFLICT', 'Waktu ronde belum habis.');
      await run(db, 'UPDATE sprint_sessions SET finished = 1 WHERE id = ? AND finished = 0', [s.id]);
    }
    res.json({ data: await summary({ ...s, finished: 1 }) });
  });

  r.post('/sprint/:token/submit', submitLimiter, async (req, res) => {
    const token = parse(tokenSchema, req.params.token);
    const { name: raw } = parse(z.object({ name: z.string().max(80) }), req.body);
    const s = await load(token);
    const now = Date.now();
    if (!s.finished && now < s.ends_ms - 500) throw new AppError(409, 'CONFLICT', 'Selesaikan ronde dulu sebelum menyimpan skor.');
    if (s.submitted) throw new AppError(409, 'CONFLICT', 'Skor ronde ini sudah disimpan.');
    if (s.score <= 0) throw new AppError(400, 'VALIDATION_ERROR', 'Skor 0 tidak masuk papan peringkat. Coba lagi!');
    const name = cleanName(raw);
    if (!name) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Nama 2 sampai 20 karakter: huruf, angka, spasi, titik, strip, atau garis bawah. Tanpa tautan atau alamat.',
        [{ path: 'name', message: 'Nama tidak valid.' }],
      );
    }
    const claimed = await run(db, 'UPDATE sprint_sessions SET finished = 1, submitted = 1 WHERE id = ? AND submitted = 0', [s.id]);
    if (claimed.affectedRows !== 1) throw new AppError(409, 'CONFLICT', 'Skor ronde ini sudah disimpan.');
    await run(db, 'INSERT INTO sprint_scores (session_id, user_id, name, score, correct, wrong, created_ms) VALUES (?,?,?,?,?,?,?)', [
      s.id,
      s.user_id,
      name,
      s.score,
      s.correct,
      s.wrong,
      now,
    ]);
    res.status(201).json({ data: { saved: true, name, rankToday: await rankOf(s.score, 'today'), rankAll: await rankOf(s.score, 'all') } });
  });

  r.get('/sprint/leaderboard', async (req, res) => {
    const q = parse(
      z.object({
        period: z.enum(['today', 'week', 'all']).default('today'),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
      req.query,
    );
    const since = periodStart(q.period, Date.now());
    const list = await rows<{ id: number; name: string; score: number; correct: number; wrong: number; created_ms: number }>(
      db,
      `SELECT id, name, score, correct, wrong, created_ms FROM sprint_scores
       WHERE hidden = 0 AND created_ms >= ? ORDER BY score DESC, correct DESC, id ASC LIMIT 300`,
      [since],
    );
    // Satu baris per nama (skor terbaiknya) supaya satu orang tidak memenuhi seluruh papan.
    const seen = new Set<string>();
    const best = list.filter((e) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let prevScore = -1;
    let prevRank = 0;
    const entries = best.slice(0, q.limit).map((e, i) => {
      const rank = e.score === prevScore ? prevRank : i + 1;
      prevScore = e.score;
      prevRank = rank;
      return { rank, name: e.name, score: e.score, correct: e.correct, wrong: e.wrong, at: new Date(Number(e.created_ms)).toISOString() };
    });
    res.json({ data: { period: q.period, entries, players: best.length, durationSeconds: config.sprintSeconds } });
  });

  return r;
}
