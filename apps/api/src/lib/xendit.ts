import type { Config } from '../config';

export interface QrOrderInput {
  /** ID unik pesanan di sisi kita (dikirim sebagai external_id). */
  reference: string;
  amount: number;
  callbackUrl: string;
}

export interface QrOrderResult {
  qrId: string;
  qrString: string;
}

export interface PaymentGateway {
  /** false bila kunci Xendit belum diisi; fitur bayar otomatis lalu tidak ditawarkan. */
  enabled: boolean;
  createQr(input: QrOrderInput): Promise<QrOrderResult>;
}

const API_BASE = 'https://api.xendit.co';

/**
 * Klien QRIS dinamis Xendit (API QR Codes v1): POST /qr_codes dengan basic auth memakai kunci rahasia.
 * Hanya satu panggilan yang dipakai, jadi tanpa SDK tambahan.
 */
export function createXendit(config: Config, fetchImpl: typeof fetch = fetch): PaymentGateway {
  const { secretKey, callbackToken } = config.payments;
  return {
    enabled: !!secretKey && !!callbackToken,
    async createQr({ reference, amount, callbackUrl }: QrOrderInput): Promise<QrOrderResult> {
      if (!secretKey) throw new Error('Xendit belum dikonfigurasi.');
      const res = await fetchImpl(`${API_BASE}/qr_codes`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ external_id: reference, type: 'DYNAMIC', callback_url: callbackUrl, amount }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; qr_string?: string; message?: string; error_code?: string };
      if (!res.ok || !body.id || !body.qr_string) {
        throw new Error(`Xendit menolak permintaan (${res.status}${body.error_code ? ` ${body.error_code}` : ''}).`);
      }
      return { qrId: body.id, qrString: body.qr_string };
    },
  };
}
