import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lessons } from '@excellab/shared';
import { seedContent } from './db/seed';
import { loginAdmin, setupTestEnv, type Session, type TestEnv } from './testutil';

let env: TestEnv;
let admin: Session;
const h = (r: request.Test) => r.set('x-csrf-token', admin.csrf);

beforeAll(async () => {
  env = await setupTestEnv();
  admin = await loginAdmin(env.app);
});
afterAll(async () => {
  await env.close();
});

type LessonItem = {
  id: number;
  slug: string;
  edited: boolean;
  hasDefault: boolean;
  summary: string;
  content: Record<string, unknown>;
  published: boolean;
};

async function lessonBySlug(slug: string): Promise<LessonItem> {
  const list = await admin.agent.get('/api/admin/lessons?pageSize=100');
  const item = (list.body.data as LessonItem[]).find((l) => l.slug === slug)!;
  const full = await admin.agent.get(`/api/admin/lessons/${item.id}`);
  return full.body.data as LessonItem;
}

const SLUG = 'fungsi-sum';
const bundled = lessons.find((l) => l.slug === SLUG)!;

describe('pelajaran yang diubah lewat admin', () => {
  it('pelajaran bawaan belum diedit dan punya versi bawaan', async () => {
    const l = await lessonBySlug(SLUG);
    expect(l.edited).toBe(false);
    expect(l.hasDefault).toBe(true);
  });

  it('menerbitkan atau menyembunyikan tidak menandai pelajaran sebagai diedit', async () => {
    const l = await lessonBySlug(SLUG);
    const r = await h(admin.agent.put(`/api/admin/lessons/${l.id}`)).send({ ...l, published: false });
    expect(r.status).toBe(200);
    expect(r.body.data.edited).toBe(false);
    await h(admin.agent.put(`/api/admin/lessons/${l.id}`)).send({ ...l, published: true });
  });

  it('mengubah teks menandai diedit, tampil ke pengguna, dan tidak ditimpa seed', async () => {
    const l = await lessonBySlug(SLUG);
    const changed = { ...l, summary: 'Ringkasan hasil edit di admin.' };
    const r = await h(admin.agent.put(`/api/admin/lessons/${l.id}`)).send(changed);
    expect(r.status).toBe(200);
    expect(r.body.data.edited).toBe(true);

    const pub = await admin.agent.get(`/api/lessons/${SLUG}`);
    expect(pub.body.data.summary).toBe('Ringkasan hasil edit di admin.');

    await seedContent(env.db);
    const after = await lessonBySlug(SLUG);
    expect(after.summary).toBe('Ringkasan hasil edit di admin.');
    expect(after.edited).toBe(true);
  });

  it('pelajaran lain yang tidak diedit tetap mengikuti kode saat seed', async () => {
    const other = lessons.find((l) => l.slug !== SLUG)!;
    const l = await lessonBySlug(other.slug);
    expect(l.edited).toBe(false);
    expect(l.summary).toBe(other.summary);
  });

  it('kembalikan ke bawaan mengisi ulang dari kode dan melepas tanda diedit', async () => {
    const l = await lessonBySlug(SLUG);
    const r = await h(admin.agent.post(`/api/admin/lessons/${l.id}/reset`)).send({});
    expect(r.status).toBe(200);
    expect(r.body.data.edited).toBe(false);
    expect(r.body.data.summary).toBe(bundled.summary);
    expect(r.body.data.content).toEqual(JSON.parse(JSON.stringify(bundled.content)));

    // Setelah dikembalikan, seed kembali mengikuti kode.
    await seedContent(env.db);
    expect((await lessonBySlug(SLUG)).summary).toBe(bundled.summary);
  });

  it('pelajaran buatan admin tidak punya versi bawaan dan tidak bisa dikembalikan', async () => {
    const mod = await admin.agent.get('/api/admin/modules');
    const moduleSlug = (mod.body.data as { slug: string }[])[0]!.slug;
    const created = await h(admin.agent.post('/api/admin/lessons')).send({
      moduleSlug,
      slug: 'pelajaran-buatan-admin',
      title: 'Pelajaran buatan admin',
      summary: 'Ringkas.',
      minutes: 5,
      sortOrder: 999,
      published: false,
      content: {
        objectives: ['Tujuan'],
        sections: [{ heading: 'Bagian', paragraphs: ['Isi.'] }],
        example: { title: 'Contoh', description: 'Deskripsi', table: [['A'], [1]], formula: '=A2', result: '1', walkthrough: 'Langkah.' },
        mistakes: [{ title: 'Salah', detail: 'Karena.' }],
        quiz: [{ question: 'Q?', options: ['a', 'b'], answerIndex: 0, explanation: 'E.' }],
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.hasDefault).toBe(false);
    const r = await h(admin.agent.post(`/api/admin/lessons/${created.body.data.id}/reset`)).send({});
    expect(r.status).toBe(400);
    await h(admin.agent.delete(`/api/admin/lessons/${created.body.data.id}`));
  });

  it('pelajaran tidak ada dan pengguna biasa ditolak', async () => {
    expect((await h(admin.agent.post('/api/admin/lessons/999999/reset')).send({})).status).toBe(404);
    const noAuth = await admin.agent.post('/api/admin/lessons/1/reset').send({});
    expect(noAuth.status).toBeGreaterThanOrEqual(400);
  });

  it('penanda pelajaran panduan tidak hilang saat disimpan dari admin', async () => {
    const guideSlug = lessons.find((l) => l.content.guide)!.slug;
    const l = await lessonBySlug(guideSlug);
    expect(l.content.guide).toBe(true);
    const r = await h(admin.agent.put(`/api/admin/lessons/${l.id}`)).send({ ...l, summary: `${l.summary} `.trim() });
    expect(r.status).toBe(200);
    expect(r.body.data.content.guide).toBe(true);
  });
});
