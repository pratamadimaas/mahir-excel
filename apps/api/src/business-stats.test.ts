import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { templates } from '@excellab/shared';
import { row, run } from './db/pool';
import { countNotFound, sourceLabel } from './routes/track';
import { grantPremium, loginAdmin, registerUser, setupTestEnv, type Session, type TestEnv } from './testutil';

let env: TestEnv;
let admin: Session;
beforeAll(async () => {
  env = await setupTestEnv();
  admin = await loginAdmin(env.app);
});
afterAll(async () => {
  await env.close();
});

const usage = async () => (await admin.agent.get('/api/admin/stats/usage')).body.data;
const track = (ua: string, body: Record<string, string>) => request(env.app).post('/api/track').set('User-Agent', ua).send(body);
const setPremium = (id: number, months: number) => admin.agent.put(`/api/admin/users/${id}/premium`).set('X-CSRF-Token', admin.csrf).send({ months });

describe('nama sumber kunjungan', () => {
  it('memetakan host dan utm_source ke nama yang ramah', () => {
    expect(sourceLabel('l.instagram.com')).toBe('Instagram');
    expect(sourceLabel('www.threads.com')).toBe('Threads');
    expect(sourceLabel('threads.net')).toBe('Threads');
    expect(sourceLabel('www.google.co.id')).toBe('Google');
    expect(sourceLabel('vm.tiktok.com')).toBe('TikTok');
    expect(sourceLabel('t.co')).toBe('X');
    expect(sourceLabel('l.facebook.com')).toBe('Facebook');
    expect(sourceLabel('wa.me')).toBe('WhatsApp');
    expect(sourceLabel('langsung')).toBe('Langsung');
    expect(sourceLabel('')).toBe('Langsung');
    expect(sourceLabel('blog.contoh.id')).toBe('blog.contoh.id');
    expect(sourceLabel('instagram.com.evil.id')).toBe('instagram.com.evil.id');
  });
});

describe('sumber kunjungan, pemakaian fitur, dan alamat 404 di admin', () => {
  it('sumber dihitung sekali per pengunjung per hari dan memakai nama ramah', async () => {
    expect((await track('ua-ig-1', { path: '/', src: 'l.instagram.com' })).status).toBe(202);
    await track('ua-ig-1', { path: '/jalur', src: 'tiktok.com' }); // pengunjung sama hari yang sama: tidak dihitung lagi
    await track('ua-ig-2', { path: '/', src: 'l.instagram.com' });
    await track('ua-direct', { path: '/', src: 'langsung' });
    await track('ua-utm', { path: '/', src: 'threads' });
    const sources = Object.fromEntries((await usage()).sources.map((s: { source: string; visitors: number }) => [s.source, s.visitors]));
    expect(sources.Instagram).toBe(2);
    expect(sources.Langsung).toBe(1);
    expect(sources.Threads).toBe(1);
    expect(sources.TikTok).toBeUndefined();
  });

  it('src yang tidak valid ditolak dan pengunjung dengan Do Not Track tidak dihitung', async () => {
    expect((await track('ua-bad', { path: '/', src: 'a b/c' })).status).toBe(400);
    const dnt = await request(env.app).post('/api/track').set('User-Agent', 'ua-dnt').set('DNT', '1').send({ path: '/', src: 'google.com' });
    expect(dnt.body.data.counted).toBe(false);
    const sources = (await usage()).sources as { source: string }[];
    expect(sources.some((s) => s.source === 'Google')).toBe(false);
  });

  it('halaman jalur dicatat per slug', async () => {
    await track('ua-jalur', { path: '/jalur/perkantoran-admin' });
    await track('ua-jalur2', { path: '/jalur/tidak-ada' });
    const pages = Object.fromEntries((await usage()).topPages.map((p: { page: string; views: number }) => [p.page, p.views]));
    expect(pages['/jalur/perkantoran-admin']).toBe(1);
    expect(pages['/jalur/(tidak-ada)']).toBe(1);
  });

  it('unduhan template dan contekan dicatat sebagai pemakaian fitur', async () => {
    const s = await registerUser(env.app);
    await grantPremium(env, s.userId);
    const free = templates.find((t) => t.free)!.slug;
    const get = (url: string) =>
      s.agent
        .get(url)
        .buffer(true)
        .parse((res, cb) => {
          res.on('data', () => undefined);
          res.on('end', () => cb(null, Buffer.alloc(0)));
        });
    expect((await get(`/api/templates/${free}/download`)).status).toBe(200);
    expect((await get('/api/cheatsheets/logika/download')).status).toBe(200);
    expect((await s.agent.get('/api/progress/report')).status).toBe(200);
    // Pencatatan berjalan tanpa menunggu respons; beri waktu singkat.
    await new Promise((r) => setTimeout(r, 300));
    const features = Object.fromEntries((await usage()).features.map((f: { feature: string; count: number }) => [f.feature, f.count]));
    expect(features[`template:${free}`]).toBe(1);
    expect(features['cheatsheet:logika']).toBe(1);
    expect(features['laporan-kemajuan']).toBe(1);
  });

  it('alamat 404 dibersihkan, dihitung, dan dibatasi jumlah alamat berbeda per hari', async () => {
    await countNotFound(env.db, '/ads.txt');
    await countNotFound(env.db, '/ads.txt');
    await countNotFound(env.db, '/wp-login.php?x=<script>');
    let nf = Object.fromEntries((await usage()).notFound.map((n: { path: string; hits: number }) => [n.path, n.hits]));
    expect(nf['/ads.txt']).toBe(2);
    expect(nf['/wp-login.phpxscript']).toBe(1);
    for (let i = 0; i < 205; i++) await countNotFound(env.db, `/scan-${i}`);
    const distinct = await row<{ n: number }>(env.db, "SELECT COUNT(*) AS n FROM daily_stats WHERE metric = 'notfound'");
    expect(Number(distinct!.n)).toBe(200);
    await countNotFound(env.db, '/ads.txt'); // alamat yang sudah tercatat tetap bertambah
    nf = Object.fromEntries((await usage()).notFound.map((n: { path: string; hits: number }) => [n.path, n.hits]));
    expect(nf['/ads.txt']).toBe(3);
  });

  it('hanya admin yang boleh melihat statistik', async () => {
    const s = await registerUser(env.app);
    expect((await s.agent.get('/api/admin/stats/usage')).status).toBe(403);
    expect((await s.agent.get('/api/admin/stats/premium')).status).toBe(403);
  });
});

describe('ringkasan Premium untuk admin', () => {
  it('menghitung aktif, segera habis, riwayat aktivasi, dan perkiraan pendapatan', async () => {
    const a = await registerUser(env.app);
    const b = await registerUser(env.app);
    const c = await registerUser(env.app);
    const before = (await admin.agent.get('/api/admin/stats/premium')).body.data;
    expect((await setPremium(a.userId, 12)).status).toBe(200);
    expect((await setPremium(b.userId, 1)).status).toBe(200);
    // Satu bulan lebih dari 30 hari; majukan tanggal habisnya supaya masuk jendela "segera habis".
    await run(env.db, 'UPDATE users SET premium_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 DAY) WHERE id = ?', [b.userId]);
    expect((await setPremium(c.userId, 6)).status).toBe(200);
    expect((await setPremium(c.userId, 0)).status).toBe(200); // dicabut, bukan aktivasi baru
    const d = (await admin.agent.get('/api/admin/stats/premium')).body.data;
    expect(d.active - before.active).toBe(2);
    expect(d.grants - before.grants).toBe(3);
    expect(d.grants30 - before.grants30).toBe(3);
    // Harga bawaan 29.000 untuk 12 bulan: 12 + 1 + 6 bulan = 19 bulan.
    expect(d.estimatedRevenue - before.estimatedRevenue).toBeCloseTo((19 / 12) * 29000, -1);
    expect(d.expiring.map((e: { email: string }) => e.email)).toContain(b.email);
    expect(d.expiring.map((e: { email: string }) => e.email)).not.toContain(a.email);
    expect(d.recent.map((g: { email: string }) => g.email)).toEqual(expect.arrayContaining([a.email, b.email, c.email]));
    expect(d.recent.find((g: { email: string }) => g.email === a.email)).toMatchObject({ months: 12 });
    expect(d.rate).toBeGreaterThan(0);
    expect(d.note).toContain('batas atas');
  });
});
