import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Sheet, formatValue, isError } from '@excellab/spreadsheet-engine';
import { shortcuts as seedShortcuts } from '@excellab/shared';
import { row, run } from './db/pool';
import { periodStart } from './routes/sprint';
import { applyAnswer, cleanName, nextQuestion, usableShortcuts, OPTION_COUNT, type Rng } from './lib/sprint';
import { loginAdmin, registerUser, setupTestEnv, type TestEnv } from './testutil';

/** Pembangkit acak berbenih (mulberry32) agar tes pembuat soal deterministik. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pembuat soal Sprint (murni, tanpa database)', () => {
  const pool = usableShortcuts(seedShortcuts.map((s) => ({ action: s.action, keysWindows: s.keysWindows })));

  it('ada cukup shortcut yang jelas untuk dijadikan soal', () => {
    expect(pool.length).toBeGreaterThanOrEqual(15);
    for (const s of pool) expect(s.keysWindows).not.toMatch(/[/(),]|atau/i);
  });

  it.each([0, 5, 9])('2000 soal pada rentetan %i: pilihan unik, kunci benar, dan kunci cocok dengan mesin rumus', (streak) => {
    const rng = seeded(1000 + streak);
    const kinds = new Set<string>();
    const prompts = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const q = nextQuestion(rng, streak, pool);
      kinds.add(q.kind);
      prompts.add(`${q.prompt}|${q.formula}|${JSON.stringify(q.table)}`);
      expect(q.options).toHaveLength(OPTION_COUNT);
      expect(new Set(q.options).size).toBe(OPTION_COUNT);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(OPTION_COUNT);
      expect(q.options.every((o) => o.length > 0 && o.length <= 40)).toBe(true);
      if (q.formula) {
        const cells: Record<string, string> = {};
        q.table.forEach((r, ri) => r.forEach((v, ci) => (cells[`${String.fromCharCode(65 + ci)}${ri + 1}`] = String(v))));
        const v = new Sheet({ ...cells, Z99: q.formula }).getValue('Z99');
        const shown = isError(v)
          ? v.code
          : typeof v === 'number'
            ? formatValue(v)
            : typeof v === 'boolean'
              ? v
                ? 'TRUE'
                : 'FALSE'
              : String(v);
        expect(q.options[q.answerIndex]).toBe(shown);
      }
      if (q.kind === 'galat') expect(q.options[q.answerIndex]).toMatch(/^#/);
      if (q.kind === 'shortcut')
        expect(pool.some((s) => s.keysWindows === q.options[q.answerIndex] && q.prompt.endsWith(s.action))).toBe(true);
    }
    expect(kinds.has('hasil')).toBe(true);
    expect(kinds.has('galat')).toBe(true);
    expect(kinds.has('shortcut')).toBe(true);
    expect(prompts.size).toBeGreaterThan(300); // soal sangat beragam, bukan bank kecil yang berulang
  });

  it('posisi jawaban benar tersebar merata di keempat pilihan', () => {
    const rng = seeded(7);
    const count = [0, 0, 0, 0];
    for (let i = 0; i < 2000; i++) count[nextQuestion(rng, 0, pool).answerIndex]!++;
    for (const c of count) expect(c).toBeGreaterThan(350);
  });

  it('tingkat kesulitan naik: rentetan tinggi memunculkan soal yang tidak muncul di awal', () => {
    const formulas = (streak: number): Set<string> => {
      const rng = seeded(99);
      const out = new Set<string>();
      for (let i = 0; i < 1500; i++) {
        const q = nextQuestion(rng, streak, pool);
        const fn = q.formula && q.kind === 'hasil' ? /^=([A-Z]+)\(/.exec(q.formula)?.[1] : undefined;
        if (fn) out.add(fn);
      }
      return out;
    };
    const early = formulas(0);
    const late = formulas(9);
    expect(early.has('VLOOKUP')).toBe(false);
    expect(early.has('COUNTIF')).toBe(false);
    expect(late.has('VLOOKUP')).toBe(true);
    expect(late.has('COUNTIF')).toBe(true);
  });
});

describe('skor dan nama', () => {
  it('benar +10 ditambah bonus rentetan (maks 5x2), salah -5 dan memutus rentetan, tidak di bawah 0', () => {
    let s = { score: 0, streak: 0 };
    const deltas: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = applyAnswer(s, true);
      deltas.push(r.delta);
      s = r;
    }
    expect(deltas).toEqual([10, 12, 14, 16, 18, 20, 20, 20]);
    const wrong = applyAnswer(s, false);
    expect(wrong).toMatchObject({ streak: 0, delta: -5 });
    expect(wrong.score).toBe(s.score - 5);
    expect(applyAnswer({ score: 3, streak: 4 }, false)).toEqual({ score: 0, streak: 0, delta: -3 });
    expect(applyAnswer({ score: 0, streak: 0 }, false).score).toBe(0);
  });

  it('menebak acak merugi, menjawab benar menang', () => {
    // Peluang tebak 1/4: nilai harapan per soal harus negatif.
    expect(0.25 * 10 - 0.75 * 5).toBeLessThan(0);
  });

  it.each([
    ['Budi', 'Budi'],
    ['  Sari   Dewi ', 'Sari Dewi'],
    ["D'Angelo_99", "D'Angelo_99"],
    ['Aku.Si-Jago', 'Aku.Si-Jago'],
    ['Ångström', 'Ångström'],
    ['nama\ntiga', 'nama tiga'],
  ])('nama valid %j', (raw, expected) => expect(cleanName(raw)).toBe(expected));

  it.each([
    'a',
    'x'.repeat(21),
    '<script>alert(1)</script>',
    'https://jahat.com',
    'kunjungi www.jahat',
    'budi@gmail',
    'cek jahat.com',
    '   ',
    '',
    'emoji 😀',
  ])('nama tidak valid %j ditolak', (raw) => expect(cleanName(raw)).toBeNull());

  it('awal hari memakai zona WIB', () => {
    const noonWib = Date.UTC(2026, 9, 19, 5, 0, 0); // 12:00 WIB
    const startToday = periodStart('today', noonWib);
    expect(new Date(startToday).toISOString()).toBe('2026-10-18T17:00:00.000Z'); // 00:00 WIB tanggal 19
    expect(periodStart('all', noonWib)).toBe(0);
    expect(noonWib - periodStart('week', noonWib)).toBe(7 * 24 * 3600 * 1000);
    const justAfterMidnightWib = Date.UTC(2026, 9, 18, 17, 30, 0); // 00:30 WIB tanggal 19
    expect(new Date(periodStart('today', justAfterMidnightWib)).toISOString()).toBe('2026-10-18T17:00:00.000Z');
  });
});

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

const api = () => request(env.app);

async function startRound() {
  const r = await api().post('/api/sprint/start').send({});
  expect(r.status).toBe(201);
  return { token: r.body.data.token as string, data: r.body.data };
}
/** Memajukan jam "soal tampil" ke masa lalu agar jawaban tidak ditolak sebagai terlalu cepat. */
const unhurry = (token: string) => run(env.db, 'UPDATE sprint_sessions SET issued_ms = issued_ms - 5000 WHERE token = ?', [token]);
const keyOf = async (token: string): Promise<number> =>
  (await row<{ answer_idx: number }>(env.db, 'SELECT answer_idx FROM sprint_sessions WHERE token = ?', [token]))!.answer_idx;
const endRound = (token: string) =>
  run(
    env.db,
    'UPDATE sprint_sessions SET started_ms = started_ms - 120000, ends_ms = ends_ms - 120000, issued_ms = issued_ms - 120000 WHERE token = ?',
    [token],
  );

async function answer(token: string, q: number, correct: boolean) {
  await unhurry(token);
  const key = await keyOf(token);
  return api()
    .post(`/api/sprint/${token}/answer`)
    .send({ q, choice: correct ? key : (key + 1) % 4 });
}

describe('alur ronde Sprint', () => {
  it('mulai tanpa akun: token acak, soal tanpa kunci jawaban, dan batas waktu dari server', async () => {
    const { token, data } = await startRound();
    expect(token).toMatch(/^[a-f0-9]{48}$/);
    expect(data.durationMs).toBe(env.config.sprintSeconds * 1000);
    expect(data.endsAtMs - data.serverNowMs).toBe(data.durationMs);
    expect(data.question.index).toBe(0);
    expect(data.question.options).toHaveLength(4);
    expect(Object.keys(data.question).sort()).toEqual(['formula', 'index', 'kind', 'options', 'prompt', 'table']);
    expect(JSON.stringify(data)).not.toMatch(/answer|correctIndex|kunci/i);
  });

  it('jawaban benar memberi 10, lalu 12 untuk rentetan; salah -5; respons memuat soal berikutnya dan kunci soal tadi', async () => {
    const { token } = await startRound();
    const a1 = await answer(token, 0, true);
    expect(a1.status).toBe(200);
    expect(a1.body.data).toMatchObject({ accepted: true, correct: true, delta: 10, score: 10, streak: 1, finished: false });
    expect(a1.body.data.question.index).toBe(1);
    expect(a1.body.data.correctIndex).toBeGreaterThanOrEqual(0);
    const a2 = await answer(token, 1, true);
    expect(a2.body.data).toMatchObject({ delta: 12, score: 22, streak: 2 });
    const a3 = await answer(token, 2, false);
    expect(a3.body.data).toMatchObject({ correct: false, delta: -5, score: 17, streak: 0, wrongCount: 1, correctCount: 2 });
    // Soal tidak mengulang kunci yang sama secara berurutan secara tetap: indeks berikutnya selalu naik.
    expect(a3.body.data.question.index).toBe(3);
  });

  it('skor tidak pernah negatif', async () => {
    const { token } = await startRound();
    const r = await answer(token, 0, false);
    expect(r.body.data.score).toBe(0);
  });

  it('terlalu cepat ditolak tanpa mengorbankan soal; nomor soal yang salah ditolak', async () => {
    const { token } = await startRound();
    const fast = await api().post(`/api/sprint/${token}/answer`).send({ q: 0, choice: 0 });
    expect(fast.status).toBe(429);
    const wrongQ = await api().post(`/api/sprint/${token}/answer`).send({ q: 5, choice: 0 });
    expect(wrongQ.status).toBe(409);
    // Soal 0 masih aktif dan bisa dijawab setelah jeda.
    expect((await answer(token, 0, true)).status).toBe(200);
  });

  it('dua jawaban bersamaan untuk soal yang sama: hanya satu yang dihitung', async () => {
    const { token } = await startRound();
    await unhurry(token);
    const key = await keyOf(token);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => api().post(`/api/sprint/${token}/answer`).send({ q: 0, choice: key })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const s = await row<{ score: number; correct: number }>(env.db, 'SELECT score, correct FROM sprint_sessions WHERE token = ?', [token]);
    expect(s).toMatchObject({ score: 10, correct: 1 });
  });

  it('token ngawur atau tidak dikenal ditolak', async () => {
    expect((await api().post('/api/sprint/bukan-token/answer').send({ q: 0, choice: 0 })).status).toBe(400);
    expect(
      (
        await api()
          .post(`/api/sprint/${'a'.repeat(48)}/answer`)
          .send({ q: 0, choice: 0 })
      ).status,
    ).toBe(404);
    const { token } = await startRound();
    for (const body of [{}, { q: -1, choice: 0 }, { q: 0, choice: 4 }, { q: 0, choice: 'a' }, { q: 0.5, choice: 1 }])
      expect((await api().post(`/api/sprint/${token}/answer`).send(body)).status).toBe(400);
  });

  it('jawaban setelah waktu habis tidak dihitung dan ronde ditutup', async () => {
    const { token } = await startRound();
    expect((await answer(token, 0, true)).body.data.score).toBe(10);
    await endRound(token);
    const late = await api().post(`/api/sprint/${token}/answer`).send({ q: 1, choice: 0 });
    expect(late.status).toBe(200);
    expect(late.body.data).toMatchObject({ finished: true, accepted: false, score: 10 });
    const s = await row<{ score: number; finished: number }>(env.db, 'SELECT score, finished FROM sprint_sessions WHERE token = ?', [
      token,
    ]);
    expect(s).toMatchObject({ score: 10, finished: 1 });
    // Setelah selesai, jawaban lagi ditolak.
    expect((await api().post(`/api/sprint/${token}/answer`).send({ q: 1, choice: 0 })).status).toBe(409);
  });

  it('jawaban terakhir yang tiba tepat saat waktu habis (dalam toleransi) dihitung dan menutup ronde', async () => {
    const { token } = await startRound();
    await unhurry(token);
    await run(env.db, 'UPDATE sprint_sessions SET ends_ms = ? WHERE token = ?', [Date.now() - 300, token]);
    const key = await keyOf(token);
    const r = await api().post(`/api/sprint/${token}/answer`).send({ q: 0, choice: key });
    expect(r.body.data).toMatchObject({ accepted: true, correct: true, finished: true, question: null, score: 10 });
  });

  it('selesai lebih awal ditolak; setelah waktu habis mengembalikan ringkasan dan peringkat', async () => {
    const { token } = await startRound();
    expect((await api().post(`/api/sprint/${token}/finish`).send({})).status).toBe(409);
    await answer(token, 0, true);
    await endRound(token);
    const r = await api().post(`/api/sprint/${token}/finish`).send({});
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ score: 10, correct: 1, wrong: 0, canSubmit: true, submitted: false });
    expect(r.body.data.rankToday).toBeGreaterThanOrEqual(1);
    // Idempoten.
    expect((await api().post(`/api/sprint/${token}/finish`).send({})).body.data.score).toBe(10);
  });
});

describe('papan peringkat', () => {
  /** Menyelesaikan satu ronde dengan N jawaban benar lalu menyimpan nama. */
  async function playAndSubmit(name: string, rights: number) {
    const { token } = await startRound();
    for (let i = 0; i < rights; i++) await answer(token, i, true);
    await endRound(token);
    return { token, res: await api().post(`/api/sprint/${token}/submit`).send({ name }) };
  }

  it('skor tersimpan setelah ronde selesai, muncul di papan, dan tidak bisa disimpan dua kali', async () => {
    const { token, res } = await playAndSubmit('Pemain Satu', 3);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ saved: true, name: 'Pemain Satu' });
    const again = await api().post(`/api/sprint/${token}/submit`).send({ name: 'Orang Lain' });
    expect(again.status).toBe(409);
    const board = await api().get('/api/sprint/leaderboard?period=all');
    expect(board.status).toBe(200);
    const mine = board.body.data.entries.find((e: { name: string }) => e.name === 'Pemain Satu');
    expect(mine).toMatchObject({ score: 10 + 12 + 14, correct: 3, wrong: 0 });
    expect(board.body.data.entries[0].rank).toBe(1);
    expect(board.body.data.durationSeconds).toBe(env.config.sprintSeconds);
  });

  it('tidak bisa menyimpan sebelum ronde selesai, dengan skor 0, atau dengan nama tidak valid', async () => {
    const live = await startRound();
    await answer(live.token, 0, true);
    expect((await api().post(`/api/sprint/${live.token}/submit`).send({ name: 'Terlalu Dini' })).status).toBe(409);

    const zero = await startRound();
    await endRound(zero.token);
    const z = await api().post(`/api/sprint/${zero.token}/submit`).send({ name: 'Nol Besar' });
    expect(z.status).toBe(400);

    const done = await startRound();
    await answer(done.token, 0, true);
    await endRound(done.token);
    for (const name of ['', 'x', '<b>tebal</b>', 'https://jahat.com', 'a'.repeat(30)]) {
      const r = await api().post(`/api/sprint/${done.token}/submit`).send({ name });
      expect(r.status, name).toBe(400);
    }
    expect((await api().post(`/api/sprint/${done.token}/submit`).send({})).status).toBe(400);
    // Nama yang benar tetap bisa dipakai setelah salah beberapa kali.
    expect((await api().post(`/api/sprint/${done.token}/submit`).send({ name: 'Nama Benar' })).status).toBe(201);
  });

  it('satu baris per nama (tanpa peduli huruf besar), urut skor, dan peringkat seri sama', async () => {
    await playAndSubmit('Dobel', 2);
    await playAndSubmit('DOBEL', 5); // nama sama, skor lebih tinggi
    await playAndSubmit('Seri A', 4);
    await playAndSubmit('Seri B', 4);
    const board = await api().get('/api/sprint/leaderboard?period=all&limit=50');
    const entries = board.body.data.entries as { name: string; score: number; rank: number }[];
    expect(entries.filter((e) => e.name.toLowerCase() === 'dobel')).toHaveLength(1);
    expect(entries.find((e) => e.name.toLowerCase() === 'dobel')!.score).toBe(10 + 12 + 14 + 16 + 18);
    const scores = entries.map((e) => e.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const a = entries.find((e) => e.name === 'Seri A')!;
    const b = entries.find((e) => e.name === 'Seri B')!;
    expect(a.rank).toBe(b.rank);
    expect(new Set(entries.map((e) => e.name.toLowerCase())).size).toBe(entries.length);
  });

  it('periode: hari ini dan pekan ini tidak memuat skor lama; "semua" memuatnya', async () => {
    const { token } = await playAndSubmit('Pemain Lama', 2);
    const s = await row<{ id: number }>(env.db, 'SELECT id FROM sprint_sessions WHERE token = ?', [token]);
    await run(env.db, 'UPDATE sprint_scores SET created_ms = ? WHERE session_id = ?', [Date.now() - 10 * 24 * 3600 * 1000, s!.id]);
    const names = async (p: string) =>
      ((await api().get(`/api/sprint/leaderboard?period=${p}`)).body.data.entries as { name: string }[]).map((e) => e.name);
    expect(await names('today')).not.toContain('Pemain Lama');
    expect(await names('week')).not.toContain('Pemain Lama');
    expect(await names('all')).toContain('Pemain Lama');
    expect((await api().get('/api/sprint/leaderboard?period=kemarin')).status).toBe(400);
    expect((await api().get('/api/sprint/leaderboard?limit=500')).status).toBe(400);
  });

  it('pengguna yang sedang masuk tertaut ke skornya, tetapi papan hanya menampilkan nama', async () => {
    const u = await registerUser(env.app, 'Akun Bernama');
    const start = await u.agent.post('/api/sprint/start').set('x-csrf-token', u.csrf).send({});
    const token = start.body.data.token as string;
    await answer(token, 0, true);
    await endRound(token);
    const r = await u.agent.post(`/api/sprint/${token}/submit`).set('x-csrf-token', u.csrf).send({ name: 'Si Akun' });
    expect(r.status).toBe(201);
    const stored = await row<{ user_id: number }>(env.db, 'SELECT user_id FROM sprint_scores WHERE name = ?', ['Si Akun']);
    expect(stored?.user_id).toBe(u.userId);
    const board = await api().get('/api/sprint/leaderboard?period=all&limit=50');
    expect(JSON.stringify(board.body)).not.toContain(u.email);
    expect(JSON.stringify(board.body)).not.toMatch(/user_id|userId|email/);
  });
});

describe('moderasi admin', () => {
  it('admin melihat semua skor, bisa menyembunyikan dan menampilkan kembali; pengguna biasa dan anonim ditolak', async () => {
    const { token } = await startRound();
    await answer(token, 0, true);
    await endRound(token);
    await api().post(`/api/sprint/${token}/submit`).send({ name: 'Nama Nakal' });

    const admin = await loginAdmin(env.app);
    const list = await admin.agent.get('/api/admin/sprint');
    expect(list.status).toBe(200);
    const entry = (list.body.data.entries as { id: number; name: string; hidden: boolean }[]).find((e) => e.name === 'Nama Nakal')!;
    expect(entry.hidden).toBe(false);

    const hide = await admin.agent.put(`/api/admin/sprint/${entry.id}`).set('x-csrf-token', admin.csrf).send({ hidden: true });
    expect(hide.status).toBe(200);
    const after = await api().get('/api/sprint/leaderboard?period=all&limit=50');
    expect((after.body.data.entries as { name: string }[]).some((e) => e.name === 'Nama Nakal')).toBe(false);
    // Tetap terlihat oleh admin dengan tanda tersembunyi.
    const again = await admin.agent.get('/api/admin/sprint');
    expect((again.body.data.entries as { name: string; hidden: boolean }[]).find((e) => e.name === 'Nama Nakal')!.hidden).toBe(true);

    await admin.agent.put(`/api/admin/sprint/${entry.id}`).set('x-csrf-token', admin.csrf).send({ hidden: false });
    const back = await api().get('/api/sprint/leaderboard?period=all&limit=50');
    expect((back.body.data.entries as { name: string }[]).some((e) => e.name === 'Nama Nakal')).toBe(true);

    expect((await admin.agent.put('/api/admin/sprint/99999999').set('x-csrf-token', admin.csrf).send({ hidden: true })).status).toBe(404);
    expect((await admin.agent.put(`/api/admin/sprint/${entry.id}`).set('x-csrf-token', admin.csrf).send({ hidden: 'ya' })).status).toBe(
      400,
    );

    const user = await registerUser(env.app);
    expect((await user.agent.get('/api/admin/sprint')).status).toBe(403);
    expect((await user.agent.put(`/api/admin/sprint/${entry.id}`).set('x-csrf-token', user.csrf).send({ hidden: true })).status).toBe(403);
    expect((await api().get('/api/admin/sprint')).status).toBe(401);
  });
});
