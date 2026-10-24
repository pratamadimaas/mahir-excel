import { useState } from 'react';
import { Link } from 'react-router';
import { Award, Flame, Repeat, Trophy } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { useProgress } from '../../app/ProgressContext';
import { ConfirmDialog, EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { ProgressBar } from '../../components/learning/Bits';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, apiUrl, errorMessage } from '../../services/api';
import { flattenLessons, useModules } from '../../services/catalog';
import { TOPIC_LABELS, type ExerciseSummary } from '../../services/types';
import { ShareCard } from './Sharing';

export function ImportBanner() {
  const { user } = useAuth();
  const { localHasData, importLocal, dismissImport, importDismissed } = useProgress();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  if (msg)
    return (
      <Status tone={msg.tone} live>
        {msg.text}
      </Status>
    );
  if (!user || !localHasData || importDismissed) return null;
  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const r = await importLocal();
      setMsg({
        tone: 'success',
        text: `Progres lokal diimpor: ${r.lessons} pelajaran, ${r.exercises} latihan, +${r.pointsAdded} poin. Poin tidak akan dihitung dobel.`,
      });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Status tone="info">
      <strong>Ada progres belajar di browser ini.</strong> Impor ke akunmu agar tidak hilang? Data di browser akan dihapus setelah berhasil
      diimpor.
      <div className="mt-2 d-flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={busy}>
          {busy ? 'Mengimpor…' : 'Impor progres lokal'}
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={dismissImport}>
          Lewati
        </button>
      </div>
    </Status>
  );
}

export function ProgressPage() {
  useDocumentTitle('Kemajuan belajar');
  const { user } = useAuth();
  const { progress, loading, storageAvailable, resetLocal, reviewDue, reviewUpcoming } = useProgress();
  const { modules, error: modErr, reload } = useModules();
  const exercises = useAsync((s) => api.get<ExerciseSummary[]>('/exercises?pageSize=100', s), []);
  const [confirmReset, setConfirmReset] = useState(false);

  const allLessons = modules ? flattenLessons(modules) : [];
  const totalEx = exercises.data?.length ?? 0;
  const doneEx = Object.keys(progress.completedExercises).length;
  const next = allLessons.find((l) => !progress.completedLessons.has(l.slug));
  const reviewList = Object.entries(progress.reviews).map(([slug, r]) => ({
    slug,
    ...r,
    ex: exercises.data?.find((e) => e.slug === slug),
  }));

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Kemajuan</p>
        <h1>Kemajuan belajarmu</h1>
        <p>
          {progress.source === 'account' || user
            ? 'Progres tersimpan di akunmu dan tersinkron antar perangkat.'
            : 'Progres tersimpan di browser ini. Daftar akun agar progresmu tidak hilang.'}
        </p>
      </header>

      {user && (
        <p>
          <Link to="/laporan">Lihat laporan kemajuan pribadi</Link> (topik terlemah dan latihan yang disarankan).
        </p>
      )}
      <ImportBanner />
      {loading && <Loading label="Memuat progres akun…" />}

      {progress.source === 'local' && (
        <Status tone={storageAvailable ? 'info' : 'warning'}>
          {storageAvailable
            ? 'Progres lokal bisa hilang bila kamu membersihkan data situs, memakai mode privat, atau berganti browser/perangkat.'
            : 'Browser ini memblokir penyimpanan lokal, sehingga progres hanya bertahan selama halaman terbuka.'}{' '}
          {!user && <Link to="/daftar">Buat akun gratis untuk menyimpannya.</Link>}
        </Status>
      )}

      <dl className="xl-stats">
        <div>
          <dt>
            <Trophy className="xl-icon" aria-hidden="true" /> Poin
          </dt>
          <dd>{progress.totalPoints}</dd>
        </div>
        <div>
          <dt>
            <Flame className="xl-icon" aria-hidden="true" /> Streak
          </dt>
          <dd>
            {progress.streak.current} <span className="xl-small xl-muted">hari (terpanjang {progress.streak.longest})</span>
          </dd>
        </div>
        <div>
          <dt>Pelajaran selesai</dt>
          <dd>
            {progress.completedLessons.size}
            <span className="xl-small xl-muted"> / {allLessons.length || '…'}</span>
          </dd>
        </div>
        <div>
          <dt>Latihan selesai</dt>
          <dd>
            {doneEx}
            <span className="xl-small xl-muted"> / {totalEx || '…'}</span>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="ulang-judul" id="ulang" className="mb-4">
        <h2 id="ulang-judul" className="h5 d-flex align-items-center gap-2">
          <Repeat className="xl-icon" aria-hidden="true" /> Waktunya mengulang
        </h2>
        {reviewDue.length === 0 ? (
          <p className="xl-muted xl-small">
            Tidak ada latihan yang perlu diulang sekarang.{' '}
            {reviewUpcoming > 0
              ? `${reviewUpcoming} latihan terjadwal untuk diulang beberapa hari lagi.`
              : 'Latihan yang pernah salah akan dijadwalkan ulang otomatis (1, 3, 7, 14, lalu 30 hari) supaya lebih melekat.'}
          </p>
        ) : (
          <>
            <p className="xl-small xl-muted">
              Latihan yang pernah salah lebih mudah diingat bila diulang pada waktunya. Selesaikan dengan benar untuk menaikkan jeda ulang
              berikutnya.
            </p>
            <ul className="xl-review">
              {reviewDue.map((d) => {
                const ex = exercises.data?.find((e) => e.slug === d.slug);
                return (
                  <li key={d.slug}>
                    <Link to={`/latihan/${d.slug}`} className="fw-semibold">
                      {d.title ?? ex?.title ?? d.slug}
                    </Link>
                    <span className="xl-muted xl-small ms-2">tahap {d.box}/5</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {progress.source === 'account' && <ShareCard />}

      {modErr && <ErrorState message={modErr} onRetry={reload} />}

      {modules && (
        <section aria-labelledby="jalur-saya" className="mb-4">
          <h2 id="jalur-saya">Jalur belajar saat ini</h2>
          <div className="mb-2" style={{ maxWidth: 480 }}>
            <ProgressBar value={progress.completedLessons.size} max={allLessons.length} label="Progres jalur belajar" large />
            <p className="xl-small xl-muted mt-1">
              {allLessons.length ? Math.round((progress.completedLessons.size / allLessons.length) * 100) : 0}% pelajaran selesai
            </p>
          </div>
          {next ? (
            <p>
              Berikutnya: <Link to={`/belajar/${next.slug}`}>{next.title}</Link> <span className="xl-muted">({next.moduleTitle})</span>
            </p>
          ) : (
            <Status tone="success">
              Semua pelajaran sudah selesai. Lanjutkan dengan latihan dan tantangan harian!{' '}
              {progress.source === 'account' &&
                (user?.premium ? (
                  <a href={apiUrl('/progress/certificate?scope=semua')} download>
                    Unduh sertifikat seluruh materi
                  </a>
                ) : (
                  <Link to="/premium">Sertifikat seluruh materi (Premium)</Link>
                ))}
            </Status>
          )}
          <ul className="xl-module-summary">
            {modules.map((m) => {
              const d = m.lessons.filter((l) => progress.completedLessons.has(l.slug)).length;
              return (
                <li key={m.slug}>
                  <span>{m.title}</span>
                  <span className="xl-muted xl-small">
                    {d}/{m.lessons.length}
                  </span>
                  <div style={{ width: 120 }}>
                    <ProgressBar value={d} max={m.lessons.length} label={`Modul ${m.title}`} />
                  </div>
                  {d === m.lessons.length && m.lessons.length > 0 && (
                    <span className="xl-small">
                      {progress.source === 'account' && user?.premium ? (
                        <a href={apiUrl(`/progress/certificate?scope=${m.slug}`)} download>
                          <Award className="xl-icon me-1" aria-hidden="true" />
                          Sertifikat
                        </a>
                      ) : progress.source === 'account' ? (
                        <Link to="/premium">
                          <Award className="xl-icon me-1" aria-hidden="true" />
                          Sertifikat (Premium)
                        </Link>
                      ) : (
                        <span className="xl-muted">Daftar akun untuk sertifikat</span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="tinjau" className="mb-4">
        <h2 id="tinjau">Tinjau jawaban yang belum tepat</h2>
        {reviewList.length === 0 ? (
          <EmptyState title="Belum ada yang perlu ditinjau">
            Latihan yang jawabannya belum tepat akan muncul di sini sampai kamu menyelesaikannya.
          </EmptyState>
        ) : (
          <ul className="xl-review">
            {reviewList.map((r) => (
              <li key={r.slug}>
                <Link to={`/latihan/${r.slug}`} className="fw-semibold">
                  {r.ex?.title ?? r.slug}
                </Link>
                {r.ex && <span className="xl-muted xl-small ms-2">{TOPIC_LABELS[r.ex.topic] ?? r.ex.topic}</span>}
                <div className="xl-small xl-muted">{r.message}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {progress.source === 'local' && (
        <section aria-labelledby="reset" className="xl-panel xl-panel-body">
          <h2 id="reset" className="h6">
            Atur ulang progres lokal
          </h2>
          <p className="xl-muted xl-small">
            Menghapus poin, streak, dan penanda selesai dari browser ini. Tindakan ini tidak dapat dibatalkan.
          </p>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmReset(true)}>
            Reset progres
          </button>
          <ConfirmDialog
            open={confirmReset}
            title="Reset progres lokal?"
            confirmLabel="Ya, hapus progres"
            danger
            onConfirm={() => {
              resetLocal();
              setConfirmReset(false);
            }}
            onCancel={() => setConfirmReset(false)}
          >
            <p className="mb-0">Semua progres di browser ini akan dihapus. Progres akun (jika ada) tidak terpengaruh.</p>
          </ConfirmDialog>
        </section>
      )}
    </div>
  );
}
