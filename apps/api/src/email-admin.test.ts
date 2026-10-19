import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exercises, solutionCells } from '@excellab/shared';
import { createApp } from './app';
import { createMailer } from './lib/mailer';
import { createPool, row, run } from './db/pool';
import { loginAdmin, registerUser, setupTestEnv, testConfig, ADMIN_EMAIL, type TestEnv } from './testutil';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});
beforeEach(() => {
  env.mailer.outbox.length = 0;
});

let n = 0;
const newEmail = (): string => `kode${Date.now()}${n++}@example.com`;
const lastCode = (): string => {
  const m = /Kode: (\d{6})/.exec(env.mailer.outbox.at(-1)?.text ?? '');
  if (!m) throw new Error('tidak ada kode di outbox');
  return m[1]!;
};
const requestCode = (email: string, purpose: 'login' | 'reset' = 'login') =>
  request(env.app).post('/api/auth/email/request').send({ email, purpose });
const wrongCode = (code: string): string => (code === '000000' ? '111111' : '000000');

describe('login lewat kode email', () => {
  it('konfigurasi menyatakan fitur email aktif', async () => {
    const r = await request(env.app).get('/api/auth/config');
    expect(r.body.data.emailEnabled).toBe(true);
  });

  it('email baru: kode dikirim, akun dibuat otomatis, sesi aktif', async () => {
    const email = newEmail();
    const req = await requestCode(email);
    expect(req.status).toBe(200);
    expect(req.body.data.sent).toBe(true);
    expect(env.mailer.outbox).toHaveLength(1);
    expect(env.mailer.outbox[0]!.to).toBe(email);
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);

    // Hanya hash yang disimpan, bukan kodenya.
    const stored = await row<{ code_hash: string }>(env.db, 'SELECT code_hash FROM email_codes WHERE email = ? ORDER BY id DESC LIMIT 1', [
      email,
    ]);
    expect(stored!.code_hash).toHaveLength(64);
    expect(stored!.code_hash).not.toContain(code);

    const agent = request.agent(env.app);
    const ok = await agent.post('/api/auth/email/verify').send({ email, purpose: 'login', code });
    expect(ok.status).toBe(200);
    expect(ok.body.data.isNew).toBe(true);
    expect(ok.body.data.user.email).toBe(email);
    expect(ok.body.data.user.role).toBe('user');
    expect((await agent.get('/api/auth/me')).body.data.user.email).toBe(email);

    const u = await row<{ has_password: number; email_verified_at: string | null }>(
      env.db,
      'SELECT has_password, email_verified_at FROM users WHERE email = ?',
      [email],
    );
    expect(u!.has_password).toBe(0);
    expect(u!.email_verified_at).not.toBeNull();
  });

  it('akun yang sudah ada: login berhasil dan bukan akun baru', async () => {
    const s = await registerUser(env.app);
    await requestCode(s.email);
    const r = await request(env.app).post('/api/auth/email/verify').send({ email: s.email, purpose: 'login', code: lastCode() });
    expect(r.status).toBe(200);
    expect(r.body.data.isNew).toBe(false);
    expect(r.body.data.user.id).toBe(s.userId);
  });

  it('kode hanya dapat dipakai sekali', async () => {
    const email = newEmail();
    await requestCode(email);
    const code = lastCode();
    expect((await request(env.app).post('/api/auth/email/verify').send({ email, purpose: 'login', code })).status).toBe(200);
    const again = await request(env.app).post('/api/auth/email/verify').send({ email, purpose: 'login', code });
    expect(again.status).toBe(400);
  });

  it('kode salah ditolak dan setelah 5 percobaan kode benar pun tidak berlaku', async () => {
    const email = newEmail();
    await requestCode(email);
    const code = lastCode();
    for (let i = 0; i < 5; i++) {
      const bad = await request(env.app)
        .post('/api/auth/email/verify')
        .send({ email, purpose: 'login', code: wrongCode(code) });
      expect(bad.status).toBe(400);
    }
    const late = await request(env.app).post('/api/auth/email/verify').send({ email, purpose: 'login', code });
    expect(late.status).toBe(400);
    expect(await row(env.db, 'SELECT id FROM users WHERE email = ?', [email])).toBeUndefined();
  });

  it('kode kedaluwarsa ditolak', async () => {
    const email = newEmail();
    await requestCode(email);
    const code = lastCode();
    await run(env.db, 'UPDATE email_codes SET expires_at = (UTC_TIMESTAMP() - INTERVAL 1 MINUTE) WHERE email = ?', [email]);
    const r = await request(env.app).post('/api/auth/email/verify').send({ email, purpose: 'login', code });
    expect(r.status).toBe(400);
  });

  it('jeda 60 detik: permintaan beruntun tidak mengirim email berulang tetapi respons sama', async () => {
    const email = newEmail();
    const a = await requestCode(email);
    const b = await requestCode(email);
    expect(a.body).toEqual(b.body);
    expect(env.mailer.outbox).toHaveLength(1);
  });

  it('validasi: email salah dan kode bukan 6 angka', async () => {
    expect((await requestCode('bukan-email')).status).toBe(400);
    const r = await request(env.app).post('/api/auth/email/verify').send({ email: newEmail(), purpose: 'login', code: '12ab' });
    expect(r.status).toBe(400);
    expect((await request(env.app).post('/api/auth/email/request').send({ email: newEmail(), purpose: 'lain' })).status).toBe(400);
  });

  it('akun admin tidak dapat login tanpa kata sandi', async () => {
    await requestCode(ADMIN_EMAIL);
    expect(env.mailer.outbox).toHaveLength(0);
    const r = await request(env.app).post('/api/auth/email/verify').send({ email: ADMIN_EMAIL, purpose: 'login', code: '123456' });
    expect(r.status).toBe(400);
  });

  it('login ulang saat sudah punya sesi tidak butuh token CSRF', async () => {
    const a = await registerUser(env.app);
    const b = await registerUser(env.app);
    const r = await a.agent.post('/api/auth/login').send({ email: b.email, password: 'sandi-aman-123' });
    expect(r.status).toBe(200);
    expect(r.body.data.user.id).toBe(b.userId);
  });

  it('fitur dimatikan (tanpa SMTP di produksi) -> 503 dan config false', async () => {
    const config = testConfig({ MAIL_MODE: 'disabled' });
    const db = createPool(config);
    const app = createApp(db, config, createMailer(config));
    expect((await request(app).get('/api/auth/config')).body.data.emailEnabled).toBe(false);
    expect((await request(app).post('/api/auth/email/request').send({ email: newEmail(), purpose: 'login' })).status).toBe(503);
    await db.end();
  });
});

describe('atur ulang kata sandi lewat email', () => {
  it('alur lengkap: kata sandi lama tidak berlaku, yang baru berlaku, sesi aktif', async () => {
    const s = await registerUser(env.app);
    await requestCode(s.email, 'reset');
    expect(env.mailer.outbox[0]!.subject).toContain('kata sandi');
    const code = lastCode();

    const noPw = await request(env.app).post('/api/auth/email/verify').send({ email: s.email, purpose: 'reset', code });
    expect(noPw.status).toBe(400);

    const short = await request(env.app)
      .post('/api/auth/email/verify')
      .send({ email: s.email, purpose: 'reset', code, newPassword: 'pendek' });
    expect(short.status).toBe(400);

    // Percobaan tanpa kata sandi tidak menghabiskan kode karena ditolak validasi sebelum diperiksa.
    const agent = request.agent(env.app);
    const ok = await agent.post('/api/auth/email/verify').send({ email: s.email, purpose: 'reset', code, newPassword: 'sandi-baru-456' });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.data.user.email).toBe(s.email);

    expect((await request(env.app).post('/api/auth/login').send({ email: s.email, password: 'sandi-aman-123' })).status).toBe(401);
    expect((await request(env.app).post('/api/auth/login').send({ email: s.email, password: 'sandi-baru-456' })).status).toBe(200);
  });

  it('akun yang dibuat lewat email dapat menambah kata sandi dengan reset', async () => {
    const email = newEmail();
    await requestCode(email);
    await request(env.app).post('/api/auth/email/verify').send({ email, purpose: 'login', code: lastCode() });
    env.mailer.outbox.length = 0;
    await run(env.db, 'UPDATE email_codes SET created_at = (UTC_TIMESTAMP() - INTERVAL 5 MINUTE) WHERE email = ?', [email]);
    await requestCode(email, 'reset');
    const ok = await request(env.app)
      .post('/api/auth/email/verify')
      .send({ email, purpose: 'reset', code: lastCode(), newPassword: 'sandi-pertama-789' });
    expect(ok.status).toBe(200);
    expect((await request(env.app).post('/api/auth/login').send({ email, password: 'sandi-pertama-789' })).status).toBe(200);
    const u = await row<{ has_password: number }>(env.db, 'SELECT has_password FROM users WHERE email = ?', [email]);
    expect(u!.has_password).toBe(1);
  });

  it('email tidak terdaftar: respons sama tetapi tidak ada email terkirim', async () => {
    const known = await registerUser(env.app);
    const a = await requestCode(known.email, 'reset');
    const sentKnown = env.mailer.outbox.length;
    const b = await requestCode(newEmail(), 'reset');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toEqual(b.body);
    expect(sentKnown).toBe(1);
    expect(env.mailer.outbox).toHaveLength(1);
  });
});

describe('pencatatan kunjungan (ramah privasi)', () => {
  const dayCount = async (metric: string, item?: string): Promise<number> => {
    const r = await row<{ n: number | null }>(
      env.db,
      `SELECT SUM(total) AS n FROM daily_stats WHERE metric = ?${item ? ' AND item = ?' : ''}`,
      item ? [metric, item] : [metric],
    );
    return Number(r?.n ?? 0);
  };

  it('menghitung halaman dan pengunjung unik harian, tanpa menyimpan IP', async () => {
    const v0 = await dayCount('visitor');
    const p0 = await dayCount('pageview', '/belajar/fungsi-sum');
    const ua = 'UjiBrowser/1.0';
    const hit = (path: string) => request(env.app).post('/api/track').set('User-Agent', ua).send({ path });
    expect((await hit('/belajar/fungsi-sum')).body.data.counted).toBe(true);
    await hit('/belajar/fungsi-sum');
    expect(await dayCount('pageview', '/belajar/fungsi-sum')).toBe(p0 + 2);
    expect(await dayCount('visitor')).toBe(v0 + 1); // klien yang sama dihitung satu pengunjung

    const hashes = await row<{ hash: string }>(env.db, 'SELECT hash FROM visitor_hashes LIMIT 1');
    expect(hashes!.hash).toHaveLength(32);
    expect(hashes!.hash).not.toMatch(/127\.0\.0\.1|::1/);
  });

  it('menghormati Do Not Track dan Global Privacy Control', async () => {
    const before = await dayCount('pageview');
    const dnt = await request(env.app).post('/api/track').set('DNT', '1').send({ path: '/belajar' });
    const gpc = await request(env.app).post('/api/track').set('Sec-GPC', '1').send({ path: '/belajar' });
    expect(dnt.body.data.counted).toBe(false);
    expect(gpc.body.data.counted).toBe(false);
    expect(await dayCount('pageview')).toBe(before);
  });

  it('rute dinormalisasi: slug asing digabung, admin tidak dicatat, path berbahaya ditolak', async () => {
    const hit = (path: string) => request(env.app).post('/api/track').send({ path });
    await hit('/belajar/slug-yang-tidak-ada-123');
    expect(await dayCount('pageview', '/belajar/(tidak-ada)')).toBeGreaterThan(0);
    await hit('/halaman-acak');
    expect(await dayCount('pageview', '/(lain)')).toBeGreaterThan(0);
    const adminBefore = await dayCount('pageview');
    expect((await hit('/admin/users')).body.data.counted).toBe(false);
    expect(await dayCount('pageview')).toBe(adminBefore);
    expect((await hit('/belajar?x=<script>')).status).toBe(400);
    expect((await request(env.app).post('/api/track').send({})).status).toBe(400);
  });

  it('pengiriman jawaban tanpa akun ditolak dan tidak menambah hitungan agregat atau percobaan', async () => {
    const slug = 'total-pengeluaran';
    const a0 = await dayCount('anon_attempt', slug);
    const r = await request(env.app)
      .post(`/api/exercises/${slug}/submit`)
      .send({ cells: { B7: '=SUM(B2:B5)' } });
    expect(r.status).toBe(401);
    expect(await dayCount('anon_attempt', slug)).toBe(a0);
    const attempts = await row<{ n: number }>(
      env.db,
      'SELECT COUNT(*) AS n FROM exercise_attempts WHERE created_at > (UTC_TIMESTAMP() - INTERVAL 1 MINUTE) AND user_id IS NULL',
    );
    expect(attempts?.n ?? 0).toBe(0);
  });
});

describe('admin: statistik penggunaan dan daftar pengguna', () => {
  it('hanya admin yang dapat mengakses', async () => {
    const user = await registerUser(env.app);
    for (const url of ['/api/admin/stats/usage', '/api/admin/users']) {
      expect((await request(env.app).get(url)).status).toBe(401);
      expect((await user.agent.get(url)).status).toBe(403);
    }
  });

  it('statistik 14 hari memuat kunjungan, pendaftaran, percobaan, dan halaman populer', async () => {
    await request(env.app).post('/api/track').send({ path: '/' });
    await registerUser(env.app);
    const admin = await loginAdmin(env.app);
    const r = await admin.agent.get('/api/admin/stats/usage');
    expect(r.status).toBe(200);
    expect(r.body.data.daily).toHaveLength(14);
    expect(r.body.data.today.visitors).toBeGreaterThanOrEqual(1);
    expect(r.body.data.today.newUsers).toBeGreaterThanOrEqual(1);
    expect(r.body.data.week.pageviews).toBeGreaterThanOrEqual(1);
    expect(r.body.data.topPages.length).toBeGreaterThan(0);
    expect(Array.isArray(r.body.data.anonymousExercises)).toBe(true);
  });

  it('daftar pengguna dengan paginasi, pencarian, dan ringkasan aktivitas', async () => {
    const s = await registerUser(env.app, 'Budi Pencari');
    await s.agent
      .post('/api/exercises/total-pengeluaran/submit')
      .set('x-csrf-token', s.csrf)
      .send({ cells: solutionCells(exercises.find((e) => e.slug === 'total-pengeluaran')!) });
    const admin = await loginAdmin(env.app);
    const all = await admin.agent.get('/api/admin/users?pageSize=5');
    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeLessThanOrEqual(5);
    expect(all.body.meta.total).toBeGreaterThan(5);
    expect(JSON.stringify(all.body)).not.toContain('password_hash');

    const found = await admin.agent.get(`/api/admin/users?q=${encodeURIComponent(s.email)}`);
    expect(found.body.data).toHaveLength(1);
    expect(found.body.data[0]).toMatchObject({
      email: s.email,
      displayName: 'Budi Pencari',
      role: 'user',
      points: 10,
      exercisesDone: 1,
      hasPassword: true,
    });
    expect(found.body.data[0].lastActive).toBeTruthy();

    const none = await admin.agent.get('/api/admin/users?q=%25');
    expect(none.body.meta.total).toBe(0);
  });
});
