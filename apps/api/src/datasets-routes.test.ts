import ExcelJS from 'exceljs';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Ctx } from './app';
import { getDataset } from './datasets';
import { createErrorHandler } from './middleware/errors';
import { AppError } from './middleware/errors';
import { datasetRoutes } from './routes/datasets';
import { worksheetKey } from './worksheets/builders';

/** Aplikasi mini tanpa database: pengguna ditentukan header x-user (free atau premium). */
function makeApp() {
  const auth = {
    requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      const who = req.header('x-user');
      if (!who) throw new AppError(401, 'UNAUTHENTICATED', 'Silakan masuk.');
      req.user = {
        id: 1,
        email: 'a@b.c',
        displayName: 'A',
        role: 'user',
        emailVerified: true,
        premiumUntil: null,
        premium: who === 'premium',
      };
      next();
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api', datasetRoutes({ db: {}, config: {}, auth } as unknown as Ctx));
  app.use(createErrorHandler(false));
  return app;
}
const app = makeApp();
const binary = (r: request.Response, cb: (e: Error | null, b: Buffer) => void) => {
  const chunks: Buffer[] = [];
  r.on('data', (c: Buffer) => chunks.push(c));
  r.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('rute data latihan', () => {
  it('katalog terbuka untuk umum dan berisi 50 data', async () => {
    const res = await request(app).get('/api/datasets');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(50);
    expect(res.body.data[0]).toMatchObject({
      slug: expect.any(String),
      title: expect.any(String),
      rows: expect.any(Number),
      cols: expect.any(Number),
    });
    expect(res.body.data.every((d: { tasks: string[] }) => d.tasks.length === 3)).toBe(true);
  });

  it('unduh xlsx dan csv tanpa login; slug asing ditolak', async () => {
    const x = await request(app).get('/api/datasets/kas-kecil/download').buffer(true).parse(binary);
    expect(x.status).toBe(200);
    expect(x.headers['content-disposition']).toContain('mahir-excel-kas-kecil.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.body as unknown as ExcelJS.Buffer);
    expect(wb.getWorksheet('Data')!.rowCount).toBe(getDataset('kas-kecil')!.data.rows.length + 1);

    const c = await request(app).get('/api/datasets/kas-kecil/download?format=csv');
    expect(c.status).toBe(200);
    expect(c.headers['content-type']).toContain('text/csv');
    expect(c.text.split('\r\n').length).toBeGreaterThan(100);

    expect((await request(app).get('/api/datasets/tidak-ada/download')).status).toBe(404);
    expect((await request(app).get('/api/datasets/Bukan_Slug!/download')).status).toBe(400);
    expect((await request(app).get('/api/datasets/kas-kecil/download?format=pdf')).status).toBe(400);
  });

  const correct = () => getDataset('kas-kecil')!.data.tasks.map((t) => ({ value: t.expected, formula: true }));

  it('cek data latihan: wajib masuk dan Premium', async () => {
    expect((await request(app).post('/api/datasets/kas-kecil/check').send({ answers: correct() })).status).toBe(401);
    const free = await request(app).post('/api/datasets/kas-kecil/check').set('x-user', 'free').send({ answers: correct() });
    expect(free.status).toBe(402);
    expect(free.body.error.code).toBe('PREMIUM_REQUIRED');
  });

  it('cek data latihan: benar, salah dengan petunjuk, diketik langsung, dan kosong', async () => {
    const tasks = getDataset('kas-kecil')!.data.tasks;
    const ok = await request(app).post('/api/datasets/kas-kecil/check').set('x-user', 'premium').send({ answers: correct() });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ total: 3, correct: 3 });

    const mixed = await request(app)
      .post('/api/datasets/kas-kecil/check')
      .set('x-user', 'premium')
      .send({
        answers: [
          { value: 1, formula: true },
          { value: tasks[1]!.expected, formula: false },
          { value: null, formula: false },
        ],
      });
    expect(mixed.status).toBe(200);
    const [a, b, c] = mixed.body.data.items;
    expect(a).toMatchObject({ verdict: 'salah', expected: tasks[0]!.expected, hint: tasks[0]!.hint });
    expect(b.verdict).toBe('tanpa-rumus');
    expect(b.expected).toBeUndefined();
    expect(c.verdict).toBe('kosong');
    expect(mixed.body.data.correct).toBe(0);
  });

  it('cek data latihan: isi permintaan divalidasi', async () => {
    const send = (body: unknown) =>
      request(app)
        .post('/api/datasets/kas-kecil/check')
        .set('x-user', 'premium')
        .send(body as object);
    expect((await send({ answers: [] })).status).toBe(400);
    expect((await send({ answers: [{ value: 1, formula: true }] })).status).toBe(400);
    expect((await send({})).status).toBe(400);
    expect((await request(app).post('/api/datasets/tidak-ada/check').set('x-user', 'premium').send({ answers: correct() })).status).toBe(
      404,
    );
  });
});

describe('rute cek worksheet', () => {
  const slug = 'rekap-penjualan';
  const keyCells = () =>
    worksheetKey(slug)!.map((k) => ({ sheet: k.sheet, ref: k.ref, value: k.expected as string | number, formula: k.formula }));

  it('semua worksheet punya sel kunci yang bisa dinilai', () => {
    for (const s of [
      'anggaran-bulanan',
      'rekap-penjualan',
      'stok-barang',
      'absensi-karyawan',
      'rekap-nilai-siswa',
      'latihan-if',
      'latihan-sumif-countif',
      'latihan-lookup',
      'latihan-merapikan-data',
      'laporan-penjualan-mini',
      'gaji-lembur',
    ]) {
      const key = worksheetKey(s);
      expect(key, s).not.toBeNull();
      expect(key!.length, s).toBeGreaterThan(0);
      for (const k of key!) expect(k.expected, `${s} ${k.sheet}!${k.ref}`).not.toBeNull();
    }
    expect(worksheetKey('tidak-ada')).toBeNull();
  });

  it('wajib Premium; slug asing 404', async () => {
    expect((await request(app).post(`/api/worksheets/${slug}/check`).send({ cells: [] })).status).toBe(401);
    expect((await request(app).post(`/api/worksheets/${slug}/check`).set('x-user', 'free').send({ cells: keyCells() })).status).toBe(402);
    expect((await request(app).post('/api/worksheets/tidak-ada/check').set('x-user', 'premium').send({ cells: [] })).status).toBe(404);
  });

  it('semua sel benar menghasilkan nilai penuh', async () => {
    const res = await request(app).post(`/api/worksheets/${slug}/check`).set('x-user', 'premium').send({ cells: keyCells() });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(worksheetKey(slug)!.length);
    expect(res.body.data.correct).toBe(res.body.data.total);
  });

  it('sel salah, kosong, dan diketik langsung dibedakan', async () => {
    const cells = keyCells();
    const withFormula = cells.find((c) => c.formula)!;
    const rest = cells.filter((c) => c !== withFormula);
    const wrong = { ...rest[0]!, value: 12345 };
    const typed = { ...rest[1]!, formula: false };
    const res = await request(app)
      .post(`/api/worksheets/${slug}/check`)
      .set('x-user', 'premium')
      .send({ cells: [wrong, typed, ...rest.slice(3)] });
    const by = (ref: string) => res.body.data.items.find((i: { ref: string }) => i.ref === ref);
    expect(by(wrong.ref).verdict).toBe('salah');
    expect(by(wrong.ref).expected).toBe(rest[0]!.value);
    expect(by(typed.ref).verdict).toBe('tanpa-rumus');
    expect(by(rest[2]!.ref).verdict).toBe('kosong');
    expect(res.body.data.correct).toBeLessThan(res.body.data.total);
  });

  it('referensi sel yang aneh ditolak', async () => {
    const res = await request(app)
      .post(`/api/worksheets/${slug}/check`)
      .set('x-user', 'premium')
      .send({ cells: [{ sheet: 'Latihan', ref: '../etc', value: 1, formula: true }] });
    expect(res.status).toBe(400);
  });
});
