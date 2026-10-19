import { Link } from 'react-router';
import { CircleCheck, Circle } from 'lucide-react';
import { useProgress } from '../../app/ProgressContext';
import { ErrorState, Loading } from '../../components/feedback/Feedback';
import { ProgressBar } from '../../components/learning/Bits';
import { ReviewDueBanner } from '../../components/learning/ReviewDueBanner';
import { PlacementBanner } from '../learning/PlacementPage';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useModules } from '../../services/catalog';

export function AcademyPage() {
  useDocumentTitle('Akademi Excel');
  const { modules, error, reload } = useModules();
  const { progress } = useProgress();
  const total = modules?.reduce((n, m) => n + m.lessons.length, 0) ?? 0;
  const done = modules?.reduce((n, m) => n + m.lessons.filter((l) => progress.completedLessons.has(l.slug)).length, 0) ?? 0;

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Akademi</p>
        <h1>Belajar Excel dari dasar</h1>
        <p>
          Setiap pelajaran berisi penjelasan singkat, contoh, kesalahan umum, dan latihan langsung. Ikuti urutannya, atau lompat ke topik
          yang kamu butuhkan.
        </p>
        <PlacementBanner />
        <div className="mt-3">
          <ReviewDueBanner />
        </div>
        {modules && (
          <div className="mt-3" style={{ maxWidth: 420 }}>
            <div className="d-flex justify-content-between xl-small mb-1">
              <span>Progres keseluruhan</span>
              <span className="xl-muted">
                {done} dari {total} pelajaran
              </span>
            </div>
            <ProgressBar value={done} max={total} label="Progres belajar keseluruhan" large />
          </div>
        )}
      </header>

      {error && <ErrorState message={error} onRetry={reload} />}
      {!modules && !error && <Loading label="Memuat kurikulum…" lines={5} />}

      {modules?.map((m, mi) => {
        const mDone = m.lessons.filter((l) => progress.completedLessons.has(l.slug)).length;
        return (
          <section key={m.slug} className="xl-module" aria-labelledby={`m-${m.slug}`}>
            <div className="xl-module-head">
              <div>
                <div className="xl-eyebrow mb-1">Modul {mi + 1}</div>
                <h2 id={`m-${m.slug}`} className="mb-1">
                  {m.title}
                </h2>
                <p className="xl-muted mb-0">{m.summary}</p>
              </div>
              <div className="xl-module-progress">
                <span className="xl-small xl-muted">
                  {mDone}/{m.lessons.length} selesai
                </span>
                <ProgressBar value={mDone} max={m.lessons.length} label={`Progres modul ${m.title}`} />
              </div>
            </div>
            <ul className="xl-lesson-rows">
              {m.lessons.map((l, li) => {
                const isDone = progress.completedLessons.has(l.slug);
                return (
                  <li key={l.slug}>
                    {isDone ? (
                      <CircleCheck className="xl-icon text-success" aria-label="Selesai" />
                    ) : (
                      <Circle className="xl-icon xl-muted" aria-label="Belum selesai" />
                    )}
                    <Link to={`/belajar/${l.slug}`} className="xl-lesson-row-main">
                      <span className="xl-lesson-title">
                        {mi + 1}.{li + 1} {l.title}
                      </span>
                      <span className="xl-muted xl-small">{l.summary}</span>
                    </Link>
                    <span className="xl-muted xl-small text-nowrap d-none d-sm-inline">
                      {l.minutes} menit · {l.exerciseCount} latihan
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <aside className="xl-panel xl-panel-body mt-4" aria-label="Rencana berikutnya">
        <h2 className="h6">Rencana berikutnya</h2>
        <p className="xl-muted mb-0">
          Belum tersedia: PivotTable dan grafik sungguhan di playground, array dinamis, SUMPRODUCT, serta fungsi teks dan tanggal lanjutan
          (TEXT, SUBSTITUTE, FIND, EDATE, EOMONTH). Pelajarannya sudah menjelaskan konsepnya; latihan memakai padanan rumus yang didukung.
        </p>
      </aside>
    </div>
  );
}
