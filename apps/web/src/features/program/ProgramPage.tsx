import { useState } from 'react';
import { Link } from 'react-router';
import { Award, Check, Circle, Download } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, errorMessage } from '../../services/api';
import type { ProgramStatus } from '../../services/types';

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' });

/** Sisa kuota baru ditampilkan bila tinggal sedikit. Kuota yang masih longgar tidak perlu dipamerkan, dan angka sisa yang besar justru terbaca "belum banyak yang ikut". */
export const QUOTA_TIGHT = 20;
const quotaTight = (d: Pick<ProgramStatus, 'open' | 'remaining'>): boolean => d.open && d.remaining <= QUOTA_TIGHT;

/** Banner ringkas untuk beranda anggota: hanya tampil selama kuota masih ada. */
export function ProgramBanner() {
  const st = useAsync((s) => api.get<ProgramStatus>('/program/status', s), []);
  const d = st.data;
  if (!d || !d.open) return null;
  return (
    <aside
      className="xl-panel xl-panel-body d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4"
      aria-label="Program Perintis"
    >
      <div>
        <p className="xl-eyebrow mb-1">Program Perintis</p>
        <p className="h5 mb-1">Sertifikat gratis untuk {d.quota} pengguna pertama</p>
        <p className="xl-muted mb-0">
          Selesaikan uji kemampuan Excel, Sprint, dan {d.minExercises} latihan.
          {quotaTight(d) && (
            <>
              {' '}
              Tersisa <strong>{d.remaining}</strong> dari {d.quota}.
            </>
          )}
        </p>
      </div>
      <Link to="/program" className="btn btn-primary">
        Lihat syarat
      </Link>
    </aside>
  );
}

export function ProgramPage() {
  useDocumentTitle('Program Perintis');
  const { user } = useAuth();
  const st = useAsync((s) => api.get<ProgramStatus>('/program/status', s), [user?.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api.post<ProgramStatus>('/program/claim');
      st.reload();
    } catch (e) {
      setError(errorMessage(e));
      st.reload();
    } finally {
      setBusy(false);
    }
  };

  if (st.loading && !st.data) {
    return (
      <div className="xl-page xl-page-narrow py-5">
        <h1>Program Perintis</h1>
        <Loading label="Memuat…" />
      </div>
    );
  }
  if (st.error || !st.data) {
    return (
      <div className="xl-page xl-page-narrow py-5">
        <ErrorState message={st.error ?? 'Data program tidak tersedia.'} onRetry={st.reload} />
      </div>
    );
  }
  const d = st.data;
  const pct = d.quota > 0 ? Math.round((d.taken / d.quota) * 100) : 0;
  const claimed = d.claim ?? null;

  return (
    <div className="xl-page xl-page-narrow">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Program Perintis</p>
        <h1>{d.quota} sertifikat gratis untuk pengguna pertama</h1>
        <p>
          Kerjakan uji kemampuan Excel, satu ronde Sprint, dan {d.minExercises} latihan. Siapa pun yang menyelesaikannya lebih dulu dan menekan
          klaim mendapat sertifikat Perintis, gratis.
        </p>
      </header>

      {/* Kuota yang masih longgar disembunyikan; tampil saat tinggal sedikit atau sudah habis. */}
      {(quotaTight(d) || !d.open) && (
        <section aria-labelledby="kuota" className="mb-4">
          <h2 id="kuota" className="h6">
            Kuota
          </h2>
          <div
            className="progress mb-2"
            role="progressbar"
            aria-label="Kuota sertifikat yang sudah diklaim"
            aria-valuenow={d.taken}
            aria-valuemin={0}
            aria-valuemax={d.quota}
          >
            <div className="progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <p className="xl-small xl-muted mb-0">
            {d.taken} dari {d.quota} sertifikat sudah diklaim.{' '}
            {d.open ? (
              <>
                Tersisa <strong>{d.remaining}</strong>.
              </>
            ) : d.enabled ? (
              'Kuota sudah habis.'
            ) : (
              'Program sedang tidak dibuka.'
            )}
          </p>
        </section>
      )}

      {claimed && (
        <Status tone="success">
          <strong>Selamat, kamu Perintis ke-{claimed.slot}!</strong> Sertifikatmu diklaim pada {dateFmt.format(new Date(claimed.claimedAt))}
          .
          <div className="d-flex flex-wrap gap-2 mt-2">
            <a className="btn btn-primary btn-sm" href="/api/program/certificate" download>
              <Download className="xl-icon" aria-hidden="true" /> Unduh sertifikat (PDF)
            </a>
            <Link className="btn btn-outline-secondary btn-sm" to={`/sertifikat/${claimed.code}`}>
              Halaman verifikasi
            </Link>
          </div>
        </Status>
      )}

      {!claimed && !d.open && (
        <Status tone="warning">{d.enabled ? 'Kuota sudah habis, terima kasih sudah tertarik.' : 'Program ini sedang tidak dibuka.'}</Status>
      )}

      <section aria-labelledby="syarat" className="xl-panel xl-panel-body mb-4">
        <h2 id="syarat" className="h6">
          Syarat
        </h2>
        {d.requirements ? (
          <ul className="xl-list-plain mb-3">
            {d.requirements.map((q) => (
              <li key={q.key} className="d-flex gap-2 align-items-start mb-2">
                {q.done ? <Check className="xl-icon" aria-label="Selesai" /> : <Circle className="xl-icon xl-muted" aria-label="Belum" />}
                <span className="flex-grow-1">
                  {q.label}
                  {q.progress && !q.done && (
                    <span className="xl-small xl-muted d-block">
                      {q.progress.have} dari {q.progress.need}
                    </span>
                  )}
                </span>
                {!q.done && (
                  <Link to={q.to} className="btn btn-outline-primary btn-sm">
                    Kerjakan
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <ol>
              <li>Selesaikan uji kemampuan Excel.</li>
              <li>Selesaikan satu ronde Sprint 60 detik.</li>
              <li>Selesaikan {d.minExercises} latihan.</li>
            </ol>
            <p className="xl-muted">Semua harus dikerjakan setelah masuk akun, supaya tercatat atas namamu.</p>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/daftar" className="btn btn-primary">
                Daftar gratis
              </Link>
              <Link to="/masuk" className="btn btn-outline-secondary">
                Masuk
              </Link>
            </div>
          </>
        )}

        {d.requirements && !claimed && d.open && (
          <>
            {error && <Status tone="error">{error}</Status>}
            <button type="button" className="btn btn-primary" onClick={() => void claim()} disabled={!d.eligible || busy}>
              <Award className="xl-icon" aria-hidden="true" /> {busy ? 'Memproses…' : 'Klaim sertifikat Perintis'}
            </button>
            {!d.eligible && <p className="xl-small xl-muted mt-2 mb-0">Tombol aktif setelah ketiga syarat selesai.</p>}
          </>
        )}
      </section>

      <section aria-labelledby="aturan">
        <h2 id="aturan" className="h6">
          Aturan singkat
        </h2>
        <ul className="xl-small">
          <li>Satu akun mendapat satu sertifikat Perintis.</li>
          <li>Nomor Perintis diberikan berurutan saat kamu menekan klaim, bukan saat mendaftar.</li>
          <li>Uji Kemampuan Excel dan Sprint dihitung kalau dikerjakan saat sudah masuk akun.</li>
          <li>
            Sertifikat ini penanda keikutsertaan di Mahir Excel, bukan sertifikasi resmi Microsoft. Ini terpisah dari sertifikat
            penyelesaian materi di paket <Link to="/premium">Premium</Link>.
          </li>
          <li>Pengelola dapat membatalkan klaim yang terbukti memakai akun ganda atau cara curang.</li>
        </ul>
      </section>
    </div>
  );
}
