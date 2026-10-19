import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Award, Check, Copy, Share2 } from 'lucide-react';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { ProgressBar } from '../../components/learning/Bits';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, errorMessage } from '../../services/api';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Tombol bagikan: memakai Web Share bila ada, selain itu menyalin tautan. */
export function ShareButton({ title, path, label = 'Bagikan' }: { title: string; path: string; label?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const url = `${window.location.origin}${path}`;
  const onClick = async (): Promise<void> => {
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    setMsg((await copyText(url)) ? 'Tautan disalin.' : `Salin tautan ini: ${url}`);
  };
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void onClick()}>
        <Share2 className="xl-icon" aria-hidden="true" /> {label}
      </button>
      <span className="xl-small xl-muted" role="status" aria-live="polite">
        {msg}
      </span>
    </span>
  );
}

/** Kartu pengaturan tautan bagikan progres (akun). Tautan hanya menampilkan nama tampilan dan ringkasan angka. */
export function ShareCard() {
  const state = useAsync((s) => api.get<{ token: string | null }>('/progress/share', s), []);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const current = token === undefined ? (state.data?.token ?? null) : token;
  const url = current ? `${window.location.origin}/bagikan/${current}` : '';

  const act = async (fn: () => Promise<{ token: string | null }>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setToken((await fn()).token);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="bagikan" className="xl-panel xl-panel-body mb-4">
      <h2 id="bagikan" className="h6">
        Bagikan progresmu
      </h2>
      <p className="xl-small xl-muted">
        Buat tautan publik berisi nama tampilan, poin, streak, dan kemajuan per modul. Email dan jawabanmu tidak ikut tampil. Kamu bisa
        menonaktifkannya kapan saja.
      </p>
      {state.error && <ErrorState message={state.error} onRetry={state.reload} />}
      {error && (
        <Status tone="error" live>
          {error}
        </Status>
      )}
      {current ? (
        <div>
          <label htmlFor="share-url" className="form-label">
            Tautan bagikan
          </label>
          <div className="d-flex gap-2 flex-wrap">
            <input
              id="share-url"
              className="form-control"
              style={{ maxWidth: 480 }}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={async () => {
                setCopied(await copyText(url));
                window.setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="xl-icon" aria-hidden="true" /> : <Copy className="xl-icon" aria-hidden="true" />}{' '}
              {copied ? 'Tersalin' : 'Salin'}
            </button>
            <button
              type="button"
              className="btn btn-outline-danger"
              disabled={busy}
              onClick={() => void act(() => api.del('/progress/share'))}
            >
              Nonaktifkan
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={busy || state.loading}
          onClick={() => void act(() => api.post('/progress/share'))}
        >
          <Share2 className="xl-icon" aria-hidden="true" /> Buat tautan bagikan
        </button>
      )}
    </section>
  );
}

interface SharedSummary {
  displayName: string;
  totalPoints: number;
  streak: { current: number; longest: number };
  lessons: { done: number; total: number };
  exercises: { done: number; total: number };
  modules: { title: string; done: number; total: number }[];
}

/** Halaman publik hasil bagikan progres. */
export function SharedProgressPage() {
  const { token = '' } = useParams();
  const data = useAsync((s) => api.get<SharedSummary>(`/share/${encodeURIComponent(token)}`, s), [token]);
  useDocumentTitle(data.data ? `Progres ${data.data.displayName}` : undefined);
  if (data.loading)
    return (
      <div className="xl-page">
        <Loading label="Memuat…" lines={3} />
      </div>
    );
  if (data.error || !data.data) {
    return (
      <div className="xl-page xl-page-narrow py-4">
        <EmptyState title="Tautan tidak ditemukan">
          Tautan ini mungkin sudah dinonaktifkan oleh pemiliknya. <Link to="/">Ke beranda</Link>
        </EmptyState>
      </div>
    );
  }
  const d = data.data;
  return (
    <div className="xl-page xl-page-narrow">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Progres belajar</p>
        <h1>{d.displayName}</h1>
        <p>Sedang belajar Excel di Mahir Excel.</p>
      </header>
      <dl className="xl-stats">
        <div>
          <dt>Poin</dt>
          <dd>{d.totalPoints}</dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>
            {d.streak.current} <span className="xl-small xl-muted">hari</span>
          </dd>
        </div>
        <div>
          <dt>Pelajaran</dt>
          <dd>
            {d.lessons.done}
            <span className="xl-small xl-muted"> / {d.lessons.total}</span>
          </dd>
        </div>
        <div>
          <dt>Latihan</dt>
          <dd>
            {d.exercises.done}
            <span className="xl-small xl-muted"> / {d.exercises.total}</span>
          </dd>
        </div>
      </dl>
      <h2 className="h5">Kemajuan per modul</h2>
      <ul className="xl-module-summary">
        {d.modules.map((m) => (
          <li key={m.title}>
            <span>{m.title}</span>
            <span className="xl-muted xl-small">
              {m.done}/{m.total}
            </span>
            <div style={{ width: 120 }}>
              <ProgressBar value={m.done} max={m.total} label={`Modul ${m.title}`} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4">
        <Link className="btn btn-primary" to="/belajar">
          Belajar Excel gratis di Mahir Excel
        </Link>
      </p>
    </div>
  );
}

interface Verified {
  valid: boolean;
  name: string;
  scope: string;
  issuedAt: string;
  code: string;
}

/** Halaman publik untuk memeriksa keaslian sertifikat dari kodenya. */
export function CertificateVerifyPage() {
  const { code = '' } = useParams();
  const data = useAsync((s) => api.get<Verified>(`/certificates/${encodeURIComponent(code)}`, s), [code]);
  useDocumentTitle('Verifikasi sertifikat');
  if (data.loading)
    return (
      <div className="xl-page">
        <Loading label="Memeriksa sertifikat…" />
      </div>
    );
  if (data.error || !data.data) {
    return (
      <div className="xl-page xl-page-narrow py-4">
        <h1>Verifikasi sertifikat</h1>
        <Status tone="error" live>
          Sertifikat dengan kode ini tidak ditemukan. Periksa kembali kodenya.
        </Status>
      </div>
    );
  }
  const d = data.data;
  return (
    <div className="xl-page xl-page-narrow py-4">
      <h1>Verifikasi sertifikat</h1>
      <Status tone="success" live>
        <Award className="xl-icon me-1" aria-hidden="true" /> <strong>Sertifikat valid.</strong>
      </Status>
      <dl className="xl-meta mt-3">
        <div>
          <dt>Atas nama</dt>
          <dd>{d.name}</dd>
        </div>
        <div>
          <dt>Menyelesaikan</dt>
          <dd>{d.scope}</dd>
        </div>
        <div>
          <dt>Diterbitkan</dt>
          <dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(d.issuedAt))}</dd>
        </div>
        <div>
          <dt>Kode</dt>
          <dd>
            <code>{d.code}</code>
          </dd>
        </div>
      </dl>
      <p className="xl-small xl-muted">
        Sertifikat ini menandakan penyelesaian belajar di Mahir Excel. Bukan sertifikasi resmi Microsoft dan tidak terakreditasi.
      </p>
    </div>
  );
}
