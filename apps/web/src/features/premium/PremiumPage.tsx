import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { Loading, Status } from '../../components/feedback/Feedback';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuthConfig } from '../auth/EmailAuth';
import { QrisCheckout } from './QrisCheckout';

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' });

/** Tautan hubungi pengelola; untuk wa.me teks pesan diisi otomatis dengan email akun. */
function contactHref(url: string, email: string | undefined): string {
  if (!/^https:\/\/wa\.me\//.test(url)) return url;
  const text = `Halo, saya mau mengaktifkan Mahir Excel Premium${email ? ` untuk akun ${email}` : ''}.`;
  return `${url}${url.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`;
}

const COMPARISON: { label: string; note?: string; free: boolean }[] = [
  { label: 'Semua pelajaran dan latihan', free: true },
  { label: 'Uji Kemampuan Excel dan jadwal ulang', free: true },
  { label: 'Pustaka shortcut dan mode kuis', free: true },
  { label: 'Sprint 60 detik dan papan peringkat', free: true },
  { label: 'Progres, poin, dan streak tersimpan', free: true },
  { label: 'Petunjuk bertahap di setiap latihan', free: true },
  { label: 'Solusi dan pembahasan setelah jawabanmu benar', free: true },
  { label: 'Satu solusi langsung gratis setiap 7 hari', note: 'Cicipan tombol “Lihat solusi”', free: true },
  { label: 'Semua worksheet (.xlsx) dan 50 file data latihan (.xlsx, .csv)', free: true },
  { label: '2 template siap pakai: laporan penjualan dan keuangan pribadi', free: true },
  { label: 'Wizard rumus dasar', note: 'SUM, AVERAGE, MAX, MIN, COUNT', free: true },
  { label: 'Solusi langsung tanpa batas', note: 'Tombol “Lihat solusi” kapan saja di setiap latihan', free: false },
  { label: 'Periksa berkas hasil kerjamu', note: 'Unggah worksheet atau data latihan, sistem menilai per tugas dan memberi petunjuk', free: false },
  { label: 'Kunci jawaban semua worksheet', note: 'File .xlsx untuk mencocokkan hasil kerjamu', free: false },
  { label: '4 template lanjutan', note: 'Stok barang, invoice dan piutang, anggaran pernikahan, RAB sederhana', free: false },
  { label: 'Bandingkan jawabanmu dengan solusi', note: 'Sel demi sel, selisih ditandai', free: false },
  { label: 'Penelusur rumus langkah demi langkah', note: 'Seperti Evaluate Formula di Excel, di dalam latihan', free: false },
  { label: 'Wizard rumus lengkap', note: 'Syarat, pencarian, IF, teks, pembulatan, lengkap dengan penjelasan', free: false },
  { label: 'Laporan kemajuan pribadi', note: 'Topik terlemah dan latihan yang disarankan', free: false },
  { label: 'Lembar contekan PDF per modul', note: 'Sintaks, contoh, dan kesalahan umum', free: false },
  { label: 'Sertifikat PDF per modul', note: 'Muncul setelah semua pelajaran modul selesai', free: false },
  { label: 'Sertifikat seluruh materi', note: 'Bisa dicek keasliannya lewat kode', free: false },
];

function Mark({ yes }: { yes: boolean }) {
  return yes ? (
    <Check className="xl-icon" aria-label="Ya" />
  ) : (
    <span aria-label="Tidak" className="xl-muted">
      &mdash;
    </span>
  );
}

export function PremiumPage() {
  useDocumentTitle('Premium');
  const { user } = useAuth();
  const cfg = useAuthConfig();
  if (!cfg) {
    return (
      <div className="xl-page xl-page-narrow py-5">
        <h1>Premium</h1>
        <Loading label="Memuat…" />
      </div>
    );
  }
  const { priceLabel, contactUrl } = cfg.premium;
  const active = !!user?.premium && user.role !== 'admin';
  const payOnline = !!cfg.premium.paymentEnabled && !!cfg.premium.priceIdr && user?.role !== 'admin';

  return (
    <div className="xl-page xl-page-narrow">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Premium</p>
        <h1>Gratis atau Premium, apa bedanya?</h1>
        <p>
          Semua pelajaran dan latihan gratis. Premium menambah jalan pintas dan bahan latihan: solusi langsung, worksheet lanjutan beserta
          kunci jawabannya, dan sertifikat.
        </p>
      </header>

      {active && (
        <Status tone="success">
          <strong>Premium aktif</strong>
          {user?.premiumUntil && <> sampai {dateFmt.format(new Date(user.premiumUntil))}</>}. Terima kasih sudah mendukung Mahir Excel!
        </Status>
      )}

      <div className="table-responsive mb-4">
        <table className="table align-middle">
          <caption className="visually-hidden">Perbandingan akun Gratis dan Premium</caption>
          <thead>
            <tr>
              <th scope="col">Fitur</th>
              <th scope="col" className="text-center">
                Gratis
              </th>
              <th scope="col" className="text-center">
                Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="fw-normal">
                  {row.label}
                  {row.note && <span className="d-block xl-small xl-muted">{row.note}</span>}
                </th>
                <td className="text-center">{row.free ? <Mark yes /> : <Mark yes={false} />}</td>
                <td className="text-center">
                  <Mark yes />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="xl-small xl-muted">
        Ingin sertifikat tanpa Premium? Ada <Link to="/program">Program Perintis</Link>: sertifikat gratis untuk pengguna pertama yang menyelesaikan
        uji kemampuan Excel, Sprint, dan beberapa latihan.
      </p>
      <p className="xl-small xl-muted">
        Akun gratis cukup daftar dengan email atau Google. Tanpa akun, kamu tetap bisa membuka beranda, uji kemampuan Excel, dan 5 pelajaran
        contoh.
      </p>

      {priceLabel && (
        <p className="h5">
          Harga: <strong>{priceLabel}</strong>
        </p>
      )}

      {!user ? (
        <Status tone="info">
          Masuk dulu agar Premium bisa dikaitkan ke akunmu.{' '}
          <Link to="/masuk" className="btn btn-primary btn-sm ms-2">
            Masuk
          </Link>{' '}
          <Link to="/daftar" className="btn btn-outline-secondary btn-sm">
            Daftar gratis
          </Link>
        </Status>
      ) : payOnline ? (
        <>
          <QrisCheckout amount={cfg.premium.priceIdr!} months={cfg.premium.months ?? 12} renew={active} />
          {!active && contactUrl && (
            <p className="xl-small xl-muted mt-2">
              Kesulitan membayar?{' '}
              <a href={contactHref(contactUrl, user.email)} target="_blank" rel="noopener noreferrer">
                Hubungi pengelola
              </a>
              .
            </p>
          )}
        </>
      ) : (
        !active && (
          <section aria-labelledby="cara" className="xl-panel xl-panel-body">
            <h2 id="cara" className="h6">
              Cara mengaktifkan
            </h2>
            <ol>
              <li>
                Hubungi pengelola dan sebutkan email akunmu: <strong>{user.email}</strong>.
              </li>
              <li>Lakukan pembayaran sesuai arahan pengelola.</li>
              <li>Setelah pembayaran dicek, pengelola mengaktifkan Premium di akunmu. Muat ulang halaman ini untuk melihat statusnya.</li>
            </ol>
            {contactUrl ? (
              <a className="btn btn-primary" href={contactHref(contactUrl, user.email)} target="_blank" rel="noopener noreferrer">
                Hubungi pengelola
              </a>
            ) : (
              <p className="xl-muted mb-0">Hubungi pengelola lewat saluran tempat kamu menemukan Mahir Excel.</p>
            )}
          </section>
        )
      )}

      <p className="xl-small xl-muted mt-4">
        {payOnline
          ? 'Pembayaran QRIS diproses oleh Xendit. Mahir Excel tidak menyimpan data kartu, rekening, atau e-wallet-mu.'
          : 'Pembayaran dan aktivasi dilakukan manual oleh pengelola. Belum ada pembayaran otomatis di dalam aplikasi, dan Mahir Excel tidak menyimpan data kartu atau rekeningmu.'}
      </p>
    </div>
  );
}
