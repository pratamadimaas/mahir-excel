import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exercises, jakartaDate, placementQuestions, solutionCells } from '@excellab/shared';
import { createApp } from './app';
import { createPool, row } from './db/pool';
import { grantPremium, loginAdmin, registerUser, setupTestEnv, testConfig, type Session, type TestEnv } from './testutil';

let env: TestEnv;
let member: Session;
beforeAll(async () => {
  env = await setupTestEnv();
  member = await registerUser(env.app, 'Siswa Tes');
});
afterAll(async () => {
  await env.close();
});

const sol = (slug: string): Record<string, string> => solutionCells(exercises.find((e) => e.slug === slug)!);

describe('health dan konten publik', () => {
  it('GET /api/health', async () => {
    const r = await request(env.app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('GET /api/modules mengembalikan 9 modul dengan pelajaran', async () => {
    const r = await member.agent.get('/api/modules');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(9);
    const total = r.body.data.reduce((n: number, m: { lessons: unknown[] }) => n + m.lessons.length, 0);
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it('GET /api/lessons/:slug memuat konten, navigasi, dan latihan', async () => {
    const r = await member.agent.get('/api/lessons/fungsi-sum');
    expect(r.status).toBe(200);
    expect(r.body.data.content.objectives.length).toBeGreaterThan(0);
    expect(r.body.data.prev.slug).toBe('proyek-merapikan-data-penjualan');
    expect(r.body.data.next.slug).toBe('average-min-max');
    expect(r.body.data.exercises.length).toBeGreaterThan(0);
  });

  it('pelajaran tidak ada -> 404 dengan format error konsisten', async () => {
    const r = await member.agent.get('/api/lessons/tidak-ada');
    expect(r.status).toBe(404);
    expect(r.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('slug tidak valid -> 400', async () => {
    const r = await member.agent.get('/api/lessons/..%2F..%2Fetc');
    expect([400, 404]).toContain(r.status);
  });

  it('daftar latihan mendukung filter dan paginasi', async () => {
    const all = await member.agent.get('/api/exercises?pageSize=5');
    expect(all.body.data).toHaveLength(5);
    expect(all.body.meta.total).toBe(exercises.length);
    const f = await member.agent.get('/api/exercises?difficulty=sulit&topic=logika');
    expect(f.body.data.every((e: { difficulty: string; topic: string }) => e.difficulty === 'sulit' && e.topic === 'logika')).toBe(true);
    expect((await member.agent.get('/api/exercises?difficulty=mustahil')).status).toBe(400);
  });

  it('detail latihan tidak membocorkan kunci jawaban', async () => {
    const r = await member.agent.get('/api/exercises/total-pengeluaran');
    expect(r.status).toBe(200);
    const text = JSON.stringify(r.body);
    expect(text).not.toContain('solution');
    expect(text).not.toContain('=SUM(B2:B6)');
    expect(r.body.data.editable).toEqual(['B7']);
  });

  it('pintasan dapat dicari dan difilter', async () => {
    const all = await member.agent.get('/api/shortcuts');
    expect(all.body.data.length).toBeGreaterThanOrEqual(40);
    const q = await member.agent.get('/api/shortcuts?q=filter');
    expect(q.body.data.length).toBeGreaterThan(0);
    const mac = await member.agent.get('/api/shortcuts?platform=mac&category=navigasi');
    expect(mac.body.data.every((s: { keysMac: string | null }) => s.keysMac)).toBe(true);
    // Karakter wildcard LIKE dari pengguna tidak boleh cocok dengan semuanya.
    const wild = await member.agent.get('/api/shortcuts?q=%25');
    expect(wild.body.data.length).toBeLessThan(all.body.data.length);
  });

  it('tantangan harian deterministik', async () => {
    const a = await member.agent.get('/api/challenges/today');
    const b = await member.agent.get('/api/challenges/today');
    expect(a.body.data.exercise.slug).toBe(b.body.data.exercise.slug);
    expect(JSON.stringify(a.body)).not.toContain('solution');
  });
});

describe('submit latihan', () => {
  it('jawaban benar: umpan balik, penjelasan, solusi, dan poin untuk pengguna yang masuk', async () => {
    const r = await member.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('X-CSRF-Token', member.csrf)
      .send({ cells: sol('total-pengeluaran') });
    expect(r.status).toBe(200);
    expect(r.body.data.correct).toBe(true);
    expect(r.body.data.explanation).toBeTruthy();
    expect(r.body.data.solution).toEqual(sol('total-pengeluaran'));
    expect(r.body.data.pointsAwarded).toBe(10);
  });

  it('tanpa login, materi dan pengiriman jawaban ditolak (401)', async () => {
    for (const url of [
      '/api/modules',
      '/api/lessons/index-match',
      '/api/exercises',
      '/api/exercises/total-pengeluaran',
      '/api/shortcuts',
      '/api/worksheets',
      '/api/worksheets/anggaran-bulanan/download',
      '/api/challenges/today',
    ])
      expect((await request(env.app).get(url)).status, url).toBe(401);
    const r = await request(env.app)
      .post('/api/exercises/total-pengeluaran/submit')
      .send({ cells: sol('total-pengeluaran') });
    expect(r.status).toBe(401);
  });

  it('pelajaran contoh terbuka tanpa login, pelajaran lain tidak', async () => {
    const open = await request(env.app).get('/api/lessons/fungsi-sum');
    expect(open.status).toBe(200);
    expect(open.body.data.content.objectives.length).toBeGreaterThan(0);
    expect((await request(env.app).get('/api/lessons/index-match')).status).toBe(401);
    // Hanya GET pelajaran contoh yang dibuka; latihan di dalamnya tetap butuh login.
    expect((await request(env.app).get('/api/exercises/total-pengeluaran')).status).toBe(401);
    expect((await request(env.app).get('/api/lessons/fungsi-sum/../index-match')).status).toBe(401);
    const list = await request(env.app).get('/api/public/lessons');
    expect(list.status).toBe(200);
    expect(list.body.data.map((l: { slug: string }) => l.slug)).toEqual(
      expect.arrayContaining(['fungsi-sum', 'fungsi-if', 'vlookup-dasar']),
    );
    expect(list.body.data).toHaveLength(5);
    expect(JSON.stringify(list.body)).not.toContain('content');
  });

  it('ringkasan publik untuk beranda: angka asli dari database, tanpa isi pelajaran', async () => {
    const r = await request(env.app).get('/api/public/overview');
    expect(r.status).toBe(200);
    const { counts, modules } = r.body.data;
    expect(counts.modules).toBe(modules.length);
    expect(counts.lessons).toBe(modules.reduce((n: number, m: { lessons: number }) => n + m.lessons, 0));
    expect(counts.exercises).toBe(exercises.length);
    expect(counts.functions).toBeGreaterThan(20);
    expect(counts.shortcuts).toBeGreaterThan(0);
    expect(counts.worksheets).toBeGreaterThan(0);
    expect(modules[0]).toEqual({
      slug: expect.any(String),
      title: expect.any(String),
      summary: expect.any(String),
      lessons: expect.any(Number),
      exercises: expect.any(Number),
    });
    expect(JSON.stringify(r.body)).not.toMatch(/objectives|sections|solution/);
  });

  it('jawaban salah: penjelasan tanpa membuka solusi', async () => {
    const r = await member.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('X-CSRF-Token', member.csrf)
      .send({ cells: { B7: '=SUM(B2:B5)' } });
    expect(r.body.data.correct).toBe(false);
    expect(r.body.data.solution).toBeUndefined();
    expect(r.body.data.explanation).toBeUndefined();
    expect(r.body.data.targets[0].message).toBeTruthy();
  });

  it('payload tidak valid ditolak', async () => {
    const bad = [{}, { cells: 'x' }, { cells: { B7: 5 } }, { cells: { B7: 'x'.repeat(600) } }];
    for (const body of bad) {
      const r = await member.agent.post('/api/exercises/total-pengeluaran/submit').set('X-CSRF-Token', member.csrf).send(body);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
    }
    const notJson = await member.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('X-CSRF-Token', member.csrf)
      .set('Content-Type', 'application/json')
      .send('{bukan json');
    expect(notJson.status).toBe(400);
  });

  it('latihan tidak ada -> 404', async () => {
    const r = await member.agent.post('/api/exercises/tidak-ada/submit').set('X-CSRF-Token', member.csrf).send({ cells: {} });
    expect(r.status).toBe(404);
  });

  it('reveal: akun gratis dapat satu solusi per minggu, Premium tanpa batas, dan tanpa poin', async () => {
    const first = await member.agent.post('/api/exercises/total-pengeluaran/reveal').set('X-CSRF-Token', member.csrf);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ free: true, pointsAwarded: 0 });
    const denied = await member.agent.post('/api/exercises/total-harga-barang/reveal').set('X-CSRF-Token', member.csrf);
    expect(denied.status).toBe(402);
    expect(denied.body.error.code).toBe('PREMIUM_REQUIRED');
    const prem = await registerUser(env.app);
    await grantPremium(env, prem.userId);
    const r = await prem.agent.post('/api/exercises/total-pengeluaran/reveal').set('X-CSRF-Token', prem.csrf);
    expect(r.status).toBe(200);
    expect(r.body.data.pointsAwarded).toBe(0);
    expect(r.body.data.solution).toEqual(sol('total-pengeluaran'));
  });

  it('formula tidak didukung dikembalikan sebagai umpan balik, bukan galat server', async () => {
    const r = await member.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('X-CSRF-Token', member.csrf)
      .send({ cells: { B7: '=EVAL("1+1")' } });
    expect(r.status).toBe(200);
    expect(r.body.data.correct).toBe(false);
    expect(r.body.data.targets[0].message).toContain('#NAME?');
  });
});

describe('autentikasi', () => {
  it('validasi registrasi', async () => {
    const bad = [
      { email: 'bukan-email', password: 'sandi-aman-123', displayName: 'A' },
      { email: 'a@b.co', password: 'pendek', displayName: 'A' },
      { email: 'a@b.co', password: 'x'.repeat(73), displayName: 'A' },
      { email: 'a@b.co', password: 'sandi-aman-123', displayName: '' },
    ];
    for (const body of bad) {
      const r = await request(env.app).post('/api/auth/register').send(body);
      expect(r.status).toBe(400);
    }
  });

  it('registrasi menyimpan hash (bukan plaintext), mengeset cookie aman, dan menolak email ganda', async () => {
    const s = await registerUser(env.app);
    const u = await row<{ password_hash: string }>(env.db, 'SELECT password_hash FROM users WHERE id=?', [s.userId]);
    expect(u!.password_hash).toMatch(/^\$2[aby]\$/);
    expect(u!.password_hash).not.toContain('sandi-aman-123');

    const dup = await request(env.app)
      .post('/api/auth/register')
      .send({ email: s.email.toUpperCase(), password: 'sandi-aman-123', displayName: 'X' });
    expect(dup.status).toBe(409);

    const login = await request(env.app).post('/api/auth/login').send({ email: s.email, password: 'sandi-aman-123' });
    const cookies = (login.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/excellab_session=[^;]+;.*HttpOnly/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
    expect(cookies).toMatch(/excellab_csrf=/);
    expect(JSON.stringify(login.body)).not.toContain('password_hash');
  });

  it('login salah -> 401 dengan pesan generik', async () => {
    const s = await registerUser(env.app);
    const wrongPw = await request(env.app).post('/api/auth/login').send({ email: s.email, password: 'salah-salah-1' });
    const noUser = await request(env.app).post('/api/auth/login').send({ email: 'tidak-ada@example.com', password: 'salah-salah-1' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(noUser.body.error.message);
  });

  it('me, logout', async () => {
    const s = await registerUser(env.app);
    expect((await s.agent.get('/api/auth/me')).body.data.user.email).toBe(s.email);
    expect((await request(env.app).get('/api/auth/me')).body.data.user).toBeNull();
    const out = await s.agent.post('/api/auth/logout').set('x-csrf-token', s.csrf);
    expect(out.status).toBe(200);
    expect((await s.agent.get('/api/auth/me')).body.data.user).toBeNull();
  });

  it('hapus akun: butuh kata sandi, menghapus progres (cascade)', async () => {
    const s = await registerUser(env.app);
    await s.agent.put('/api/progress').set('x-csrf-token', s.csrf).send({ lessonSlug: 'fungsi-sum', completed: true });
    const wrong = await s.agent.delete('/api/auth/account').set('x-csrf-token', s.csrf).send({ password: 'salah-salah-1' });
    expect(wrong.status).toBe(401);
    const ok = await s.agent.delete('/api/auth/account').set('x-csrf-token', s.csrf).send({ password: 'sandi-aman-123' });
    expect(ok.status).toBe(200);
    expect(await row(env.db, 'SELECT id FROM users WHERE id=?', [s.userId])).toBeUndefined();
    expect(await row(env.db, 'SELECT user_id FROM lesson_progress WHERE user_id=?', [s.userId])).toBeUndefined();
    expect((await request(env.app).delete('/api/auth/account').send({ password: 'x' })).status).toBe(401);
  });

  it('token sesi rusak diperlakukan anonim', async () => {
    const r = await request(env.app).get('/api/progress').set('Cookie', 'excellab_session=bukan.token.valid');
    expect(r.status).toBe(401);
  });

  it('CSRF: permintaan yang mengubah data tanpa token ditolak', async () => {
    const s = await registerUser(env.app);
    const noToken = await s.agent.put('/api/progress').send({ lessonSlug: 'fungsi-sum', completed: true });
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('CSRF_INVALID');
    const wrong = await s.agent.put('/api/progress').set('x-csrf-token', 'salah').send({ lessonSlug: 'fungsi-sum', completed: true });
    expect(wrong.status).toBe(403);
    const ok = await s.agent.put('/api/progress').set('x-csrf-token', s.csrf).send({ lessonSlug: 'fungsi-sum', completed: true });
    expect(ok.status).toBe(200);
  });

  it('pembatasan laju pada endpoint sensitif', async () => {
    const config = testConfig({ RATE_LIMIT_ENABLED: 'true' });
    const app = createApp(createPool(config), config);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await request(app).post('/api/auth/register').send({})).status;
    expect(last).toBe(429);
  });
});

describe('progres pengguna', () => {
  it('endpoint progres membutuhkan login', async () => {
    for (const [method, url] of [
      ['get', '/api/progress'],
      ['get', '/api/progress/review'],
      ['post', '/api/progress/sync'],
      ['put', '/api/progress'],
    ] as const) {
      const r = await request(env.app)[method](url);
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('poin hanya diberikan sekali walau submit diulang atau bersamaan', async () => {
    const s = await registerUser(env.app);
    const post = () =>
      s.agent
        .post('/api/exercises/total-pengeluaran/submit')
        .set('x-csrf-token', s.csrf)
        .send({ cells: sol('total-pengeluaran') });
    const results = await Promise.all([post(), post(), post()]);
    const awarded = results.map((r) => r.body.data.pointsAwarded as number);
    expect(awarded.filter((p) => p > 0)).toHaveLength(1);
    const again = await post();
    expect(again.body.data.pointsAwarded).toBe(0);
    expect(again.body.data.alreadyCompleted).toBe(true);
    const prog = await s.agent.get('/api/progress');
    expect(prog.body.data.totalPoints).toBe(10);
    expect(prog.body.data.exercises['total-pengeluaran']).toBeTruthy();
    expect(prog.body.data.streak.current).toBe(1);
  });

  it('jawaban salah masuk tinjauan, hilang setelah benar', async () => {
    const s = await registerUser(env.app);
    await s.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('x-csrf-token', s.csrf)
      .send({ cells: { B7: '=SUM(B2:B5)' } });
    let review = await s.agent.get('/api/progress/review');
    expect(review.body.data).toHaveLength(1);
    expect(review.body.data[0].slug).toBe('total-pengeluaran');
    await s.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('x-csrf-token', s.csrf)
      .send({ cells: sol('total-pengeluaran') });
    review = await s.agent.get('/api/progress/review');
    expect(review.body.data).toHaveLength(0);
  });

  it('sinkronisasi: poin dari definisi server, slug asing dilewati, idempoten', async () => {
    const s = await registerUser(env.app);
    const dayOffset = (n: number): string => jakartaDate(new Date(Date.now() - n * 86_400_000));
    const [d1, d2] = [dayOffset(2), dayOffset(1)];
    const snapshot = {
      version: 1,
      completedLessons: ['fungsi-sum', 'tidak-ada'],
      exercises: { 'total-pengeluaran': { completedAt: '2025-01-01T00:00:00.000Z', attempts: 2, points: 99999 }, hantu: { attempts: 1 } },
      reviews: { 'statistik-nilai': { at: '2025-01-01T00:00:00.000Z', message: 'Rumus belum tepat' } },
      activeDays: [d1, d2, '2999-01-01', 'bukan-tanggal'],
    };
    const first = await s.agent.post('/api/progress/sync').set('x-csrf-token', s.csrf).send({ snapshot });
    expect(first.status).toBe(400); // 'bukan-tanggal' ditolak oleh validasi
    snapshot.activeDays = [d1, d2, '2999-01-01'];
    const r1 = await s.agent.post('/api/progress/sync').set('x-csrf-token', s.csrf).send({ snapshot });
    expect(r1.status).toBe(200);
    expect(r1.body.data.imported).toMatchObject({ lessons: 1, exercises: 1, pointsAdded: 10, skipped: 2 });
    expect(r1.body.data.progress.totalPoints).toBe(10);
    expect(r1.body.data.progress.activeDays).toEqual([d1, d2]);
    expect(r1.body.data.progress.reviews['statistik-nilai']).toBeTruthy();
    const r2 = await s.agent.post('/api/progress/sync').set('x-csrf-token', s.csrf).send({ snapshot });
    expect(r2.body.data.imported).toMatchObject({ lessons: 0, exercises: 0, pointsAdded: 0 });
    expect(r2.body.data.progress.totalPoints).toBe(10);
  });

  it('pengguna tidak dapat melihat atau mengubah progres pengguna lain', async () => {
    const a = await registerUser(env.app, 'A');
    const b = await registerUser(env.app, 'B');
    await a.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('x-csrf-token', a.csrf)
      .send({ cells: sol('total-pengeluaran') });
    await a.agent.put('/api/progress').set('x-csrf-token', a.csrf).send({ lessonSlug: 'fungsi-sum', completed: true });
    const viewB = await b.agent.get('/api/progress');
    expect(viewB.body.data.totalPoints).toBe(0);
    expect(viewB.body.data.completedLessons).toEqual([]);
    const viewA = await a.agent.get('/api/progress');
    expect(viewA.body.data.totalPoints).toBe(10);
    // Tidak ada parameter user id yang dapat dimanipulasi.
    const hack = await b.agent.get(`/api/progress?userId=${a.userId}`);
    expect(hack.body.data.totalPoints).toBe(0);
  });

  it('PUT progres idempoten dan dapat dibatalkan', async () => {
    const s = await registerUser(env.app);
    const put = (completed: boolean) =>
      s.agent.put('/api/progress').set('x-csrf-token', s.csrf).send({ lessonSlug: 'fungsi-if', completed });
    expect((await put(true)).body.data.completedLessons).toEqual(['fungsi-if']);
    expect((await put(true)).body.data.completedLessons).toEqual(['fungsi-if']);
    expect((await put(false)).body.data.completedLessons).toEqual([]);
    const bad = await s.agent.put('/api/progress').set('x-csrf-token', s.csrf).send({ lessonSlug: 'tidak-ada', completed: true });
    expect(bad.status).toBe(404);
  });
});

describe('administrasi', () => {
  it('anonim 401, pengguna biasa 403', async () => {
    expect((await request(env.app).get('/api/admin/lessons')).status).toBe(401);
    const user = await registerUser(env.app);
    expect((await user.agent.get('/api/admin/lessons')).status).toBe(403);
    expect((await user.agent.get('/api/admin/stats')).status).toBe(403);
    const create = await user.agent
      .post('/api/admin/modules')
      .set('x-csrf-token', user.csrf)
      .send({ slug: 'x', title: 'x', summary: 'x', sortOrder: 1, published: true });
    expect(create.status).toBe(403);
  });

  it('admin mengelola modul dan pelajaran; unpublish menyembunyikan dari publik', async () => {
    const admin = await loginAdmin(env.app);
    const h = (r: request.Test) => r.set('x-csrf-token', admin.csrf);

    const mod = await h(admin.agent.post('/api/admin/modules')).send({
      slug: 'modul-tes',
      title: 'Modul Tes',
      summary: 'Ringkasan',
      sortOrder: 99,
      published: true,
    });
    expect(mod.status).toBe(201);
    const dup = await h(admin.agent.post('/api/admin/modules')).send({
      slug: 'modul-tes',
      title: 'Modul Tes',
      summary: 'Ringkasan',
      sortOrder: 99,
      published: true,
    });
    expect(dup.status).toBe(409);

    const lessonBody = {
      moduleSlug: 'modul-tes',
      slug: 'pelajaran-tes',
      title: 'Pelajaran Tes',
      summary: 'Ringkas',
      minutes: 5,
      sortOrder: 1,
      published: true,
      content: {
        objectives: ['Tujuan'],
        sections: [{ heading: 'Bagian', paragraphs: ['Isi'] }],
        example: {
          title: 'Contoh',
          description: 'Desk',
          table: [
            ['A', 'B'],
            [1, 2],
          ],
          formula: '=A2+B2',
          result: '3',
          walkthrough: 'Jumlahkan',
        },
        mistakes: [{ title: 'Salah', detail: 'Detail' }],
        quiz: [{ question: 'Q?', options: ['a', 'b'], answerIndex: 1, explanation: 'Karena b' }],
      },
    };
    const created = await h(admin.agent.post('/api/admin/lessons')).send(lessonBody);
    expect(created.status).toBe(201);
    expect((await member.agent.get('/api/lessons/pelajaran-tes')).status).toBe(200);

    const bad = await h(admin.agent.post('/api/admin/lessons')).send({
      ...lessonBody,
      slug: 'x2',
      content: { ...lessonBody.content, quiz: [{ question: 'Q', options: ['a', 'b'], answerIndex: 5, explanation: 'x' }] },
    });
    expect(bad.status).toBe(400);

    const id = created.body.data.id as number;
    const unpublished = await h(admin.agent.put(`/api/admin/lessons/${id}`)).send({ ...lessonBody, published: false });
    expect(unpublished.status).toBe(200);
    expect((await member.agent.get('/api/lessons/pelajaran-tes')).status).toBe(404);
    // Admin dapat pratinjau konten yang belum terbit; anonim tidak.
    expect((await admin.agent.get('/api/lessons/pelajaran-tes?preview=1')).status).toBe(200);
    expect((await member.agent.get('/api/lessons/pelajaran-tes?preview=1')).status).toBe(404);

    // Modul yang masih punya pelajaran tidak bisa dihapus.
    const delMod = await h(admin.agent.delete(`/api/admin/modules/${mod.body.data.id}`));
    expect(delMod.status).toBe(409);
    expect((await h(admin.agent.delete(`/api/admin/lessons/${id}`))).status).toBe(200);
    expect((await h(admin.agent.delete(`/api/admin/modules/${mod.body.data.id}`))).status).toBe(200);

    const logs = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM admin_audit_logs WHERE admin_id=?', [admin.userId]);
    expect(Number(logs!.n)).toBeGreaterThanOrEqual(5);
  });

  it('latihan dengan jawaban acuan yang salah ditolak; yang benar dapat dikerjakan', async () => {
    const admin = await loginAdmin(env.app);
    const h = (r: request.Test) => r.set('x-csrf-token', admin.csrf);
    const base = {
      slug: 'latihan-admin',
      title: 'Latihan Admin',
      description: 'Deskripsi',
      topic: 'rumus-dasar',
      difficulty: 'mudah',
      rows: 5,
      cols: 3,
      cells: { A1: '1', A2: '2' },
      editable: ['A3'],
      task: 'Jumlahkan A1 dan A2 di A3',
      hints: ['Gunakan SUM'],
      explanation: 'Karena SUM menjumlahkan',
      points: 10,
      lessonSlug: null,
      sortOrder: 100,
      published: true,
      validation: { targets: [{ cell: 'A3', solution: '=SUM(A1:A2)', requireFunction: 'SUM' }] },
    };
    const broken = await h(admin.agent.post('/api/admin/exercises')).send({
      ...base,
      validation: { targets: [{ cell: 'A3', solution: '=KACAU(' }] },
    });
    expect(broken.status).toBe(400);
    expect(broken.body.error.message).toContain('Jawaban acuan');
    const ok = await h(admin.agent.post('/api/admin/exercises')).send(base);
    expect(ok.status).toBe(201);
    const submit = await member.agent
      .post('/api/exercises/latihan-admin/submit')
      .set('X-CSRF-Token', member.csrf)
      .send({ cells: { A3: '=SUM(A1:A2)' } });
    expect(submit.body.data.correct).toBe(true);
    await h(admin.agent.delete(`/api/admin/exercises/${ok.body.data.id}`));
  });

  it('statistik agregat', async () => {
    const admin = await loginAdmin(env.app);
    const r = await admin.agent.get('/api/admin/stats');
    expect(r.status).toBe(200);
    expect(r.body.data.users).toBeGreaterThan(1);
    expect(r.body.data.publishedExercises).toBe(exercises.length);
    expect(Array.isArray(r.body.data.exerciseUsage)).toBe(true);
  });

  it('sumber daya admin tidak dikenal -> 404 dan paginasi', async () => {
    const admin = await loginAdmin(env.app);
    expect((await admin.agent.get('/api/admin/tidak-ada')).status).toBe(404);
    const page = await admin.agent.get('/api/admin/shortcuts?page=2&pageSize=10');
    expect(page.body.data).toHaveLength(10);
    expect(page.body.meta).toMatchObject({ page: 2, pageSize: 10 });
  });
});

describe('unduhan worksheet', () => {
  it('daftar dan detail menyertakan ukuran file', async () => {
    const list = await member.agent.get('/api/worksheets');
    expect(list.body.data).toHaveLength(11);
    expect(list.body.data.every((w: { available: boolean; fileSize: number }) => w.available && w.fileSize > 1000)).toBe(true);
    const one = await member.agent.get('/api/worksheets/anggaran-bulanan');
    expect(one.body.data).toMatchObject({ fileType: 'xlsx', keyAvailable: true });
    expect(one.body.data.preview.rows[0][0]).toBe('Pemasukan');
  });

  it('kunci jawaban worksheet hanya untuk Premium; file latihan tetap untuk semua pengguna', async () => {
    const free = await registerUser(env.app);
    expect((await free.agent.get('/api/worksheets/anggaran-bulanan/download')).status).toBe(200);
    const denied = await free.agent.get('/api/worksheets/anggaran-bulanan/download?answer=1');
    expect(denied.status).toBe(402);
    expect(denied.body.error.code).toBe('PREMIUM_REQUIRED');
    await grantPremium(env, free.userId);
    expect((await free.agent.get('/api/worksheets/anggaran-bulanan/download?answer=1')).status).toBe(200);
  });

  it('semua worksheet gratis diunduh; hanya kunci jawabannya khusus Premium', async () => {
    const free = await registerUser(env.app);
    const list = await free.agent.get('/api/worksheets');
    const flags = Object.fromEntries((list.body.data as { slug: string; premiumOnly: boolean }[]).map((w) => [w.slug, w.premiumOnly]));
    expect(Object.values(flags).every((p) => !p)).toBe(true);
    expect(Object.keys(flags)).toHaveLength(11);
    expect((await free.agent.get('/api/worksheets/absensi-karyawan/download')).status).toBe(200);
    const denied = await free.agent.get('/api/worksheets/absensi-karyawan/download?answer=1');
    expect(denied.status).toBe(402);
    expect(denied.body.error.code).toBe('PREMIUM_REQUIRED');
  });

  it('semua tautan unduhan mengarah ke file .xlsx yang valid', async () => {
    const premium = await registerUser(env.app);
    await grantPremium(env, premium.userId);
    const list = await premium.agent.get('/api/worksheets');
    for (const w of list.body.data as { slug: string }[]) {
      for (const query of ['', '?answer=1']) {
        const res = await premium.agent
          .get(`/api/worksheets/${w.slug}/download${query}`)
          .buffer(true)
          .parse((r, cb) => {
            const chunks: Buffer[] = [];
            r.on('data', (c: Buffer) => chunks.push(c));
            r.on('end', () => cb(null, Buffer.concat(chunks)));
          });
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toContain('attachment');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
        expect(wb.worksheets.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('file tidak ada -> 404, slug berbahaya ditolak', async () => {
    expect((await member.agent.get('/api/worksheets/tidak-ada/download')).status).toBe(404);
    const trav = await member.agent.get('/api/worksheets/..%2F..%2F.env/download');
    expect([400, 404]).toContain(trav.status);
  });

  it('admin tidak dapat mengarahkan file ke luar folder (nama file divalidasi)', async () => {
    const admin = await loginAdmin(env.app);
    const w = (await admin.agent.get('/api/admin/worksheets?pageSize=1')).body.data[0];
    const { id: _id, ...body } = w;
    const r = await admin.agent
      .put(`/api/admin/worksheets/${w.id}`)
      .set('x-csrf-token', admin.csrf)
      .send({ ...body, fileName: '../../.env' });
    expect(r.status).toBe(400);
  });
});

describe('penanganan galat database', () => {
  it('database mati -> 503 tanpa membocorkan detail', async () => {
    const config = testConfig({ DB_PORT: '1' });
    const db = createPool(config);
    const app = createApp(db, config);
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(503);
    const r = await request(app)
      .post('/api/placement')
      .send({ answers: Object.fromEntries(placementQuestions.map((q) => [q.id, q.answerIndex])) });
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|mysql/i);
    await db.end();
  });

  it('endpoint tidak dikenal -> 404 JSON', async () => {
    const r = await request(env.app).get('/api/tidak-ada');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });
});
