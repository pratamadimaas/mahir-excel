import { Router } from 'express';
import { z } from 'zod';
import { jakartaDate } from '@excellab/shared';
import type { Ctx } from '../app';
import { datasetCatalog, getDataset, gradeValue, type Verdict } from '../datasets';
import { buildCsv, buildDatasetWorkbook } from '../datasets/workbook';
import { AppError, notFound, parse } from '../middleware/errors';
import { worksheetKey } from '../worksheets/builders';
import { bump } from './track';

const slugParam = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const formatQuery = z.enum(['xlsx', 'csv']).default('xlsx');

const given = z.object({ value: z.union([z.string().max(200), z.number(), z.null()]), formula: z.boolean() });
const datasetCheckBody = z.object({ answers: z.array(given).length(3) });
const worksheetCheckBody = z.object({
  cells: z.array(given.extend({ sheet: z.string().max(60), ref: z.string().regex(/^[A-Z]{1,3}\d{1,5}$/) })).max(300),
});

const NO_FORMULA =
  'Nilainya sudah cocok, tetapi kamu mengetiknya langsung. Tulis dengan rumus supaya hasilnya ikut berubah kalau data berubah.';

const premiumOnly = (req: { user?: { premium: boolean } }): void => {
  if (!req.user?.premium) throw new AppError(402, 'PREMIUM_REQUIRED', 'Pemeriksaan berkas khusus anggota Premium.');
};

/**
 * Data latihan dibuat saat diunduh (tanpa berkas di server), seperti template.
 * Katalog dan unduhan terbuka untuk umum; pemeriksaan jawaban khusus Premium.
 * Berkas dibaca di browser, server hanya menerima nilai sel jawaban (kecil), jadi bebannya ringan.
 */
export function datasetRoutes({ db, auth }: Ctx): Router {
  const r = Router();

  r.get('/datasets', (_req, res) => {
    res.json({ data: datasetCatalog() });
  });

  r.get('/datasets/:slug/download', async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const format = parse(formatQuery, req.query.format);
    const found = getDataset(slug);
    if (!found) throw notFound('Data latihan');
    bump(db, jakartaDate(), 'feature', `dataset:${slug}`).catch(() => undefined);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="mahir-excel-${slug}.csv"`);
      res.send(buildCsv(found.data));
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mahir-excel-${slug}.xlsx"`);
    await buildDatasetWorkbook(found.spec, found.data).xlsx.write(res);
    res.end();
  });

  r.post('/datasets/:slug/check', auth.requireAuth, (req, res) => {
    premiumOnly(req);
    const slug = parse(slugParam, req.params.slug);
    const body = parse(datasetCheckBody, req.body);
    const found = getDataset(slug);
    if (!found) throw notFound('Data latihan');
    const items = found.data.tasks.map((t, i) => {
      const verdict: Verdict = gradeValue(t.expected, t.tol, body.answers[i]);
      return {
        no: i + 1,
        ask: t.ask,
        verdict,
        ...(verdict === 'salah' ? { hint: t.hint, expected: t.expected } : {}),
        ...(verdict === 'tanpa-rumus' ? { hint: NO_FORMULA } : {}),
      };
    });
    bump(db, jakartaDate(), 'feature', `dataset-check:${slug}`).catch(() => undefined);
    res.json({ data: { slug, total: items.length, correct: items.filter((x) => x.verdict === 'benar').length, items } });
  });

  r.post('/worksheets/:slug/check', auth.requireAuth, (req, res) => {
    premiumOnly(req);
    const slug = parse(slugParam, req.params.slug);
    const body = parse(worksheetCheckBody, req.body);
    const key = worksheetKey(slug);
    if (!key) throw notFound('Worksheet');
    const items = key.map((k) => {
      const g = body.cells.find((c) => c.sheet === k.sheet && c.ref === k.ref);
      const expected = typeof k.expected === 'boolean' ? (k.expected ? 'TRUE' : 'FALSE') : (k.expected ?? '');
      const verdict: Verdict = gradeValue(expected, undefined, g, k.formula);
      return {
        sheet: k.sheet,
        ref: k.ref,
        verdict,
        ...(verdict === 'salah' ? { expected } : {}),
        ...(verdict === 'tanpa-rumus' ? { hint: NO_FORMULA } : {}),
      };
    });
    bump(db, jakartaDate(), 'feature', `worksheet-check:${slug}`).catch(() => undefined);
    res.json({ data: { slug, total: items.length, correct: items.filter((x) => x.verdict === 'benar').length, items } });
  });

  return r;
}
