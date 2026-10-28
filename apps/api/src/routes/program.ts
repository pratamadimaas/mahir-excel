import crypto from 'node:crypto';
import { Router } from 'express';
import type { Ctx } from '../app';
import { row, run, withTransaction, type Queryable } from '../db/pool';
import { buildCertificate } from '../lib/certificate';
import { AppError } from '../middleware/errors';

/** Cakupan sertifikat Program Perintis di tabel `certificates`. */
export const PERINTIS_SCOPE = 'perintis';

const iso = (v: string): string => new Date(`${v.replace(' ', 'T')}Z`).toISOString();

interface Requirement {
  key: 'placement' | 'sprint' | 'exercises';
  label: string;
  done: boolean;
  progress?: { have: number; need: number };
  to: string;
}

/**
 * Program Perintis: sertifikat gratis untuk N pengguna pertama yang menyelesaikan uji kemampuan Excel, satu ronde
 * Sprint, dan beberapa latihan. Semua syarat dibaca dari data akun di server, bukan dari klaim browser.
 */
export function programRoutes({ db, config, auth }: Ctx): Router {
  const r = Router();
  const { quota, minExercises } = config.program;

  async function requirements(q: Queryable, userId: number): Promise<Requirement[]> {
    const [placement, sprint, exercises] = await Promise.all([
      row<{ n: number }>(q, 'SELECT COUNT(*) AS n FROM placement_results WHERE user_id = ?', [userId]),
      // Ronde dianggap selesai bila server menandainya selesai (waktu habis) dan ada jawaban benar.
      row<{ n: number }>(q, 'SELECT COUNT(*) AS n FROM sprint_sessions WHERE user_id = ? AND finished = 1 AND correct > 0', [userId]),
      row<{ n: number }>(
        q,
        `SELECT COUNT(*) AS n FROM exercise_completions ec JOIN exercises e ON e.id = ec.exercise_id
         WHERE ec.user_id = ? AND e.published = 1`,
        [userId],
      ),
    ]);
    const have = Number(exercises?.n ?? 0);
    return [
      { key: 'placement', label: 'Selesaikan uji kemampuan Excel saat masuk akun', done: Number(placement?.n ?? 0) > 0, to: '/tes-penempatan' },
      { key: 'sprint', label: 'Selesaikan satu ronde Sprint 60 detik saat masuk akun', done: Number(sprint?.n ?? 0) > 0, to: '/sprint' },
      {
        key: 'exercises',
        label: `Selesaikan ${minExercises} latihan`,
        done: have >= minExercises,
        progress: { have: Math.min(have, minExercises), need: minExercises },
        to: '/latihan',
      },
    ];
  }

  async function myClaim(q: Queryable, userId: number): Promise<{ slot: number; code: string; claimedAt: string } | null> {
    const c = await row<{ slot: number; claimed_at: string; code: string | null }>(
      q,
      `SELECT pc.slot, pc.claimed_at, c.code
       FROM program_claims pc LEFT JOIN certificates c ON c.user_id = pc.user_id AND c.scope = ?
       WHERE pc.user_id = ?`,
      [PERINTIS_SCOPE, userId],
    );
    return c && c.code ? { slot: Number(c.slot), code: c.code, claimedAt: iso(c.claimed_at) } : null;
  }

  async function status(userId: number | null) {
    const taken = Number((await row<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM program_claims'))?.n ?? 0);
    const base = {
      enabled: config.program.enabled,
      quota,
      taken: Math.min(taken, quota),
      remaining: Math.max(quota - taken, 0),
      open: config.program.enabled && taken < quota,
      minExercises,
    };
    if (userId === null) return base;
    const reqs = await requirements(db, userId);
    return { ...base, requirements: reqs, eligible: reqs.every((q) => q.done), claim: await myClaim(db, userId) };
  }

  r.get('/program/status', async (req, res) => {
    res.json({ data: await status(req.user?.id ?? null) });
  });

  r.post('/program/claim', auth.requireAuth, async (req, res) => {
    const userId = req.user!.id;
    if (!config.program.enabled) throw new AppError(409, 'CONFLICT', 'Program ini sedang tidak dibuka.');

    try {
      await withTransaction(db, async (tx) => {
        if (await myClaim(tx, userId)) return; // sudah klaim: idempoten
        const reqs = await requirements(tx, userId);
        const missing = reqs.filter((q) => !q.done);
        if (missing.length > 0) {
          throw new AppError(403, 'FORBIDDEN', `Syarat belum lengkap: ${missing.map((m) => m.label.toLowerCase()).join('; ')}.`);
        }
        // Kunci baris terakhir supaya klaim bersamaan diurutkan; kunci unik pada `slot` menjadi pengaman terakhir.
        const last = await row<{ m: number | null }>(tx, 'SELECT MAX(slot) AS m FROM program_claims FOR UPDATE');
        const slot = Number(last?.m ?? 0) + 1;
        if (slot > quota) throw new AppError(409, 'CONFLICT', 'Kuota Program Perintis sudah habis.');
        await run(tx, 'INSERT INTO program_claims (user_id, slot) VALUES (?, ?)', [userId, slot]);
        await run(tx, 'INSERT IGNORE INTO certificates (user_id, scope, code) VALUES (?,?,?)', [
          userId,
          PERINTIS_SCOPE,
          crypto.randomBytes(8).toString('hex').toUpperCase(),
        ]);
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY' || (e as { code?: string }).code === 'ER_LOCK_DEADLOCK') {
        throw new AppError(409, 'CONFLICT', 'Banyak pengguna mengklaim bersamaan. Coba lagi sebentar lagi.');
      }
      throw e;
    }
    res.json({ data: await status(userId) });
  });

  // Sertifikat Perintis gratis (bukan fitur Premium); hanya untuk yang sudah berhasil klaim.
  r.get('/program/certificate', auth.requireAuth, async (req, res) => {
    const user = req.user!;
    const claim = await myClaim(db, user.id);
    if (!claim) throw new AppError(403, 'FORBIDDEN', 'Klaim sertifikat Perintis dulu setelah semua syarat terpenuhi.');
    const base = config.webOrigins[0] ?? '';
    const doc = buildCertificate({
      name: user.displayName,
      scopeTitle: 'Microsoft Excel',
      lessons: 0,
      issuedAt: new Date(claim.claimedAt),
      code: claim.code,
      verifyUrl: `${base}/sertifikat/${claim.code}`,
      heading: 'SERTIFIKAT KEAHLIAN',
      intro: 'telah menunjukkan penguasaan dasar',
      detail: '',
      seal: { top: 'PERINTIS', value: `#${claim.slot}` },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sertifikat-perintis-mahir-excel.pdf"');
    doc.pipe(res);
  });

  return r;
}
