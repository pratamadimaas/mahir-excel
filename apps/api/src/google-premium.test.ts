import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { row, run } from './db/pool';
import { ADMIN_EMAIL, createFakeGoogle, grantPremium, loginAdmin, registerUser, setupTestEnv, type TestEnv } from './testutil';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

describe('login dengan Google', () => {
  const login = (credential: string) => request(env.app).post('/api/auth/google').send({ credential });
  const token = (suffix: string) => `token-uji-google-${suffix}-${'x'.repeat(12)}`;
  const profile = (email: string, sub: string, extra: Partial<{ emailVerified: boolean; name: string | null }> = {}) => ({
    sub,
    email,
    emailVerified: extra.emailVerified ?? true,
    name: extra.name === undefined ? 'Budi Google' : extra.name,
  });

  it('konfigurasi publik memuat Client ID Google dan info Premium (tanpa rahasia)', async () => {
    const r = await request(env.app).get('/api/auth/config');
    expect(r.body.data.googleClientId).toBe(env.google.clientId);
    expect(r.body.data.premium.priceLabel).toBeTruthy();
    expect(JSON.stringify(r.body)).not.toMatch(/secret|password/i);
  });

  it('akun baru dibuat otomatis, email terverifikasi, tanpa kata sandi, dan sesi aktif', async () => {
    const t = token('baru');
    env.google.profiles[t] = profile('google-baru@example.com', 'sub-baru-1');
    const r = await login(t);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      isNew: true,
      user: { email: 'google-baru@example.com', displayName: 'Budi Google', role: 'user', emailVerified: true },
    });
    const rec = await row<{ google_sub: string; has_password: number }>(
      env.db,
      'SELECT google_sub, has_password FROM users WHERE email = ?',
      ['google-baru@example.com'],
    );
    expect(rec).toMatchObject({ google_sub: 'sub-baru-1', has_password: 0 });

    const again = await login(t);
    expect(again.status).toBe(200);
    expect(again.body.data.isNew).toBe(false);

    const agent = request.agent(env.app);
    const third = await agent.post('/api/auth/google').send({ credential: t });
    expect(third.body.data.csrfToken).toBeTruthy();
    expect((await agent.get('/api/modules')).status).toBe(200);
    const n = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM users WHERE email = ?', ['google-baru@example.com']);
    expect(Number(n!.n)).toBe(1);
  });

  it('akun yang sudah ada (daftar dengan kata sandi) ditautkan ke Google, bukan digandakan', async () => {
    const s = await registerUser(env.app, 'Sudah Ada');
    const t = token('tautan');
    env.google.profiles[t] = profile(s.email, 'sub-tautan-1', { name: 'Nama Lain' });
    const r = await login(t);
    expect(r.status).toBe(200);
    expect(r.body.data.user).toMatchObject({ id: s.userId, displayName: 'Sudah Ada', emailVerified: true });
    const rec = await row<{ google_sub: string }>(env.db, 'SELECT google_sub FROM users WHERE id = ?', [s.userId]);
    expect(rec?.google_sub).toBe('sub-tautan-1');
  });

  it('email yang sama dengan akun Google berbeda ditolak', async () => {
    const s = await registerUser(env.app);
    await run(env.db, 'UPDATE users SET google_sub = ? WHERE id = ?', ['sub-asli', s.userId]);
    const t = token('lain');
    env.google.profiles[t] = profile(s.email, 'sub-penyusup');
    expect((await login(t)).status).toBe(403);
  });

  it('email Google belum terverifikasi, token tidak dikenal, dan token kosong ditolak', async () => {
    const t = token('belum');
    env.google.profiles[t] = profile('belum-verifikasi@example.com', 'sub-belum', { emailVerified: false });
    expect((await login(t)).status).toBe(403);
    expect((await login(token('tidak-dikenal'))).status).toBe(401);
    expect((await login('pendek')).status).toBe(400);
    expect((await request(env.app).post('/api/auth/google').send({})).status).toBe(400);
    const n = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM users WHERE email = ?', ['belum-verifikasi@example.com']);
    expect(Number(n!.n)).toBe(0);
  });

  it('admin tidak dapat masuk lewat Google', async () => {
    const t = token('admin');
    env.google.profiles[t] = profile(ADMIN_EMAIL, 'sub-admin');
    const r = await login(t);
    expect(r.status).toBe(403);
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('dimatikan (503) bila Client ID tidak dikonfigurasi', async () => {
    const off = createApp(env.db, env.config, env.mailer, createFakeGoogle(null));
    const r = await request(off)
      .post('/api/auth/google')
      .send({ credential: token('apapun') });
    expect(r.status).toBe(503);
    expect((await request(off).get('/api/auth/config')).body.data.googleClientId).toBeNull();
  });
});

describe('aktivasi Premium oleh admin', () => {
  it('admin mengaktifkan, memperpanjang, dan mencabut; pengguna biasa dan anonim ditolak', async () => {
    const admin = await loginAdmin(env.app);
    const user = await registerUser(env.app, 'Calon Premium');
    const put = (id: number, months: unknown) =>
      admin.agent.put(`/api/admin/users/${id}/premium`).set('x-csrf-token', admin.csrf).send({ months });

    const first = await put(user.userId, 12);
    expect(first.status).toBe(200);
    const until1 = new Date(first.body.data.premiumUntil).getTime();
    expect(until1).toBeGreaterThan(Date.now() + 360 * 86_400_000);
    expect((await user.agent.get('/api/auth/me')).body.data.user.premium).toBe(true);

    // Perpanjangan dihitung dari akhir masa aktif, bukan dari hari ini.
    const second = await put(user.userId, 1);
    expect(new Date(second.body.data.premiumUntil).getTime()).toBeGreaterThan(until1 + 27 * 86_400_000);

    const revoked = await put(user.userId, 0);
    expect(revoked.body.data.premiumUntil).toBeNull();
    expect((await user.agent.get('/api/auth/me')).body.data.user.premium).toBe(false);

    expect((await put(user.userId, -1)).status).toBe(400);
    expect((await put(user.userId, 99)).status).toBe(400);
    expect((await put(user.userId, 'x')).status).toBe(400);
    expect((await put(999999999, 1)).status).toBe(404);
    const log = await row<{ n: number }>(
      env.db,
      "SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action LIKE 'premium-%' AND resource_id = ?",
      [String(user.userId)],
    );
    expect(Number(log!.n)).toBeGreaterThanOrEqual(3);

    const asUser = await user.agent.put(`/api/admin/users/${user.userId}/premium`).set('x-csrf-token', user.csrf).send({ months: 12 });
    expect(asUser.status).toBe(403);
    expect((await request(env.app).put(`/api/admin/users/${user.userId}/premium`).send({ months: 12 })).status).toBe(401);
  });

  it('daftar pengguna admin memuat status Premium', async () => {
    const admin = await loginAdmin(env.app);
    const user = await registerUser(env.app, 'Terdaftar Premium');
    await grantPremium(env, user.userId, 3);
    const r = await admin.agent.get('/api/admin/users?pageSize=100&q=Terdaftar Premium');
    const found = (r.body.data as { id: number; premium: boolean; premiumUntil: string | null }[]).find((u) => u.id === user.userId);
    expect(found).toMatchObject({ premium: true });
    expect(found!.premiumUntil).toBeTruthy();
  });
});
