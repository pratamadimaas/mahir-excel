import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { createXendit } from './lib/xendit';
import { row, run } from './db/pool';
import { CALLBACK_TOKEN, registerUser, setupTestEnv, testConfig, type Session, type TestEnv } from './testutil';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => {
  await env.close();
});

const order = (s: Session) => s.agent.post('/api/payments/premium-order').set('X-CSRF-Token', s.csrf);
const callback = (body: unknown, token: string | null = CALLBACK_TOKEN) => {
  const r = request(env.app).post('/api/payments/xendit/callback');
  return (token === null ? r : r.set('x-callback-token', token)).send(body as object);
};
const paidBody = (reference: string, amount: number, extra: object = {}) => ({
  event: 'qr.payment',
  id: 'qrpy_uji_1',
  amount,
  status: 'COMPLETED',
  qr_code: { id: 'qr_uji_1', external_id: reference, type: 'DYNAMIC' },
  ...extra,
});
const refOf = async (orderId: number): Promise<string> =>
  (await row<{ reference: string }>(env.db, 'SELECT reference FROM premium_orders WHERE id = ?', [orderId]))!.reference;
const premiumUntil = async (s: Session): Promise<string | null> =>
  (await row<{ premium_until: string | null }>(env.db, 'SELECT premium_until FROM users WHERE id = ?', [s.userId]))!.premium_until;

describe('pembayaran Premium lewat QRIS', () => {
  it('konfigurasi publik memberi tahu pembayaran aktif dan harganya, tanpa rahasia', async () => {
    const r = await request(env.app).get('/api/auth/config');
    expect(r.body.data.premium).toMatchObject({ paymentEnabled: true, priceIdr: 29000, months: 12 });
    expect(JSON.stringify(r.body)).not.toContain(CALLBACK_TOKEN);
    expect(JSON.stringify(r.body)).not.toContain('xnd_');
  });

  it('membuat pesanan membutuhkan login', async () => {
    expect((await request(env.app).post('/api/payments/premium-order')).status).toBe(401);
  });

  it('membuat pesanan mengembalikan QR dan memakai ulang pesanan yang masih berlaku', async () => {
    const s = await registerUser(env.app);
    const first = await order(s);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ status: 'pending', amount: 29000, months: 12 });
    expect(first.body.data.qrString).toContain('QRIS-UJI');
    const before = env.payments.created.length;
    const second = await order(s);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(env.payments.created.length).toBe(before);
    expect(env.payments.created.at(-1)!.callbackUrl).toMatch(/\/api\/payments\/xendit\/callback$/);
  });

  it('gagal membuat QR di Xendit: galat 502 dan tidak ada pesanan menggantung', async () => {
    const s = await registerUser(env.app);
    env.payments.failNext = true;
    const r = await order(s);
    expect(r.status).toBe(502);
    expect(r.body.error.code).toBe('PAYMENT_PROVIDER_ERROR');
    const n = await row<{ n: number }>(env.db, 'SELECT COUNT(*) AS n FROM premium_orders WHERE user_id = ?', [s.userId]);
    expect(Number(n!.n)).toBe(0);
  });

  it('callback tanpa token atau dengan token salah ditolak dan tidak memberi Premium', async () => {
    const s = await registerUser(env.app);
    const o = await order(s);
    const ref = await refOf(o.body.data.id);
    expect((await callback(paidBody(ref, 29000), null)).status).toBe(401);
    expect((await callback(paidBody(ref, 29000), 'salah')).status).toBe(401);
    expect(await premiumUntil(s)).toBeNull();
    expect((await s.agent.get(`/api/payments/orders/${o.body.data.id}`)).body.data.status).toBe('pending');
  });

  it('callback sah mengaktifkan Premium, bersifat idempoten, dan status pesanan berubah jadi paid', async () => {
    const s = await registerUser(env.app);
    const o = await order(s);
    const ref = await refOf(o.body.data.id);
    expect((await callback(paidBody(ref, 29000))).status).toBe(200);
    const until = await premiumUntil(s);
    expect(until).not.toBeNull();
    expect((await callback(paidBody(ref, 29000))).status).toBe(200);
    expect(await premiumUntil(s)).toBe(until);
    const st = await s.agent.get(`/api/payments/orders/${o.body.data.id}`);
    expect(st.body.data).toMatchObject({ status: 'paid', qrString: null });
    expect(st.body.data.paidAt).toBeTruthy();
    const me = await s.agent.get('/api/auth/me');
    expect(me.body.data.user.premium).toBe(true);
    // Fitur Premium benar-benar terbuka setelah bayar.
    expect((await s.agent.get('/api/worksheets/absensi-karyawan/download')).status).toBe(200);
  });

  it('perpanjangan menambah dari masa aktif yang tersisa, bukan dari hari ini', async () => {
    const s = await registerUser(env.app);
    await run(env.db, 'UPDATE users SET premium_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 6 MONTH) WHERE id = ?', [s.userId]);
    const o = await order(s);
    await callback(paidBody(await refOf(o.body.data.id), 29000));
    const diff = await row<{ m: number }>(
      env.db,
      'SELECT TIMESTAMPDIFF(MONTH, UTC_TIMESTAMP(), premium_until) AS m FROM users WHERE id = ?',
      [s.userId],
    );
    expect(Number(diff!.m)).toBeGreaterThanOrEqual(17);
  });

  it('jumlah yang tidak cocok, status belum selesai, atau event lain tidak memberi Premium', async () => {
    const s = await registerUser(env.app);
    const o = await order(s);
    const ref = await refOf(o.body.data.id);
    expect((await callback(paidBody(ref, 1500))).status).toBe(200);
    expect((await callback(paidBody(ref, 29000, { status: 'PENDING' }))).status).toBe(200);
    expect((await callback(paidBody(ref, 29000, { event: 'qr.refund' }))).status).toBe(200);
    expect((await callback(paidBody('MX-tidak-ada', 29000))).status).toBe(200);
    expect(await premiumUntil(s)).toBeNull();
  });

  it('pengguna lain tidak bisa melihat pesananmu', async () => {
    const a = await registerUser(env.app);
    const b = await registerUser(env.app);
    const o = await order(a);
    expect((await b.agent.get(`/api/payments/orders/${o.body.data.id}`)).status).toBe(404);
    expect((await a.agent.get(`/api/payments/orders/${o.body.data.id}`)).status).toBe(200);
    expect((await request(env.app).get(`/api/payments/orders/${o.body.data.id}`)).status).toBe(401);
  });

  it('pesanan yang lewat batas waktu tampil expired, dan QR baru dibuat; bayar telat tetap dihormati', async () => {
    const s = await registerUser(env.app);
    const o = await order(s);
    const id = o.body.data.id as number;
    await run(env.db, 'UPDATE premium_orders SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE id = ?', [id]);
    expect((await s.agent.get(`/api/payments/orders/${id}`)).body.data).toMatchObject({ status: 'expired', qrString: null });
    const fresh = await order(s);
    expect(fresh.status).toBe(201);
    expect(fresh.body.data.id).not.toBe(id);
    await callback(paidBody(await refOf(id), 29000));
    expect(await premiumUntil(s)).not.toBeNull();
  });

  it('tanpa kunci Xendit: pembayaran otomatis nonaktif dan callback ditolak', async () => {
    const config = testConfig({ XENDIT_SECRET_KEY: '', XENDIT_CALLBACK_TOKEN: '' });
    const gateway = createXendit(config);
    expect(gateway.enabled).toBe(false);
    const app = createApp(env.db, config, env.mailer, env.google, gateway);
    const cfg = await request(app).get('/api/auth/config');
    expect(cfg.body.data.premium.paymentEnabled).toBe(false);
    expect((await request(app).post('/api/payments/xendit/callback').set('x-callback-token', '').send({})).status).toBe(401);
    const agent = request.agent(app);
    const reg = await agent.post('/api/auth/register').send({ email: `nokey${Date.now()}@example.com`, password: 'sandi-aman-123', displayName: 'Tanpa Kunci' });
    const r = await agent.post('/api/payments/premium-order').set('X-CSRF-Token', reg.body.data.csrfToken);
    expect(r.status).toBe(503);
  });

  it('klien Xendit memakai basic auth, external_id, dan jumlah yang benar', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'qr_1', qr_string: '000201xyz', status: 'ACTIVE' }), { status: 200 });
    }) as unknown as typeof fetch;
    const gateway = createXendit(testConfig(), fakeFetch);
    const out = await gateway.createQr({ reference: 'MX-1', amount: 29000, callbackUrl: 'https://x.test/cb' });
    expect(out).toEqual({ qrId: 'qr_1', qrString: '000201xyz' });
    expect(calls[0]!.url).toBe('https://api.xendit.co/qr_codes');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('xnd_development_test:').toString('base64')}`);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      external_id: 'MX-1',
      type: 'DYNAMIC',
      callback_url: 'https://x.test/cb',
      amount: 29000,
    });
    const bad = createXendit(testConfig(), (async () => new Response(JSON.stringify({ error_code: 'API_VALIDATION_ERROR' }), { status: 400 })) as unknown as typeof fetch);
    await expect(bad.createQr({ reference: 'MX-2', amount: 100, callbackUrl: 'https://x.test/cb' })).rejects.toThrow(/400/);
  });
});
