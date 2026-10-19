import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { evaluatePlacement, placementQuestions } from '@excellab/shared';
import type { Ctx } from '../app';
import { run } from '../db/pool';
import { errorBody, parse } from '../middleware/errors';

/**
 * Tes penempatan terbuka tanpa akun, tetapi skornya disimpan di server.
 * Skor dihitung ulang di sini dari jawaban (nilai dari klien tidak dipercaya).
 * Untuk pengunjung tanpa akun tidak ada nama, IP, atau User-Agent yang disimpan.
 */
export function placementRoutes({ db, config }: Ctx): Router {
  const r = Router();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.rateLimitEnabled,
    handler: (_req, res) => {
      res.status(429).json(errorBody('RATE_LIMITED', 'Terlalu banyak percobaan tes. Coba lagi nanti.'));
    },
  });

  const body = z.object({ answers: z.record(z.string().max(10), z.number().int().min(0).max(10)) });

  r.post('/placement', limiter, async (req, res) => {
    const { answers } = parse(body, req.body);
    for (const q of placementQuestions) {
      const a = answers[q.id];
      if (a === undefined || a >= q.options.length) {
        res.status(400).json(errorBody('VALIDATION_ERROR', 'Semua pertanyaan harus dijawab dengan pilihan yang valid.'));
        return;
      }
    }
    const clean = Object.fromEntries(placementQuestions.map((q) => [q.id, answers[q.id]!]));
    const result = evaluatePlacement(clean);
    await run(db, 'INSERT INTO placement_results (user_id, score, total, start_module, per_module, answers) VALUES (?,?,?,?,?,?)', [
      req.user?.id ?? null,
      result.score,
      result.total,
      result.startModule,
      JSON.stringify(result.perModule),
      JSON.stringify(clean),
    ]);
    res.status(201).json({ data: { saved: true, score: result.score, total: result.total, startModule: result.startModule } });
  });

  return r;
}
