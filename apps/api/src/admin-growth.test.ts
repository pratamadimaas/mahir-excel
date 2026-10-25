import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jakartaDate } from '@excellab/shared';
import { row, rows, run } from './db/pool';
import { loginAdmin, registerUser, setupTestEnv, type Session, type TestEnv } from './testutil';

let env: TestEnv;
let admin: Session;
beforeAll(async () => {
  env = await setupTestEnv();
  admin = await loginAdmin(env.app);
});
afterAll(async () => {
  await env.close();
});

const growth = async () => (await admin.agent.get('/api/admin/stats/growth')).body.data;
const funnelOf = (g: { funnel: { key: string; count: number }[] }) => Object.fromEntries(g.funnel.map((f) => [f.key, f.count]));
const pay = (body: Record<string, unknown>) => admin.agent.post('/api/admin/payments').set('X-CSRF-Token', admin.csrf).send(body);
const todayWib = () => jakartaDate(new Date());
const daysAgo = (n: number) => jakartaDate(new Date(Date.now() - n * 86_400_000));
// 12:00 WIB pada tanggal tertentu, dalam UTC, supaya masuk hari yang benar di WIB.
const noonWib = (day: string) => `${day} 05:00:00`;

describe('pertumbuhan: corong akun', () => {
  it('menghitung tiap tahap dari data akun, dan tahap sesudahnya tidak lebih besar dari sebelumnya', async () => {
    const before = funnelOf(await growth());
    const a = await registerUser(env.app);
    const b = await registerUser(env.app);
    await registerUser(env.app); // hanya mendaftar
    const exs = await rows<{ id: number }>(env.db, 'SELECT id FROM exercises WHERE published = 1 ORDER BY id LIMIT 5');
    const lesson = await row<{ id: number }>(env.db, 'SELECT id FROM lessons ORDER BY id LIMIT 1');
    expect(exs.length).toBe(5);
    for (const ex of exs) {
      await run(env.db, "INSERT INTO exercise_attempts (user_id, exercise_id, correct, message, submitted) VALUES (?,?,1,'ok','{}')", [a.userId, ex.id]);
      await run(env.db, 'INSERT INTO exercise_completions (user_id, exercise_id, points) VALUES (?,?,10)', [a.userId, ex.id]);
    }
    await run(env.db, "INSERT INTO exercise_attempts (user_id, exercise_id, correct, message, submitted) VALUES (?,?,0,'salah','{}')", [b.userId, exs[0]!.id]);
    await run(env.db, 'INSERT INTO lesson_progress (user_id, lesson_id) VALUES (?,?)', [b.userId, lesson!.id]);
    await run(env.db, 'UPDATE users SET premium_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 MONTH) WHERE id = ?', [a.userId]);

    const after = funnelOf(await growth());
    expect(after.registered! - before.registered!).toBe(3);
    expect(after.tried! - before.tried!).toBe(2);
    expect(after.solved1! - before.solved1!).toBe(1);
    expect(after.solved5! - before.solved5!).toBe(1);
    expect(after.lesson! - before.lesson!).toBe(1);
    expect(after.premium! - before.premium!).toBe(1);
    // akun admin tidak ikut dihitung
    const adminCount = await row<{ n: number }>(env.db, "SELECT COUNT(*) AS n FROM users WHERE role = 'user'");
    expect(after.registered).toBe(Number(adminCount!.n));
  });
});

describe('pertumbuhan: retensi per hari pendaftaran', () => {
  it('menghitung yang kembali besok dan dalam 7 hari, dan memberi null bila jendelanya belum lewat', async () => {
    const exs = await rows<{ id: number }>(env.db, 'SELECT id FROM exercises WHERE published = 1 ORDER BY id LIMIT 1');
    const exId = exs[0]!.id;
    const cohortDay = daysAgo(10);
    const [a, b, c] = [await registerUser(env.app), await registerUser(env.app), await registerUser(env.app)];
    for (const u of [a, b, c]) await run(env.db, 'UPDATE users SET created_at = ? WHERE id = ?', [noonWib(cohortDay), u.userId]);
    const attempt = (userId: number, day: string) =>
      run(env.db, "INSERT INTO exercise_attempts (user_id, exercise_id, correct, message, submitted, created_at) VALUES (?,?,0,'x','{}',?)", [userId, exId, noonWib(day)]);
    const plus = (n: number) => daysAgo(10 - n);
    await attempt(a.userId, plus(1)); // kembali besok
    await attempt(b.userId, plus(4)); // kembali hanya dalam 7 hari
    await attempt(c.userId, cohortDay); // hanya aktif di hari pendaftaran: tidak dihitung kembali

    // pendaftar kemarin: jendelanya belum lewat
    const d = await registerUser(env.app);
    await run(env.db, 'UPDATE users SET created_at = ? WHERE id = ?', [noonWib(daysAgo(1)), d.userId]);

    const g = await growth();
    const old = g.cohorts.find((x: { day: string }) => x.day === cohortDay);
    expect(old).toMatchObject({ signups: 3, day1: 1, week1: 2 });
    const recent = g.cohorts.find((x: { day: string }) => x.day === daysAgo(1));
    expect(recent.signups).toBeGreaterThanOrEqual(1);
    expect(recent.day1).toBeNull(); // besok = hari ini, belum selesai
    expect(recent.week1).toBeNull();
    // urutan terbaru di atas
    const days = g.cohorts.map((x: { day: string }) => x.day);
    expect([...days].sort().reverse()).toEqual(days);
    expect(g.note).toContain('belum dihitung');
  });

  it('hanya admin yang boleh', async () => {
    const s = await registerUser(env.app);
    expect((await s.agent.get('/api/admin/stats/growth')).status).toBe(403);
  });
});

describe('catatan pembayaran manual', () => {
  it('mencatat pembayaran, menautkannya ke akun, dan menjumlahkan', async () => {
    const before = (await admin.agent.get('/api/admin/payments')).body.data.summary;
    const u = await registerUser(env.app);
    const res = await pay({ payer: u.email, amount: 49000, months: 12, paidOn: todayWib(), note: 'transfer BCA' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ payer: u.email, amount: 49000, months: 12, linkedEmail: u.email, note: 'transfer BCA' });
    const res2 = await pay({ payer: 'Budi (WA 0812)', amount: 29000, months: 12, paidOn: daysAgo(40) });
    expect(res2.status).toBe(201);
    expect(res2.body.data.linkedEmail).toBeNull();

    const list = (await admin.agent.get('/api/admin/payments')).body.data;
    expect(list.summary.count - before.count).toBe(2);
    expect(list.summary.amount - before.amount).toBe(78000);
    expect(list.summary.amount30 - before.amount30).toBe(49000); // yang 40 hari lalu tidak masuk 30 hari
    expect(list.summary.months - before.months).toBe(24);
    expect(list.items[0].paidOn >= list.items[list.items.length - 1].paidOn).toBe(true);
    // mencatat saja tidak mengaktifkan Premium
    const stat = await row<{ premium_until: string | null }>(env.db, 'SELECT premium_until FROM users WHERE id = ?', [u.userId]);
    expect(stat!.premium_until).toBeNull();
  });

  it('opsi aktifkan: memperpanjang Premium dan tercatat di log admin', async () => {
    const u = await registerUser(env.app);
    const res = await pay({ payer: u.email.toUpperCase(), amount: 49000, months: 6, paidOn: todayWib(), activate: true });
    expect(res.status).toBe(201);
    const stat = await row<{ premium_until: string | null }>(env.db, 'SELECT premium_until FROM users WHERE id = ?', [u.userId]);
    expect(stat!.premium_until).not.toBeNull();
    const log = await row<{ n: number }>(env.db, "SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action = 'premium-6m' AND resource_id = ?", [String(u.userId)]);
    expect(Number(log!.n)).toBe(1);
    const addLog = await row<{ n: number }>(env.db, "SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action = 'payment-add'");
    expect(Number(addLog!.n)).toBeGreaterThan(0);
  });

  it('menolak masukan yang tidak benar tanpa menyimpan apa pun', async () => {
    const count = async () => Number((await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM manual_payments'))!.n);
    const n0 = await count();
    const future = jakartaDate(new Date(Date.now() + 3 * 86_400_000));
    expect((await pay({ payer: 'X', amount: 1000, months: 1, paidOn: future })).status).toBe(400);
    expect((await pay({ payer: 'X', amount: 1000, months: 1, paidOn: '2026-02-30' })).status).toBe(400);
    expect((await pay({ payer: 'X', amount: 1000, months: 1, paidOn: 'kemarin' })).status).toBe(400);
    expect((await pay({ payer: '', amount: 1000, months: 1, paidOn: todayWib() })).status).toBe(400);
    expect((await pay({ payer: 'X', amount: -5, months: 1, paidOn: todayWib() })).status).toBe(400);
    expect((await pay({ payer: 'X', amount: 1000, months: 99, paidOn: todayWib() })).status).toBe(400);
    // aktifkan tanpa akun yang cocok, atau tanpa bulan
    expect((await pay({ payer: 'tidak-ada@example.com', amount: 1000, months: 1, paidOn: todayWib(), activate: true })).status).toBe(400);
    const u = await registerUser(env.app);
    expect((await pay({ payer: u.email, amount: 1000, months: 0, paidOn: todayWib(), activate: true })).status).toBe(400);
    expect(await count()).toBe(n0);
  });

  it('menghapus catatan dan mencatatnya di log; id tidak ada memberi 404', async () => {
    const created = await pay({ payer: 'Hapus Saya', amount: 1000, months: 1, paidOn: todayWib() });
    const id = created.body.data.id as number;
    const del = await admin.agent.delete(`/api/admin/payments/${id}`).set('X-CSRF-Token', admin.csrf);
    expect(del.status).toBe(200);
    expect(await row(env.db, 'SELECT id FROM manual_payments WHERE id = ?', [id])).toBeFalsy();
    expect((await admin.agent.delete(`/api/admin/payments/${id}`).set('X-CSRF-Token', admin.csrf)).status).toBe(404);
    const log = await row<{ n: number }>(env.db, "SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action = 'payment-delete' AND resource_id = ?", [String(id)]);
    expect(Number(log!.n)).toBe(1);
  });

  it('hanya admin, dan penulisan butuh token CSRF; akun yang dihapus tidak menghapus catatannya', async () => {
    const s = await registerUser(env.app);
    expect((await s.agent.get('/api/admin/payments')).status).toBe(403);
    expect((await s.agent.post('/api/admin/payments').set('X-CSRF-Token', s.csrf).send({ payer: 'X', amount: 1, paidOn: todayWib() })).status).toBe(403);
    expect((await admin.agent.post('/api/admin/payments').send({ payer: 'X', amount: 1, months: 1, paidOn: todayWib() })).status).toBe(403);

    const u = await registerUser(env.app);
    const created = await pay({ payer: u.email, amount: 5000, months: 1, paidOn: todayWib() });
    await run(env.db, 'DELETE FROM users WHERE id = ?', [u.userId]);
    const kept = await row<{ user_id: number | null; payer: string }>(env.db, 'SELECT user_id, payer FROM manual_payments WHERE id = ?', [created.body.data.id]);
    expect(kept!.user_id).toBeNull();
    expect(kept!.payer).toBe(u.email);
  });
});
