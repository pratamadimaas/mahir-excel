import { Router } from 'express';
import { z } from 'zod';
import { jakartaDate, templates } from '@excellab/shared';
import type { Ctx } from '../app';
import { AppError, notFound, parse } from '../middleware/errors';
import { buildTemplate } from '../templates';
import { bump } from './track';

const slugParam = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);

/** Template .xlsx dibuat saat diunduh (tanpa berkas di server). Daftar terbuka untuk umum, unduhan wajib masuk. */
export function templateRoutes({ db, auth }: Ctx): Router {
  const r = Router();

  r.get('/templates', (_req, res) => {
    res.json({ data: templates.map((t) => ({ ...t, premiumOnly: !t.free })) });
  });

  r.get('/templates/:slug/download', auth.requireAuth, async (req, res) => {
    const def = templates.find((t) => t.slug === parse(slugParam, req.params.slug));
    if (!def) throw notFound('Template');
    if (!def.free && !req.user?.premium) throw new AppError(402, 'PREMIUM_REQUIRED', 'Template ini khusus anggota Premium.');
    bump(db, jakartaDate(), 'feature', `template:${def.slug}`).catch(() => undefined);
    const wb = buildTemplate(def.slug);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mahir-excel-${def.slug}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  });

  return r;
}
