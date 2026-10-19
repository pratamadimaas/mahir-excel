import { useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { Status } from '../../components/feedback/Feedback';
import { api, errorMessage } from '../../services/api';

interface Order {
  id: number;
  status: 'pending' | 'paid' | 'expired';
  amount: number;
  months: number;
  qrString: string | null;
  expiresAt: string | null;
}

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const timeFmt = new Intl.DateTimeFormat('id-ID', { timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const POLL_MS = 3000;

/** Bayar Premium dengan QRIS: buat kode QR, tampilkan, lalu tunggu server menerima konfirmasi dari Xendit. */
export function QrisCheckout({ amount, months, renew }: { amount: number; months: number; renew: boolean }) {
  const { refresh } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshed = useRef(false);

  const start = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    refreshed.current = false;
    try {
      setOrder(await api.post<Order>('/payments/premium-order'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Gambar QR dibuat di browser dari teks QRIS; pustakanya dimuat hanya saat dibutuhkan.
  const qrString = order?.qrString ?? null;
  useEffect(() => {
    if (!qrString) {
      setImage(null);
      return;
    }
    let cancelled = false;
    void import('qrcode')
      .then((m) => m.toDataURL(qrString, { width: 280, margin: 2, errorCorrectionLevel: 'M' }))
      .then((url) => !cancelled && setImage(url))
      .catch(() => !cancelled && setError('Gambar QR gagal dibuat. Muat ulang halaman lalu coba lagi.'));
    return () => {
      cancelled = true;
    };
  }, [qrString]);

  // Tanya status tiap beberapa detik selama pesanan menunggu pembayaran.
  const orderId = order?.id;
  const pending = order?.status === 'pending';
  useEffect(() => {
    if (!orderId || !pending) return;
    const timer = setInterval(() => {
      api
        .get<Order>(`/payments/orders/${orderId}`)
        .then(setOrder)
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [orderId, pending]);

  useEffect(() => {
    if (order?.status === 'paid' && !refreshed.current) {
      refreshed.current = true;
      void refresh();
    }
  }, [order?.status, refresh]);

  if (order?.status === 'paid') {
    return (
      <Status tone="success">
        <strong>Pembayaran diterima.</strong> Premium sudah aktif di akunmu. Terima kasih sudah mendukung Mahir Excel!
      </Status>
    );
  }

  return (
    <section aria-labelledby="qris" className="xl-panel xl-panel-body">
      <h2 id="qris" className="h6">
        {renew ? 'Perpanjang' : 'Aktifkan'} Premium dengan QRIS
      </h2>
      <p className="mb-2">
        {rupiah.format(amount)} untuk {months} bulan. Bisa dibayar dari aplikasi bank atau e-wallet apa pun yang mendukung QRIS, dan Premium
        aktif otomatis setelah pembayaran berhasil.
      </p>
      {error && <Status tone="error">{error}</Status>}

      {order?.status === 'pending' && image && (
        <div className="text-center my-3">
          <img src={image} width={280} height={280} alt="Kode QRIS untuk membayar Premium" className="border rounded" />
          <p className="mb-1 mt-2">
            Scan lalu bayar tepat <strong>{rupiah.format(order.amount)}</strong>.
          </p>
          <p className="xl-small xl-muted mb-0" role="status">
            Menunggu pembayaran{order.expiresAt && <>, kode berlaku sampai {timeFmt.format(new Date(order.expiresAt))} WIB</>}. Halaman ini
            akan berubah sendiri setelah pembayaran masuk.
          </p>
        </div>
      )}
      {order?.status === 'expired' && <Status tone="warning">Kode QRIS sudah kedaluwarsa. Buat kode baru untuk membayar.</Status>}

      {(!order || order.status === 'expired') && (
        <button type="button" className="btn btn-primary" onClick={() => void start()} disabled={busy}>
          <QrCode className="xl-icon" aria-hidden="true" /> {busy ? 'Membuat kode…' : `Bayar ${rupiah.format(amount)} dengan QRIS`}
        </button>
      )}
    </section>
  );
}
