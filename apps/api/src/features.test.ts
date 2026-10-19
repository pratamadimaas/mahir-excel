import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exercises, placementQuestions, solutionCells } from '@excellab/shared';
import { row, rows, run } from './db/pool';
import { grantPremium, loginAdmin, registerUser, setupTestEnv, type Session, type TestEnv } from './testutil';

let env: TestEnv;
let member: Session;
beforeAll(async () => {
  env = await setupTestEnv();
  member = await registerUser(env.app, 'Siswa Fitur');
});
afterAll(async () => {
  await env.close();
});
beforeEach(() => {
  env.mailer.outbox.length = 0;
});

const sol = (slug: string): Record<string, string> => solutionCells(exercises.find((e) => e.slug === slug)!);
const submit = (s: Session, slug: string, cells: Record<string, string>) =>
  s.agent.post(`/api/exercises/${slug}/submit`).set('x-csrf-token', s.csrf).send({ cells });
const WRONG = { B7: '=SUM(B2:B5)' };
const dueNow = (s: Session) => s.agent.get('/api/progress/review-due');
const makeDue = (s: Session) =>
  run(env.db, 'UPDATE review_schedule SET due_at = (UTC_TIMESTAMP() - INTERVAL 1 MINUTE) WHERE user_id = ?', [s.userId]);

describe('ulang terjadwal (spaced repetition)', () => {
  it('butuh login', async () => {
    expect((await request(env.app).get('/api/progress/review-due')).status).toBe(401);
  });

  it('jawaban salah langsung jatuh tempo, benar menaikkan box dan menjauhkan jadwal, salah lagi mengulang dari 0', async () => {
    const s = await registerUser(env.app);
    await submit(s, 'total-pengeluaran', WRONG);
    let r = await dueNow(s);
    expect(r.body.data.due).toHaveLength(1);
    expect(r.body.data.due[0]).toMatchObject({ slug: 'total-pengeluaran', box: 0 });

    await submit(s, 'total-pengeluaran', sol('total-pengeluaran'));
    r = await dueNow(s);
    expect(r.body.data.due).toHaveLength(0); // box 1: jatuh tempo 1 hari lagi
    expect(r.body.data.upcoming).toBe(1);
    expect(r.body.data.nextDueAt).toBeTruthy();
    const sched = await row<{ box: number; days: number }>(
      env.db,
      'SELECT box, DATEDIFF(due_at, UTC_TIMESTAMP()) AS days FROM review_schedule WHERE user_id = ?',
      [s.userId],
    );
    expect(sched).toMatchObject({ box: 1 });
    expect(Number(sched!.days)).toBeGreaterThanOrEqual(0);
    expect(Number(sched!.days)).toBeLessThanOrEqual(1);

    await makeDue(s);
    await submit(s, 'total-pengeluaran', sol('total-pengeluaran'));
    expect((await row<{ box: number }>(env.db, 'SELECT box FROM review_schedule WHERE user_id = ?', [s.userId]))!.box).toBe(2);
    const sched2 = await row<{ days: number }>(
      env.db,
      'SELECT DATEDIFF(due_at, UTC_TIMESTAMP()) AS days FROM review_schedule WHERE user_id = ?',
      [s.userId],
    );
    expect(Number(sched2!.days)).toBeGreaterThanOrEqual(2); // box 2 = 3 hari

    await submit(s, 'total-pengeluaran', WRONG);
    expect((await row<{ box: number }>(env.db, 'SELECT box FROM review_schedule WHERE user_id = ?', [s.userId]))!.box).toBe(0);
    expect((await dueNow(s)).body.data.due).toHaveLength(1);
  });

  it('latihan yang langsung benar tidak dijadwalkan; box tidak melebihi 5', async () => {
    const s = await registerUser(env.app);
    await submit(s, 'total-pengeluaran', sol('total-pengeluaran'));
    expect((await dueNow(s)).body.data.upcoming).toBe(0);
    await submit(s, 'total-pengeluaran', WRONG);
    for (let i = 0; i < 8; i++) {
      await submit(s, 'total-pengeluaran', sol('total-pengeluaran'));
    }
    expect((await row<{ box: number }>(env.db, 'SELECT box FROM review_schedule WHERE user_id = ?', [s.userId]))!.box).toBe(5);
  });

  it('jadwal tiap pengguna terpisah', async () => {
    const a = await registerUser(env.app);
    const b = await registerUser(env.app);
    await submit(a, 'total-pengeluaran', WRONG);
    expect((await dueNow(a)).body.data.due).toHaveLength(1);
    expect((await dueNow(b)).body.data.due).toHaveLength(0);
  });

  it('sinkronisasi mengimpor jadwal dengan batas wajar', async () => {
    const s = await registerUser(env.app);
    const snapshot = {
      version: 1,
      completedLessons: [],
      exercises: {},
      reviews: {},
      activeDays: [],
      schedule: {
        'total-pengeluaran': { box: 2, dueAt: new Date(Date.now() - 3600_000).toISOString() },
        'statistik-nilai': { box: 3, dueAt: '2999-01-01T00:00:00Z' },
        hantu: { box: 1, dueAt: new Date().toISOString() },
      },
    };
    const r = await s.agent.post('/api/progress/sync').set('x-csrf-token', s.csrf).send({ snapshot });
    expect(r.status).toBe(200);
    const list = await rows<{ slug: string; box: number }>(
      env.db,
      'SELECT e.slug, rs.box FROM review_schedule rs JOIN exercises e ON e.id = rs.exercise_id WHERE rs.user_id = ?',
      [s.userId],
    );
    expect(list.map((x) => x.slug).sort()).toEqual(['statistik-nilai', 'total-pengeluaran']);
    const due = (await dueNow(s)).body.data.due as { slug: string }[];
    expect(due.map((d) => d.slug).sort()).toEqual(['statistik-nilai', 'total-pengeluaran']); // tahun 2999 dianggap tidak wajar -> jatuh tempo sekarang
    const bad = await s.agent
      .post('/api/progress/sync')
      .set('x-csrf-token', s.csrf)
      .send({ snapshot: { ...snapshot, schedule: { 'total-pengeluaran': { box: 9, dueAt: 'x' } } } });
    expect(bad.status).toBe(400);
  });
});

describe('bagikan progres', () => {
  it('membuat tautan, ringkasan publik tanpa email, dan dapat dinonaktifkan', async () => {
    const s = await registerUser(env.app, 'Sari Berbagi');
    await submit(s, 'total-pengeluaran', sol('total-pengeluaran'));
    await s.agent.put('/api/progress').set('x-csrf-token', s.csrf).send({ lessonSlug: 'fungsi-sum', completed: true });

    expect((await s.agent.get('/api/progress/share')).body.data.token).toBeNull();
    const created = await s.agent.post('/api/progress/share').set('x-csrf-token', s.csrf);
    expect(created.status).toBe(201);
    const token = created.body.data.token as string;
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    // Token tetap sama bila dibuat lagi (tautan lama tidak mati).
    expect((await s.agent.post('/api/progress/share').set('x-csrf-token', s.csrf)).body.data.token).toBe(token);

    const pub = await request(env.app).get(`/api/share/${token}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.displayName).toBe('Sari Berbagi');
    expect(pub.body.data.totalPoints).toBe(10);
    expect(pub.body.data.lessons.done).toBe(1);
    expect(pub.body.data.modules.length).toBe(8);
    expect(JSON.stringify(pub.body)).not.toContain(s.email);

    const off = await s.agent.delete('/api/progress/share').set('x-csrf-token', s.csrf);
    expect(off.body.data.token).toBeNull();
    expect((await request(env.app).get(`/api/share/${token}`)).status).toBe(404);
  });

  it('token tidak valid ditolak dan endpoint kelola membutuhkan login serta CSRF', async () => {
    expect((await request(env.app).get('/api/share/bukan-token')).status).toBe(400);
    expect((await request(env.app).get(`/api/share/${'a'.repeat(32)}`)).status).toBe(404);
    expect((await request(env.app).post('/api/progress/share')).status).toBe(401);
    const s = await registerUser(env.app);
    expect((await s.agent.post('/api/progress/share')).status).toBe(403);
  });
});

describe('sertifikat penyelesaian', () => {
  // Sertifikat PDF adalah fitur Premium: pengguna uji diaktifkan Premium-nya lebih dulu.
  const premiumUser = async (name?: string): Promise<Session> => {
    const s = await registerUser(env.app, name);
    await grantPremium(env, s.userId);
    return s;
  };
  const completeModule = async (s: Session, moduleSlug: string): Promise<void> => {
    await run(
      env.db,
      `INSERT IGNORE INTO lesson_progress (user_id, lesson_id)
       SELECT ?, l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.slug = ? AND l.published = 1`,
      [s.userId, moduleSlug],
    );
  };
  const pdf = (s: Session, scope: string) =>
    s.agent
      .get(`/api/progress/certificate?scope=${scope}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  it('butuh login, cakupan valid, dan modul ada', async () => {
    expect((await request(env.app).get('/api/progress/certificate?scope=semua')).status).toBe(401);
    const s = await premiumUser();
    expect((await s.agent.get('/api/progress/certificate?scope=../etc')).status).toBe(400);
    expect((await s.agent.get('/api/progress/certificate')).status).toBe(400);
    expect((await s.agent.get('/api/progress/certificate?scope=modul-tidak-ada')).status).toBe(404);
  });

  it('tanpa Premium ditolak (402), verifikasi publik tetap gratis, dan admin selalu boleh', async () => {
    const free = await registerUser(env.app);
    await completeModule(free, 'mengenal-excel');
    const r = await free.agent.get('/api/progress/certificate?scope=mengenal-excel');
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe('PREMIUM_REQUIRED');
    expect((await free.agent.get('/api/auth/me')).body.data.user).toMatchObject({ premium: false, premiumUntil: null });
    // Premium kedaluwarsa tidak dihitung.
    await run(env.db, 'UPDATE users SET premium_until = (UTC_TIMESTAMP() - INTERVAL 1 DAY) WHERE id = ?', [free.userId]);
    expect((await free.agent.get('/api/progress/certificate?scope=mengenal-excel')).status).toBe(402);
    await grantPremium(env, free.userId, 1);
    expect((await free.agent.get('/api/auth/me')).body.data.user.premium).toBe(true);
    expect((await free.agent.get('/api/progress/certificate?scope=mengenal-excel')).status).toBe(200);
    const admin = await loginAdmin(env.app);
    await completeModule(admin, 'mengenal-excel');
    expect((await admin.agent.get('/api/progress/certificate?scope=mengenal-excel')).status).toBe(200);
  });

  it('ditolak sebelum semua pelajaran modul selesai', async () => {
    const s = await premiumUser();
    await s.agent.put('/api/progress').set('x-csrf-token', s.csrf).send({ lessonSlug: 'sel-baris-kolom-rentang', completed: true });
    const r = await s.agent.get('/api/progress/certificate?scope=mengenal-excel');
    expect(r.status).toBe(403);
    expect(r.body.error.message).toContain('pelajaran lagi');
    expect((await s.agent.get('/api/progress/certificate?scope=semua')).status).toBe(403);
  });

  it('menerbitkan PDF setelah modul selesai, kode tetap, dan dapat diverifikasi publik', async () => {
    const s = await premiumUser('Citra Lestari');
    await completeModule(s, 'mengenal-excel');
    const r = await pdf(s, 'mengenal-excel');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/pdf');
    expect(r.headers['content-disposition']).toContain('attachment');
    const body = r.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(1500);

    const cert = await row<{ code: string }>(env.db, 'SELECT code FROM certificates WHERE user_id = ?', [s.userId]);
    expect(cert!.code).toMatch(/^[A-F0-9]{16}$/);
    await pdf(s, 'mengenal-excel');
    expect(Number((await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM certificates WHERE user_id = ?', [s.userId]))!.n)).toBe(1);

    const v = await request(env.app).get(`/api/certificates/${cert!.code.toLowerCase()}`);
    expect(v.status).toBe(200);
    expect(v.body.data).toMatchObject({ valid: true, name: 'Citra Lestari' });
    expect(v.body.data.scope).toContain('Mengenal Excel');
    expect(JSON.stringify(v.body)).not.toContain(s.email);
    expect((await request(env.app).get('/api/certificates/0000000000000000')).status).toBe(404);
    expect((await request(env.app).get('/api/certificates/xyz')).status).toBe(400);
  });

  it('sertifikat seluruh materi butuh semua pelajaran di semua modul terbit', async () => {
    const s = await premiumUser();
    const mods = await rows<{ slug: string }>(env.db, 'SELECT slug FROM modules WHERE published = 1');
    for (const m of mods) await completeModule(s, m.slug);
    const r = await pdf(s, 'semua');
    expect(r.status).toBe(200);
    expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('nama dengan karakter non-Latin tidak merusak PDF', async () => {
    const s = await premiumUser('Andi 😀 日本');
    await completeModule(s, 'mengenal-excel');
    const r = await pdf(s, 'mengenal-excel');
    expect(r.status).toBe(200);
    expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('verifikasi email akun kata sandi', () => {
  it('alur: kirim kode, verifikasi, status berubah, dan tidak mengirim lagi bila sudah terverifikasi', async () => {
    const s = await registerUser(env.app);
    expect((await s.agent.get('/api/auth/me')).body.data.user.emailVerified).toBe(false);

    const req = await s.agent.post('/api/auth/email/request').set('x-csrf-token', s.csrf).send({ email: s.email, purpose: 'verify' });
    expect(req.status).toBe(200);
    expect(env.mailer.outbox).toHaveLength(1);
    expect(env.mailer.outbox[0]!.to).toBe(s.email);
    const code = /Kode: (\d{6})/.exec(env.mailer.outbox[0]!.text)![1]!;

    const wrong = await s.agent
      .post('/api/auth/email/verify')
      .set('x-csrf-token', s.csrf)
      .send({ email: s.email, purpose: 'verify', code: code === '000000' ? '111111' : '000000' });
    expect(wrong.status).toBe(400);
    const ok = await s.agent.post('/api/auth/email/verify').set('x-csrf-token', s.csrf).send({ email: s.email, purpose: 'verify', code });
    expect(ok.status).toBe(200);
    expect(ok.body.data.verified).toBe(true);
    expect((await s.agent.get('/api/auth/me')).body.data.user.emailVerified).toBe(true);

    env.mailer.outbox.length = 0;
    await run(env.db, 'UPDATE email_codes SET created_at = (UTC_TIMESTAMP() - INTERVAL 5 MINUTE) WHERE email = ?', [s.email]);
    await s.agent.post('/api/auth/email/request').set('x-csrf-token', s.csrf).send({ email: s.email, purpose: 'verify' });
    expect(env.mailer.outbox).toHaveLength(0);
  });

  it('butuh login dan token CSRF; email di body diabaikan (selalu email akun sendiri)', async () => {
    const anon = await request(env.app).post('/api/auth/email/request').send({ email: 'x@example.com', purpose: 'verify' });
    expect(anon.status).toBe(401);
    const s = await registerUser(env.app);
    const noCsrf = await s.agent.post('/api/auth/email/request').send({ email: s.email, purpose: 'verify' });
    expect(noCsrf.status).toBe(403);
    await s.agent.post('/api/auth/email/request').set('x-csrf-token', s.csrf).send({ email: 'orang-lain@example.com', purpose: 'verify' });
    expect(env.mailer.outbox).toHaveLength(1);
    expect(env.mailer.outbox[0]!.to).toBe(s.email);
  });
});

describe('alat sort/filter pada latihan', () => {
  it('latihan dengan alat mengirim konfigurasi tools; latihan lain null', async () => {
    const withTools = await member.agent.get('/api/exercises/urutkan-penjualan');
    expect(withTools.body.data.tools).toEqual({ sort: { range: 'A1:C8' } });
    expect(withTools.body.data.editable).toEqual(['A2:C8']);
    const without = await member.agent.get('/api/exercises/total-pengeluaran');
    expect(without.body.data.tools).toBeNull();
  });

  it('latihan urut dapat diselesaikan hanya dengan susunan yang benar (baris tetap berpasangan)', async () => {
    const good = await member.agent
      .post('/api/exercises/urutkan-penjualan/submit')
      .set('x-csrf-token', member.csrf)
      .send({ cells: sol('urutkan-penjualan') });
    expect(good.body.data.correct).toBe(true);
    // Hanya kolom Penjualan yang diurutkan, nama tidak ikut: harus ditolak.
    const swapped = { ...sol('urutkan-penjualan'), A2: 'Budi', A3: 'Rina' };
    const bad = await submit(member, 'urutkan-penjualan', swapped);
    expect(bad.body.data.correct).toBe(false);
  });

  it('admin dapat menyimpan latihan dengan tools dan konfigurasi tidak valid ditolak', async () => {
    const admin = await loginAdmin(env.app);
    const h = (r: request.Test) => r.set('x-csrf-token', admin.csrf);
    const base = {
      slug: 'latihan-tools-admin',
      title: 'Latihan tools',
      description: 'd',
      topic: 'mengolah-data',
      difficulty: 'mudah',
      rows: 6,
      cols: 3,
      cells: { A1: 'Nama', B1: 'Nilai', A2: 'x', B2: '2', A3: 'y', B3: '1' },
      editable: ['A2:B3'],
      task: 'Urutkan naik',
      hints: ['h1', 'h2', 'h3'],
      explanation: 'Karena sort',
      points: 10,
      lessonSlug: null,
      sortOrder: 200,
      published: true,
      validation: {
        targets: [
          { cell: 'A2', solution: 'y' },
          { cell: 'B2', solution: '1' },
          { cell: 'A3', solution: 'x' },
          { cell: 'B3', solution: '2' },
        ],
      },
    };
    const bad = await h(admin.agent.post('/api/admin/exercises')).send({ ...base, tools: { sort: { range: 'bukan-rentang' } } });
    expect(bad.status).toBe(400);
    const ok = await h(admin.agent.post('/api/admin/exercises')).send({ ...base, tools: { sort: { range: 'A1:B3' } } });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.data.tools).toEqual({ sort: { range: 'A1:B3' } });
    const pub = await member.agent.get('/api/exercises/latihan-tools-admin');
    expect(pub.body.data.tools).toEqual({ sort: { range: 'A1:B3' } });
    await h(admin.agent.delete(`/api/admin/exercises/${ok.body.data.id}`));
  });
});

describe('admin: ekspor CSV dan latihan yang sering gagal', () => {
  it('hanya admin; berkas CSV memakai BOM, header Indonesia, dan melindungi dari CSV injection', async () => {
    const user = await registerUser(env.app, '=HYPERLINK("http://jahat")');
    expect((await request(env.app).get('/api/admin/users.csv')).status).toBe(401);
    expect((await user.agent.get('/api/admin/users.csv')).status).toBe(403);
    expect((await user.agent.get('/api/admin/stats/usage.csv')).status).toBe(403);

    const admin = await loginAdmin(env.app);
    const r = await admin.agent
      .get('/api/admin/users.csv')
      .buffer(true)
      .parse((res, cb) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (t += c));
        res.on('end', () => cb(null, t));
      });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain('pengguna-excellab.csv');
    const text = r.body as unknown as string;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"id","nama","email"');
    expect(text).toContain(`"'=HYPERLINK(""http://jahat"")"`); // diberi petik di depan agar bukan rumus
    expect(text).not.toMatch(/,"=HYPERLINK/);
    expect(text).not.toContain('password');
    expect(text.split('\r\n').length).toBeGreaterThan(3);

    const u = await admin.agent.get('/api/admin/stats/usage.csv');
    expect(u.status).toBe(200);
    expect(u.text).toContain('tanggal_wib');
  });

  it('daftar latihan yang sering gagal: butuh 5 percobaan dan rasio benar di bawah 50%', async () => {
    const learner = await registerUser(env.app);
    for (let i = 0; i < 6; i++) await submit(learner, 'statistik-nilai', { B8: '=1' });
    const admin = await loginAdmin(env.app);
    const r = await admin.agent.get('/api/admin/stats/hard');
    expect(r.status).toBe(200);
    const item = (r.body.data.hard as { slug: string; attempts: number; rate: number }[]).find((x) => x.slug === 'statistik-nilai');
    expect(item).toBeTruthy();
    expect(item!.attempts).toBeGreaterThanOrEqual(6);
    expect(item!.rate).toBeLessThan(0.5);
    // Latihan yang belum cukup percobaan tidak muncul.
    expect((r.body.data.hard as { slug: string }[]).some((x) => x.slug === 'filter-kota-bandung')).toBe(false);
    const user = await registerUser(env.app);
    expect((await user.agent.get('/api/admin/stats/hard')).status).toBe(403);
  });
});

describe('tes penempatan (terbuka tanpa akun, skor disimpan di server)', () => {
  const correct = () => Object.fromEntries(placementQuestions.map((q) => [q.id, q.answerIndex]));

  it('pengunjung tanpa akun dapat mengirim jawaban; skor dihitung ulang server dan tersimpan tanpa identitas', async () => {
    const before = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM placement_results');
    // Nilai skor dari klien diabaikan: hanya jawaban yang dipakai.
    const r = await request(env.app).post('/api/placement').send({ answers: correct(), score: 0 });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      saved: true,
      score: placementQuestions.length,
      total: placementQuestions.length,
      startModule: null,
    });
    const saved = await row<{ user_id: number | null; score: number }>(
      env.db,
      'SELECT user_id, score FROM placement_results ORDER BY id DESC LIMIT 1',
    );
    expect(saved).toMatchObject({ user_id: null, score: placementQuestions.length });
    const after = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM placement_results');
    expect(Number(after!.n)).toBe(Number(before!.n) + 1);
  });

  it('jawaban salah menentukan modul awal; pengguna masuk terhubung ke akunnya', async () => {
    const answers = { ...correct(), p6: 0 }; // salah di modul logika
    const r = await member.agent.post('/api/placement').set('x-csrf-token', member.csrf).send({ answers });
    expect(r.status).toBe(201);
    expect(r.body.data.startModule).toBe('logika');
    expect(r.body.data.score).toBe(placementQuestions.length - 1);
    const saved = await row<{ user_id: number | null }>(env.db, 'SELECT user_id FROM placement_results ORDER BY id DESC LIMIT 1');
    expect(saved?.user_id).toBe(member.userId);
  });

  it('jawaban tidak lengkap atau di luar pilihan ditolak dan tidak disimpan', async () => {
    const before = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM placement_results');
    const missing = correct();
    delete (missing as Record<string, number>).p3;
    expect((await request(env.app).post('/api/placement').send({ answers: missing })).status).toBe(400);
    expect(
      (
        await request(env.app)
          .post('/api/placement')
          .send({ answers: { ...correct(), p1: 9 } })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(env.app)
          .post('/api/placement')
          .send({ answers: { ...correct(), p1: -1 } })
      ).status,
    ).toBe(400);
    expect((await request(env.app).post('/api/placement').send({})).status).toBe(400);
    const after = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM placement_results');
    expect(Number(after!.n)).toBe(Number(before!.n));
  });

  it('admin melihat ringkasan dan hasil terbaru; pengguna biasa dan anonim tidak', async () => {
    await request(env.app).post('/api/placement').send({ answers: correct() });
    const admin = await loginAdmin(env.app);
    const r = await admin.agent.get('/api/admin/stats/placement');
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBeGreaterThanOrEqual(3);
    expect(r.body.data.withAccount).toBeGreaterThanOrEqual(1);
    expect(r.body.data.recent.length).toBeGreaterThan(0);
    expect(r.body.data.recent.some((p: { user: unknown }) => p.user === null)).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain('answers');
    expect((await request(env.app).get('/api/admin/stats/placement')).status).toBe(401);
    expect((await member.agent.get('/api/admin/stats/placement')).status).toBe(403);
  });
});
