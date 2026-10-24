import { Link } from 'react-router';
import { useAuth } from '../../app/AuthContext';
import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { Level } from '../../components/learning/Bits';
import { PremiumLock } from '../../components/learning/PremiumLock';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import type { ProgressReport, TopicLevel } from '../../services/types';

const LEVEL_LABEL: Record<TopicLevel, string> = {
  'belum-mulai': 'Belum dimulai',
  'perlu-latihan': 'Perlu latihan',
  lumayan: 'Lumayan',
  kuat: 'Kuat',
};

const pct = (v: number | null): string => (v === null ? '-' : `${Math.round(v * 100)}%`);

export function ReportPage() {
  useDocumentTitle('Laporan kemajuan');
  const { user } = useAuth();
  const premium = !!user?.premium;
  const report = useAsync((s) => (premium ? api.get<ProgressReport>('/progress/report', s) : Promise.resolve(null)), [premium]);

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Kemajuan</p>
        <h1>Laporan kemajuan pribadi</h1>
        <p>Dihitung dari latihan yang sudah kamu kerjakan: topik mana yang masih lemah dan latihan apa yang sebaiknya dikerjakan berikutnya.</p>
      </header>

      {!premium && (
        <PremiumLock title="Laporan kemajuan khusus Premium">
          Premium menunjukkan akurasi jawabanmu per topik, topik yang paling perlu diperkuat, dan daftar latihan yang disarankan. Kemajuan dasar (poin, streak, pelajaran selesai) tetap bisa dilihat gratis di{' '}
          <Link to="/kemajuan">halaman Kemajuan</Link>.
        </PremiumLock>
      )}

      {premium && report.loading && <Loading label="Menyusun laporan…" lines={4} />}
      {premium && report.error && <ErrorState message={report.error} onRetry={report.reload} />}

      {premium && report.data && (
        <>
          <dl className="xl-stats">
            <div>
              <dt>Latihan selesai</dt>
              <dd>
                {report.data.summary.completed} / {report.data.summary.totalExercises}
              </dd>
            </div>
            <div>
              <dt>Akurasi jawaban</dt>
              <dd>{pct(report.data.summary.accuracy)}</dd>
            </div>
            <div>
              <dt>Percobaan</dt>
              <dd>{report.data.summary.attempts}</dd>
            </div>
            <div>
              <dt>Perlu diulang</dt>
              <dd>{report.data.summary.reviewPending}</dd>
            </div>
          </dl>

          <section aria-labelledby="rp-topik" className="mt-4">
            <h2 id="rp-topik" className="h5">
              Per topik
            </h2>
            {report.data.summary.attempts === 0 ? (
              <EmptyState title="Belum ada data">Kerjakan beberapa latihan dulu, laporan akan terisi dari situ.</EmptyState>
            ) : null}
            <ul className="list-unstyled d-grid gap-3 mt-2">
              {report.data.topics.map((t) => (
                <li key={t.topic}>
                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <strong>{t.title}</strong>
                    <span className="xl-small xl-muted">
                      {LEVEL_LABEL[t.level]} · {t.completed}/{t.totalExercises} selesai · akurasi {pct(t.accuracy)}
                    </span>
                  </div>
                  <div className={`xl-report-bar${t.level === 'perlu-latihan' ? ' weak' : ''}`} role="img" aria-label={`${t.completed} dari ${t.totalExercises} latihan ${t.title} selesai`}>
                    <span style={{ width: `${t.totalExercises === 0 ? 0 : (t.completed / t.totalExercises) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="rp-saran" className="mt-4">
            <h2 id="rp-saran" className="h5">
              Disarankan berikutnya
            </h2>
            {report.data.weakest.length > 0 && (
              <p className="xl-muted">
                Topik yang paling perlu diperkuat:{' '}
                <strong>{report.data.topics.filter((t) => report.data!.weakest.includes(t.topic)).map((t) => t.title).join(', ')}</strong>.
              </p>
            )}
            {report.data.recommendations.length === 0 ? (
              <p className="xl-muted">Semua latihan di topik yang perlu diperkuat sudah selesai. Bagus.</p>
            ) : (
              <ul className="xl-file-list">
                {report.data.recommendations.map((r) => (
                  <li key={r.slug}>
                    <div className="xl-file-main">
                      <Link to={`/latihan/${r.slug}`} className="xl-file-title">
                        {r.title}
                      </Link>
                      <span className="xl-muted xl-small">{r.reason}</span>
                    </div>
                    <Level difficulty={r.difficulty} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="xl-small xl-muted mt-4">
            Tingkat per topik adalah perkiraan sederhana dari akurasi dan jumlah latihan selesai, bukan penilaian resmi. Satu percobaan salah tidak langsung berarti kamu lemah di topik itu.
          </p>
        </>
      )}
    </div>
  );
}
