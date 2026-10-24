import { Router } from 'express';
import { z } from 'zod';
import { jakartaDate, modules } from '@excellab/shared';
import type { Ctx } from '../app';
import { notFound, parse } from '../middleware/errors';
import { buildCheatsheet, cheatsheetLessons } from '../lib/cheatsheet';
import { bump } from './track';

const slugParam = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);

/** Lembar contekan PDF per modul. Daftar terbuka untuk pengguna masuk, PDF khusus Premium. */
export function cheatsheetRoutes({ db, auth }: Ctx): Router {
  const r = Router();

  r.get('/cheatsheets', auth.requireAuth, (_req, res) => {
    res.json({
      data: modules.map((m) => ({ slug: m.slug, title: m.title, summary: m.summary, lessons: cheatsheetLessons(m.slug).length })),
    });
  });

  r.get('/cheatsheets/:module/download', auth.requireAuth, auth.requirePremium, (req, res) => {
    const slug = parse(slugParam, req.params.module);
    if (!modules.some((m) => m.slug === slug) || cheatsheetLessons(slug).length === 0) throw notFound('Modul');
    bump(db, jakartaDate(), 'feature', `cheatsheet:${slug}`).catch(() => undefined);
    const doc = buildCheatsheet(slug, new Date());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contekan-mahir-excel-${slug}.pdf"`);
    doc.pipe(res);
  });

  return r;
}
