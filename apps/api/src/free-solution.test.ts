import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exercises, solutionCells } from '@excellab/shared';
import { row, run } from './db/pool';
import { grantPremium, loginAdmin, registerUser, setupTestEnv, type Session, type TestEnv } from './testutil';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

const reveal = (s: Session, slug: string) => s.agent.post(`/api/exercises/${slug}/reveal`).set('X-CSRF-Token', s.csrf);
const quota = (s: Session) => s.agent.get('/api/solution-quota');
const [A, B, C] = exercises.slice(0, 3).map((e) => e.slug) as [string, string, string];

describe('solusi gratis seminggu sekali', () => {
  it('tanpa login ditolak', async () => {
    expect((await request(env.app).get('/api/solution-quota')).status).toBe(401);
    expect([401, 403]).toContain((await request(env.app).post(`/api/exercises/${A}/reveal`)).status);
  });

  it('akun baru punya jatah; setelah dipakai, jatah habis dengan tanggal berikutnya', async () => {
    const s = await registerUser(env.app);
    expect((await quota(s)).body.data).toEqual({ premium: false, available: true, nextFreeAt: null, unlocked: [] });

    const first = await reveal(s, A);
    expect(first.status).toBe(200);
    expect(first.body.data.solution).toEqual(solutionCells(exercises.find((e) => e.slug === A)!));
    expect(first.body.data).toMatchObject({ free: true, pointsAwarded: 0 });
    const next = new Date(first.body.data.nextFreeAt).getTime();
    expect(next - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
    expect(next - Date.now()).toBeLessThanOrEqual(7 * 86_400_000 + 2000);

    const q = (await quota(s)).body.data;
    expect(q.available).toBe(false);
    expect(q.unlocked).toEqual([A]);
    expect(new Date(q.nextFreeAt).getTime()).toBe(next);
  });

  it('solusi lain ditolak (402) dengan tanggal jatah berikutnya, dan tidak membocorkan solusinya', async () => {
    const s = await registerUser(env.app);
    await reveal(s, A);
    const denied = await reveal(s, B);
    expect(denied.status).toBe(402);
    expect(denied.body.error.code).toBe('PREMIUM_REQUIRED');
    expect(denied.body.error.details.nextFreeAt).toEqual(expect.any(String));
    expect(JSON.stringify(denied.body)).not.toContain('solution');
    expect((await quota(s)).body.data.unlocked).toEqual([A]);
  });

  it('membuka ulang solusi yang sama tidak memakai jatah dan tetap diterima saat jatah habis', async () => {
    const s = await registerUser(env.app);
    await reveal(s, A);
    const again = await reveal(s, A);
    expect(again.status).toBe(200);
    expect(again.body.data.free).toBe(true);
    const count = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM solution_unlocks WHERE user_id = ?', [s.userId]);
    expect(Number(count!.n)).toBe(1);
  });

  it('setelah 7 hari jatah pulih', async () => {
    const s = await registerUser(env.app);
    await reveal(s, A);
    expect((await reveal(s, B)).status).toBe(402);
    await run(env.db, "UPDATE solution_unlocks SET unlocked_at = DATE_SUB(NOW(), INTERVAL 8 DAY) WHERE user_id = ?", [s.userId]);
    expect((await quota(s)).body.data).toMatchObject({ available: true, nextFreeAt: null });
    expect((await reveal(s, B)).status).toBe(200);
    expect((await quota(s)).body.data.unlocked.sort()).toEqual([A, B].sort());
  });

  it('permintaan paralel tidak bisa melewati batas satu solusi per minggu', async () => {
    const s = await registerUser(env.app);
    const results = await Promise.all([reveal(s, A), reveal(s, B), reveal(s, C), reveal(s, A), reveal(s, B)]);
    const opened = results.filter((r) => r.status === 200).length;
    const count = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM solution_unlocks WHERE user_id = ?', [s.userId]);
    expect(Number(count!.n)).toBe(1);
    expect(opened).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => [200, 402].includes(r.status))).toBe(true);
  });

  it('Premium: tanpa batas dan tidak memakai jatah', async () => {
    const s = await registerUser(env.app);
    await grantPremium(env, s.userId);
    expect((await quota(s)).body.data).toEqual({ premium: true, available: true, nextFreeAt: null, unlocked: [] });
    for (const slug of [A, B, C]) {
      const r = await reveal(s, slug);
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ free: false, nextFreeAt: null });
    }
    const count = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM solution_unlocks WHERE user_id = ?', [s.userId]);
    expect(Number(count!.n)).toBe(0);
  });

  it('latihan yang tidak ada: 404 dan jatah tidak terpakai', async () => {
    const s = await registerUser(env.app);
    expect((await reveal(s, 'tidak-ada')).status).toBe(404);
    expect((await quota(s)).body.data.available).toBe(true);
  });
});

describe('laporan soal', () => {
  const report = (s: Session, slug: string, body: unknown) => s.agent.post(`/api/exercises/${slug}/report`).set('X-CSRF-Token', s.csrf).send(body as object);

  it('tanpa login ditolak', async () => {
    expect([401, 403]).toContain((await request(env.app).post(`/api/exercises/${A}/report`).send({ reason: 'tidak-jelas' })).status);
  });

  it('laporan tersimpan dengan alasan dan catatan, dan laporan kembar yang masih terbuka dijawab duplikat', async () => {
    const s = await registerUser(env.app);
    const r = await report(s, A, { reason: 'jawaban-meragukan', note: '  Hasilnya beda dengan Excel saya.  ' });
    expect(r.status).toBe(201);
    expect(r.body.data.duplicate).toBe(false);
    const saved = await row<{ reason: string; note: string }>(env.db, 'SELECT reason, note FROM exercise_reports WHERE id = ?', [r.body.data.id]);
    expect(saved).toEqual({ reason: 'jawaban-meragukan', note: 'Hasilnya beda dengan Excel saya.' });

    const dup = await report(s, A, { reason: 'tidak-jelas' });
    expect(dup.status).toBe(200);
    expect(dup.body.data).toEqual({ id: r.body.data.id, duplicate: true });
    const count = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM exercise_reports WHERE user_id = ?', [s.userId]);
    expect(Number(count!.n)).toBe(1);
  });

  it('validasi: alasan wajib sah, catatan paling 500 karakter, latihan harus ada', async () => {
    const s = await registerUser(env.app);
    expect((await report(s, A, {})).status).toBe(400);
    expect((await report(s, A, { reason: 'asal' })).status).toBe(400);
    expect((await report(s, A, { reason: 'lainnya', note: 'x'.repeat(501) })).status).toBe(400);
    expect((await report(s, 'tidak-ada', { reason: 'lainnya' })).status).toBe(404);
  });

  it('paling banyak 10 laporan sehari per pengguna', async () => {
    const s = await registerUser(env.app);
    const all = exercises.slice(0, 11).map((e) => e.slug);
    for (const slug of all.slice(0, 10)) expect((await report(s, slug, { reason: 'salah-ketik' })).status).toBe(201);
    const over = await report(s, all[10]!, { reason: 'salah-ketik' });
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('RATE_LIMITED');
  });

  it('admin melihat laporan terbuka, menandainya selesai, dan pengguna biasa tidak boleh', async () => {
    const user = await registerUser(env.app);
    const admin = await loginAdmin(env.app);
    const made = await report(user, C, { reason: 'tidak-jelas', note: 'Petunjuknya membingungkan' });
    expect((await user.agent.get('/api/admin/reports')).status).toBe(403);

    const list = await admin.agent.get('/api/admin/reports');
    expect(list.status).toBe(200);
    const mine = list.body.data.find((x: { id: number }) => x.id === made.body.data.id);
    expect(mine).toMatchObject({ reason: 'tidak-jelas', note: 'Petunjuknya membingungkan', exerciseSlug: C, email: user.email, resolvedAt: null });
    expect(mine.openForExercise).toBeGreaterThanOrEqual(1);

    expect((await user.agent.put(`/api/admin/reports/${made.body.data.id}/resolve`).set('X-CSRF-Token', user.csrf)).status).toBe(403);
    const done = await admin.agent.put(`/api/admin/reports/${made.body.data.id}/resolve`).set('X-CSRF-Token', admin.csrf);
    expect(done.status).toBe(200);
    expect((await admin.agent.get('/api/admin/reports')).body.data.some((x: { id: number }) => x.id === made.body.data.id)).toBe(false);
    const all = await admin.agent.get('/api/admin/reports?status=all');
    expect(all.body.data.find((x: { id: number }) => x.id === made.body.data.id).resolvedAt).toEqual(expect.any(String));

    // Setelah selesai, pengguna boleh melapor lagi untuk latihan yang sama.
    expect((await report(user, C, { reason: 'lainnya' })).status).toBe(201);
    expect((await admin.agent.put('/api/admin/reports/999999/resolve').set('X-CSRF-Token', admin.csrf)).status).toBe(404);
  });
});
