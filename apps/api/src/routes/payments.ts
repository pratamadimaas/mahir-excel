import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Ctx } from '../app';
import { row, run, withTransaction } from '../db/pool';
import { AppError, notFound, parse } from '../middleware/errors';

/** Pesanan QRIS dianggap kedaluwarsa di tampilan setelah sekian menit; pembayaran yang telat tetap dihormati. */
const ORDER_MINUTES = 30;

interface OrderRow {
  id: number;
  user_id: number;
  reference: string;
  amount: number;
  months: number;
  status: 'pending' | 'paid';
  qr_id: string | null;
  qr_string: string | null;
  expires_at: string;
  paid_at: string | null;
}

const iso = (db: string | null): string | null => (db ? new Date(`${db.replace(' ', 'T')}Z`).toISOString() : null);

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const idParam = z.coerce.number().int().positive();

const callbackBody = z
  .object({
    event: z.string().optional(),
    id: z.string().optional(),
    amount: z.coerce.number().optional(),
    status: z.string().optional(),
    qr_code: z.object({ external_id: z.string().optional() }).partial().optional(),
  })
  .passthrough();

export function paymentRoutes({ db, config, auth, payments }: Ctx): Router {
  const r = Router();

  const view = (o: OrderRow) => {
    const expired = o.status === 'pending' && new Date(`${o.expires_at.replace(' ', 'T')}Z`).getTime() < Date.now();
    return {
      id: o.id,
      status: expired ? 'expired' : o.status,
      amount: o.amount,
      months: o.months,
      qrString: o.status === 'pending' && !expired ? o.qr_string : null,
      expiresAt: iso(o.expires_at),
      paidAt: iso(o.paid_at),
    };
  };

  // Membuat kode QRIS untuk membeli Premium. Pesanan yang masih berlaku dipakai ulang agar tidak menumpuk.
  r.post('/payments/premium-order', auth.requireAuth, async (req, res) => {
    if (!payments.enabled) throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Pembayaran otomatis belum diaktifkan. Hubungi pengelola.');
    const userId = req.user!.id;
    const existing = await row<OrderRow>(
      db,
      `SELECT * FROM premium_orders WHERE user_id = ? AND status = 'pending' AND expires_at > UTC_TIMESTAMP() AND qr_string IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
      [userId],
    );
    if (existing) return void res.json({ data: view(existing) });

    const reference = `MX-${userId}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const { priceIdr, months } = config.premium;
    const inserted = await run(
      db,
      `INSERT INTO premium_orders (user_id, reference, amount, months, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${ORDER_MINUTES} MINUTE))`,
      [userId, reference, priceIdr, months],
    );
    const orderId = Number(inserted.insertId);
    try {
      const qr = await payments.createQr({ reference, amount: priceIdr, callbackUrl: config.payments.callbackUrl });
      await run(db, 'UPDATE premium_orders SET qr_id = ?, qr_string = ? WHERE id = ?', [qr.qrId, qr.qrString, orderId]);
    } catch (e) {
      await run(db, 'DELETE FROM premium_orders WHERE id = ?', [orderId]);
      console.error('Xendit gagal membuat QR:', e instanceof Error ? e.message : e);
      throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Kode QRIS belum bisa dibuat. Coba lagi sebentar lagi.');
    }
    const order = await row<OrderRow>(db, 'SELECT * FROM premium_orders WHERE id = ?', [orderId]);
    res.status(201).json({ data: view(order!) });
  });

  // Status pesanan milik pengguna sendiri; dipakai halaman Premium untuk menunggu pembayaran.
  r.get('/payments/orders/:id', auth.requireAuth, async (req, res) => {
    const id = parse(idParam, req.params.id);
    const order = await row<OrderRow>(db, 'SELECT * FROM premium_orders WHERE id = ? AND user_id = ?', [id, req.user!.id]);
    if (!order) throw notFound('Pesanan');
    res.json({ data: view(order) });
  });

  // Callback dari Xendit (tanpa cookie sesi; keasliannya dicek lewat x-callback-token).
  r.post('/payments/xendit/callback', async (req, res) => {
    const expected = config.payments.callbackToken;
    const given = req.get('x-callback-token') ?? '';
    if (!payments.enabled || !expected || !safeEqual(given, expected)) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Token callback tidak valid.');
    }
    const body = parse(callbackBody, req.body);
    const reference = body.qr_code?.external_id;
    const paid = body.event === 'qr.payment' && (body.status === 'COMPLETED' || body.status === 'SUCCEEDED');
    if (!paid || !reference) return void res.json({ data: { received: true } });

    await withTransaction(db, async (tx) => {
      const order = await row<OrderRow>(tx, 'SELECT * FROM premium_orders WHERE reference = ? FOR UPDATE', [reference]);
      if (!order || order.status === 'paid') return;
      if (Number(body.amount) !== Number(order.amount)) {
        console.error(`Callback Xendit ${reference}: jumlah ${body.amount} tidak sama dengan pesanan ${order.amount}.`);
        return;
      }
      await run(tx, "UPDATE premium_orders SET status = 'paid', paid_at = UTC_TIMESTAMP(), provider_payment_id = ? WHERE id = ?", [
        body.id ?? null,
        order.id,
      ]);
      await run(
        tx,
        'UPDATE users SET premium_until = DATE_ADD(GREATEST(COALESCE(premium_until, UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL ? MONTH) WHERE id = ?',
        [order.months, order.user_id],
      );
    });
    res.json({ data: { received: true } });
  });

  return r;
}
