import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exercises, modules, solutionCells, templates } from '@excellab/shared';
import { grantPremium, registerUser, setupTestEnv, type Session, type TestEnv } from './testutil';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

const binary = (res: request.Response, done: (err: Error | null, body: Buffer) => void): void => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};
const get = (s: Session, url: string) => s.agent.get(url).buffer(true).parse(binary);
const submit = (s: Session, slug: string, cells: Record<string, string>) =>
  s.agent.post(`/api/exercises/${slug}/submit`).set('X-CSRF-Token', s.csrf).send({ cells });

const free = templates.find((t) => t.free)!;
const paid = templates.find((t) => !t.free)!;

describe('template .xlsx', () => {
  it('daftar terbuka untuk umum dan menandai yang khusus Premium', async () => {
    const res = await request(env.app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(templates.length);
    expect(res.body.data.filter((t: { premiumOnly: boolean }) => !t.premiumOnly)).toHaveLength(2);
  });

  it('unduhan wajib login; template gratis terbuka, template Premium ditolak untuk akun gratis', async () => {
    expect((await request(env.app).get(`/api/templates/${free.slug}/download`)).status).toBe(401);
    const s = await registerUser(env.app);
    const ok = await get(s, `/api/templates/${free.slug}/download`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('spreadsheetml');
    expect((ok.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    const denied = await get(s, `/api/templates/${paid.slug}/download`);
    expect(denied.status).toBe(402);
    expect((await get(s, '/api/templates/tidak-ada/download')).status).toBe(404);
  });

  it('akun Premium bisa mengunduh semua template', async () => {
    const s = await registerUser(env.app);
    await grantPremium(env, s.userId);
    for (const t of templates) {
      const res = await get(s, `/api/templates/${t.slug}/download`);
      expect(res.status, t.slug).toBe(200);
      expect((res.body as Buffer).length).toBeGreaterThan(5000);
    }
  });
});

describe('jalur belajar', () => {
  it('daftar dan rincian terbuka tanpa login, dihitung dari kurikulum', async () => {
    const list = await request(env.app).get('/api/paths');
    expect(list.status).toBe(200);
    expect(list.body.data.map((p: { slug: string }) => p.slug)).toEqual(['perkantoran-admin', 'admin-hrd', 'jualan-usaha', 'keuangan-dasar']);
    const admin = list.body.data[0];
    expect(admin.lessons).toBeGreaterThanOrEqual(8);
    expect(admin.minutes).toBeGreaterThan(admin.lessons);
    expect(admin.lessonSlugs).toHaveLength(admin.lessons);
    const one = await request(env.app).get('/api/paths/perkantoran-admin');
    expect(one.status).toBe(200);
    expect(one.body.data.steps[0]).toMatchObject({ slug: 'sel-baris-kolom-rentang', publicLesson: true });
    expect(one.body.data.steps.every((s: { title: string; minutes: number }) => s.title && s.minutes > 0)).toBe(true);
    expect(one.body.data.templates.some((t: { free: boolean }) => t.free)).toBe(true);
    expect((await request(env.app).get('/api/paths/tidak-ada')).status).toBe(404);
  });
});

describe('lembar contekan PDF', () => {
  it('daftar modul untuk pengguna masuk, PDF khusus Premium', async () => {
    const free1 = await registerUser(env.app);
    const list = await free1.agent.get('/api/cheatsheets');
    expect(list.body.data).toHaveLength(modules.length);
    expect(list.body.data.every((m: { lessons: number }) => m.lessons > 0)).toBe(true);
    expect((await get(free1, `/api/cheatsheets/${modules[0]!.slug}/download`)).status).toBe(402);

    const prem = await registerUser(env.app);
    await grantPremium(env, prem.userId);
    for (const m of modules) {
      const res = await get(prem, `/api/cheatsheets/${m.slug}/download`);
      expect(res.status, m.slug).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    }
    expect((await get(prem, '/api/cheatsheets/tidak-ada/download')).status).toBe(404);
  });
});

describe('laporan kemajuan', () => {
  it('ditolak untuk akun gratis dan tanpa login', async () => {
    expect((await request(env.app).get('/api/progress/report')).status).toBe(401);
    const s = await registerUser(env.app);
    expect((await s.agent.get('/api/progress/report')).status).toBe(402);
  });

  it('akun baru: belum ada data, rekomendasi berasal dari awal kurikulum', async () => {
    const s = await registerUser(env.app);
    await grantPremium(env, s.userId);
    const r = (await s.agent.get('/api/progress/report')).body.data;
    expect(r.summary).toMatchObject({ completed: 0, attempts: 0, accuracy: null });
    expect(r.summary.totalExercises).toBe(exercises.length);
    expect(r.topics.every((t: { level: string }) => t.level === 'belum-mulai')).toBe(true);
    expect(r.weakest).toEqual([]);
    expect(r.recommendations).toHaveLength(3);
  });

  it('topik yang sering salah muncul sebagai terlemah dengan rekomendasi latihan yang belum selesai', async () => {
    const s = await registerUser(env.app);
    await grantPremium(env, s.userId);
    const weakTopic = exercises[0]!.topic;
    const inTopic = exercises.filter((e) => e.topic === weakTopic);
    const [a, b] = inTopic as [(typeof inTopic)[number], (typeof inTopic)[number]];
    // Tiga kali salah di latihan pertama, lalu benar sekali; latihan kedua tetap belum dicoba.
    for (let i = 0; i < 3; i++) expect((await submit(s, a.slug, {})).body.data.correct).toBe(false);
    expect((await submit(s, a.slug, solutionCells(a))).body.data.correct).toBe(true);
    // Topik lain: langsung benar.
    const other = exercises.find((e) => e.topic !== weakTopic)!;
    expect((await submit(s, other.slug, solutionCells(other))).body.data.correct).toBe(true);

    const r = (await s.agent.get('/api/progress/report')).body.data;
    const t = r.topics.find((x: { topic: string }) => x.topic === weakTopic);
    expect(t).toMatchObject({ attempts: 4, correctAttempts: 1, completed: 1 });
    expect(t.accuracy).toBeCloseTo(0.25, 5);
    expect(t.level).toBe('perlu-latihan');
    expect(r.weakest[0]).toBe(weakTopic);
    const rec = r.recommendations.filter((x: { topic: string }) => x.topic === weakTopic);
    expect(rec.length).toBeGreaterThan(0);
    expect(rec.map((x: { slug: string }) => x.slug)).not.toContain(a.slug); // sudah selesai
    expect(rec.map((x: { slug: string }) => x.slug)).toContain(b.slug);
    expect(r.summary).toMatchObject({ completed: 2, attempts: 5 });
    expect(r.topics.find((x: { topic: string }) => x.topic === other.topic).level).not.toBe('perlu-latihan');
  });
});
