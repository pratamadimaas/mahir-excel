import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { row, run } from './db/pool';
import { registerUser, setupTestEnv, testConfig, type Session, type TestEnv } from './testutil';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

const status = (s: Session) => s.agent.get('/api/program/status');
const claim = (s: Session) => s.agent.post('/api/program/claim').set('X-CSRF-Token', s.csrf);

/** Memenuhi syarat lewat SQL: sama dengan yang tercatat saat pengguna benar-benar mengerjakannya. */
async function meetRequirements(s: Session, opts: { placement?: boolean; sprint?: boolean; exercises?: number } = {}): Promise<void> {
  const { placement = true, sprint = true, exercises = 5 } = opts;
  if (placement) {
    await run(env.db, "INSERT INTO placement_results (user_id, score, total, start_module, per_module, answers) VALUES (?,?,?,?,'{}','[]')", [
      s.userId,
      8,
      12,
      'rumus-dasar',
    ]);
  }
  if (sprint) {
    const now = Date.now();
    await run(
      env.db,
      "INSERT INTO sprint_sessions (token, user_id, started_ms, ends_ms, issued_ms, score, correct, finished) VALUES (?,?,?,?,?,?,?,1)",
      [`tok-${s.userId}-${now}`.padEnd(48, 'x').slice(0, 48), s.userId, now - 70000, now - 10000, now - 10000, 120, 4],
    );
  }
  if (exercises > 0) {
    const ex = await env.db.query('SELECT id FROM exercises WHERE published = 1 ORDER BY id LIMIT ?', [exercises]);
    for (const e of (ex[0] as { id: number }[]).slice(0, exercises)) {
      await run(env.db, 'INSERT INTO exercise_completions (user_id, exercise_id, points) VALUES (?,?,10)', [s.userId, e.id]);
    }
  }
}

describe('Program Perintis', () => {
  it('status publik menampilkan kuota tanpa data pribadi', async () => {
    const r = await request(env.app).get('/api/program/status');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ enabled: true, quota: 100, minExercises: 5, open: true });
    expect(r.body.data.requirements).toBeUndefined();
    expect(r.body.data.remaining + r.body.data.taken).toBe(100);
  });

  it('klaim membutuhkan login', async () => {
    expect((await request(env.app).post('/api/program/claim')).status).toBe(401);
    expect((await request(env.app).get('/api/program/certificate')).status).toBe(401);
  });

  it('status pengguna menunjukkan syarat yang belum dan sudah terpenuhi', async () => {
    const s = await registerUser(env.app);
    const before = (await status(s)).body.data;
    expect(before.eligible).toBe(false);
    expect(before.claim).toBeNull();
    expect(before.requirements.map((q: { key: string; done: boolean }) => [q.key, q.done])).toEqual([
      ['placement', false],
      ['sprint', false],
      ['exercises', false],
    ]);
    await meetRequirements(s, { exercises: 3 });
    const mid = (await status(s)).body.data;
    expect(mid.requirements.map((q: { key: string; done: boolean }) => q.done)).toEqual([true, true, false]);
    expect(mid.requirements[2].progress).toEqual({ have: 3, need: 5 });
    expect(mid.eligible).toBe(false);
  });

  it('klaim ditolak jika syarat belum lengkap, dan menyebut apa yang kurang', async () => {
    const s = await registerUser(env.app);
    await meetRequirements(s, { sprint: false });
    const r = await claim(s);
    expect(r.status).toBe(403);
    expect(r.body.error.message.toLowerCase()).toContain('sprint');
    expect(await row(env.db, 'SELECT 1 FROM program_claims WHERE user_id = ?', [s.userId])).toBeUndefined();
  });

  it('tes penempatan dan Sprint tanpa akun tidak dihitung untuk akun lain', async () => {
    const s = await registerUser(env.app);
    await run(env.db, "INSERT INTO placement_results (user_id, score, total, per_module, answers) VALUES (NULL,9,12,'{}','[]')");
    const now = Date.now();
    await run(env.db, "INSERT INTO sprint_sessions (token, user_id, started_ms, ends_ms, issued_ms, score, correct, finished) VALUES (?,NULL,?,?,?,100,3,1)", [
      `anon-${now}`.padEnd(48, 'y').slice(0, 48),
      now - 70000,
      now - 10000,
      now - 10000,
    ]);
    const r = (await status(s)).body.data;
    expect(r.requirements[0].done).toBe(false);
    expect(r.requirements[1].done).toBe(false);
  });

  it('Sprint yang belum selesai atau tanpa jawaban benar tidak memenuhi syarat', async () => {
    const s = await registerUser(env.app);
    const now = Date.now();
    await run(env.db, "INSERT INTO sprint_sessions (token, user_id, started_ms, ends_ms, issued_ms, score, correct, finished) VALUES (?,?,?,?,?,0,0,1)", [
      `zero-${now}`.padEnd(48, 'z').slice(0, 48),
      s.userId,
      now - 70000,
      now - 10000,
      now - 10000,
    ]);
    await run(env.db, "INSERT INTO sprint_sessions (token, user_id, started_ms, ends_ms, issued_ms, score, correct, finished) VALUES (?,?,?,?,?,50,2,0)", [
      `open-${now}`.padEnd(48, 'o').slice(0, 48),
      s.userId,
      now,
      now + 60000,
      now,
    ]);
    expect((await status(s)).body.data.requirements[1].done).toBe(false);
  });

  it('klaim berhasil memberi slot berurutan, sertifikat, dan bersifat idempoten', async () => {
    const a = await registerUser(env.app, 'Perintis Satu');
    await meetRequirements(a);
    const takenBefore = (await status(a)).body.data.taken;
    const first = await claim(a);
    expect(first.status).toBe(200);
    expect(first.body.data.claim.slot).toBe(takenBefore + 1);
    expect(first.body.data.claim.code).toMatch(/^[A-F0-9]{16}$/);
    const again = await claim(a);
    expect(again.status).toBe(200);
    expect(again.body.data.claim).toEqual(first.body.data.claim);
    expect(Number((await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM program_claims WHERE user_id = ?', [a.userId]))!.n)).toBe(1);

    const b = await registerUser(env.app, 'Perintis Dua');
    await meetRequirements(b);
    expect((await claim(b)).body.data.claim.slot).toBe(takenBefore + 2);
  });

  it('sertifikat Perintis gratis (bukan Premium) berupa PDF, dan kodenya terverifikasi publik', async () => {
    const s = await registerUser(env.app, 'Dewi Perintis');
    await meetRequirements(s);
    const c = await claim(s);
    const pdf = await s.agent
      .get('/api/program/certificate')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const v = await request(env.app).get(`/api/certificates/${c.body.data.claim.code.toLowerCase()}`);
    expect(v.status).toBe(200);
    expect(v.body.data).toMatchObject({ valid: true, name: 'Dewi Perintis' });
    expect(v.body.data.scope).toContain('Program Perintis');
    expect(v.body.data.scope).toContain(`ke-${c.body.data.claim.slot}`);
  });

  it('sertifikat Perintis tidak bisa diunduh sebelum klaim', async () => {
    const s = await registerUser(env.app);
    await meetRequirements(s);
    expect((await s.agent.get('/api/program/certificate')).status).toBe(403);
  });

  it('kuota terbatas: klaim bersamaan tidak pernah melebihi kuota dan slot unik', async () => {
    const config = testConfig({ PROGRAM_QUOTA: '2' });
    await run(env.db, 'DELETE FROM program_claims');
    const app = createApp(env.db, config, env.mailer, env.google, env.payments);
    const users: Session[] = [];
    for (let i = 0; i < 4; i++) {
      const u = await registerUser(app, `Peserta ${i}`);
      await meetRequirements(u);
      users.push(u);
    }
    const results = await Promise.all(users.map((u) => u.agent.post('/api/program/claim').set('X-CSRF-Token', u.csrf)));
    const ok = results.filter((r) => r.status === 200);
    const failed = results.filter((r) => r.status !== 200);
    expect(ok).toHaveLength(2);
    expect(failed.every((r) => r.status === 409)).toBe(true);
    const slots = (await env.db.query('SELECT slot FROM program_claims ORDER BY slot'))[0] as { slot: number }[];
    expect(slots.map((x) => x.slot)).toEqual([1, 2]);
    const pub = (await request(app).get('/api/program/status')).body.data;
    expect(pub).toMatchObject({ quota: 2, taken: 2, remaining: 0, open: false });
  });

  it('kuota habis: pengguna baru yang memenuhi syarat ditolak dengan pesan jelas', async () => {
    const config = testConfig({ PROGRAM_QUOTA: '1' });
    await run(env.db, 'DELETE FROM program_claims');
    const app = createApp(env.db, config, env.mailer, env.google, env.payments);
    const first = await registerUser(app);
    await meetRequirements(first);
    expect((await first.agent.post('/api/program/claim').set('X-CSRF-Token', first.csrf)).status).toBe(200);
    const late = await registerUser(app);
    await meetRequirements(late);
    const r = await late.agent.post('/api/program/claim').set('X-CSRF-Token', late.csrf);
    expect(r.status).toBe(409);
    expect(r.body.error.message).toContain('Kuota');
  });

  it('program dimatikan lewat konfigurasi', async () => {
    const config = testConfig({ PROGRAM_ENABLED: 'false' });
    const app = createApp(env.db, config, env.mailer, env.google, env.payments);
    const s = await registerUser(app);
    await meetRequirements(s);
    expect((await s.agent.post('/api/program/claim').set('X-CSRF-Token', s.csrf)).status).toBe(409);
    expect((await request(app).get('/api/program/status')).body.data).toMatchObject({ enabled: false, open: false });
  });
});
