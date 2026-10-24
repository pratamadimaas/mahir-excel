import { Link } from 'react-router';
import { ArrowRight, Check, Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { useProgress } from '../../app/ProgressContext';
import { ErrorState, Loading } from '../../components/feedback/Feedback';
import { Keycaps, Level, ProgressBar } from '../../components/learning/Bits';
import { ReviewDueBanner } from '../../components/learning/ReviewDueBanner';
import { PlacementBanner } from '../learning/PlacementPage';
import { ExerciseWorkspace } from '../../components/spreadsheet/ExerciseWorkspace';
import { MiniSheet } from '../../components/spreadsheet/MiniSheet';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useI18n } from '../../i18n/I18n';
import { api } from '../../services/api';
import { flattenLessons, useModules } from '../../services/catalog';
import { formatBytes, type PublicExercise, type ShortcutView, type WorksheetView } from '../../services/types';
import { HeroVisual } from '../../scenes/hero/HeroVisual';
import { ProgramBanner } from '../program/ProgramPage';
import { Landing, SprintTeaser } from './Landing';

const HERO_TABLE = [
  ['Barang', 'Harga', 'Jumlah'],
  ['Beras', 15000, 2],
  ['Gula', 14000, 3],
  ['Total', '=SUM(B2:B3)', '=SUM(C2:C3)'],
];

function Section({
  id,
  title,
  lead,
  children,
  action,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="xl-home-section" aria-labelledby={id}>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div>
          <h2 id={id} className="mb-1">
            {title}
          </h2>
          {lead && <p className="xl-muted mb-0">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PathSection() {
  const { modules, error, reload } = useModules();
  const { progress } = useProgress();
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!modules) return <Loading label="Memuat jalur belajar…" lines={3} />;
  const all = flattenLessons(modules);
  const next = all.find((l) => !progress.completedLessons.has(l.slug)) ?? all[0];
  const started = progress.completedLessons.size > 0;
  return (
    <>
      {next && (
        <div className="xl-continue">
          <div>
            <div className="xl-eyebrow mb-1">{started ? 'Lanjutkan belajar' : 'Mulai dari sini'}</div>
            <strong>{next.title}</strong>
            <div className="xl-muted xl-small">
              {next.moduleTitle} · {next.minutes} menit
            </div>
          </div>
          <Link to={`/belajar/${next.slug}`} className="btn btn-primary">
            {started ? 'Lanjutkan' : 'Buka pelajaran'} <ArrowRight className="xl-icon ms-1 me-0" aria-hidden="true" />
          </Link>
        </div>
      )}
      <ol className="xl-path" aria-label="Jalur belajar pemula">
        {modules.map((m, i) => {
          const done = m.lessons.filter((l) => progress.completedLessons.has(l.slug)).length;
          return (
            <li key={m.slug}>
              <span className="xl-path-no" aria-hidden="true">
                {done === m.lessons.length && m.lessons.length > 0 ? <Check className="xl-icon" /> : i + 1}
              </span>
              <div className="xl-path-body">
                <Link to="/belajar" className="xl-path-title">
                  {m.title}
                </Link>
                <span className="xl-muted xl-small">{m.summary}</span>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <div style={{ width: 120 }}>
                    <ProgressBar value={done} max={m.lessons.length} label={`Progres modul ${m.title}`} />
                  </div>
                  <span className="xl-small xl-muted">
                    {done}/{m.lessons.length} pelajaran
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function FeaturedLessons() {
  const { modules, error } = useModules();
  if (error || !modules) return null;
  const featured = flattenLessons(modules).slice(0, 4);
  return (
    <ul className="xl-lesson-list">
      {featured.map((l) => (
        <li key={l.slug}>
          <Link to={`/belajar/${l.slug}`}>
            <span className="xl-lesson-title">{l.title}</span>
            <span className="xl-muted xl-small">{l.summary}</span>
          </Link>
          <span className="xl-muted xl-small text-nowrap">
            {l.minutes} mnt · {l.exerciseCount} latihan
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExercisePreview() {
  const ex = useAsync((s) => api.get<PublicExercise>('/exercises/total-harga-barang', s), []);
  if (ex.loading) return <Loading label="Memuat latihan…" lines={4} />;
  if (ex.error || !ex.data) return <ErrorState message={ex.error ?? 'Latihan tidak tersedia.'} onRetry={ex.reload} />;
  return <ExerciseWorkspace exercise={ex.data} nextSlug="cari-penjualan-tertinggi" />;
}

function ShortcutPreview() {
  const sc = useAsync((s) => api.get<ShortcutView[]>('/shortcuts?pageSize=200', s), []);
  if (sc.loading) return <Loading label="Memuat shortcut…" lines={3} />;
  if (sc.error || !sc.data) return <ErrorState message={sc.error ?? 'Shortcut tidak tersedia.'} onRetry={sc.reload} />;
  const picks = ['toggle-filter', 'autosum', 'ubah-referensi', 'dialog-sort', 'edit-sel', 'lompat-tepi-data']
    .map((slug) => sc.data!.find((s) => s.slug === slug))
    .filter((s): s is ShortcutView => !!s);
  return (
    <div className="xl-table-wrap">
      <table className="xl-table">
        <caption className="visually-hidden">Contoh shortcut Excel</caption>
        <thead>
          <tr>
            <th scope="col">Aksi</th>
            <th scope="col">Windows</th>
            <th scope="col" className="d-none d-sm-table-cell">
              Mac
            </th>
          </tr>
        </thead>
        <tbody>
          {picks.map((s) => (
            <tr key={s.slug}>
              <td>{s.action}</td>
              <td>
                <Keycaps combo={s.keysWindows} />
              </td>
              <td className="d-none d-sm-table-cell">
                <Keycaps combo={s.keysMac} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorksheetPreview() {
  const ws = useAsync((s) => api.get<WorksheetView[]>('/worksheets', s), []);
  if (ws.loading) return <Loading label="Memuat worksheet…" lines={3} />;
  if (ws.error || !ws.data) return <ErrorState message={ws.error ?? 'Worksheet tidak tersedia.'} onRetry={ws.reload} />;
  return (
    <ul className="xl-file-list">
      {ws.data.slice(0, 4).map((w) => (
        <li key={w.slug}>
          <FileSpreadsheet className="xl-icon xl-file-icon" aria-hidden="true" />
          <div className="xl-file-main">
            <Link to={`/worksheet/${w.slug}`} className="xl-file-title">
              {w.title}
            </Link>
            <span className="xl-muted xl-small">{w.skills.join(' · ')}</span>
          </div>
          <Level difficulty={w.difficulty} />
          {w.available ? (
            <a className="btn btn-outline-primary btn-sm" href={`/api/worksheets/${w.slug}/download`} download>
              <Download className="xl-icon" aria-hidden="true" />
              Unduh .xlsx ({formatBytes(w.fileSize)})
            </a>
          ) : (
            <span className="xl-muted xl-small">Belum tersedia</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  useDocumentTitle(t('footer.tagline'));
  return (
    <>
      <section className={user ? 'xl-hero' : 'xl-hero xl-hero-pro'} aria-labelledby="hero-title">
        <div className="xl-page">
          <div className="xl-hero-grid">
            <div className="xl-hero-copy">
              <p className="xl-eyebrow">{t('hero.eyebrow')}</p>
              <h1 id="hero-title" className="xl-hero-title">
                {t('hero.title')}
              </h1>
              <p className="xl-hero-lead">{t('hero.lead')}</p>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {user ? (
                  <>
                    <Link to="/belajar" className="btn btn-primary btn-lg">
                      {t('hero.start')}
                    </Link>
                    <Link to="/latihan" className="btn btn-outline-secondary btn-lg">
                      {t('hero.try')}
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/daftar" className="btn btn-primary btn-lg">
                      {t('hero.signup')}
                    </Link>
                    <Link to="/tes-penempatan" className="xl-hero-link">
                      {t('hero.placement')}
                    </Link>
                  </>
                )}
              </div>
              {user && (
                <div className="xl-hero-mini">
                  <MiniSheet table={HERO_TABLE} label="Contoh lembar kerja mini" initial="B4" />
                  <p className="xl-small xl-muted mt-2 mb-0">{t('hero.miniCaption')}</p>
                </div>
              )}
            </div>
            <HeroVisual />
          </div>
        </div>
      </section>

      {user ? (
        <div className="xl-page">
          <ProgramBanner />

          <Section id="jalur" title={t('home.path.title')} lead={t('home.path.lead')}>
            <ReviewDueBanner />
            <PathSection />
            <PlacementBanner />
          </Section>

          <Section id="pelajaran" title={t('home.lessons.title')} action={<Link to="/belajar">{t('home.lessons.all')}</Link>}>
            <FeaturedLessons />
          </Section>

          <Section id="coba" title={t('home.try.title')} lead={t('home.try.lead')} action={<Link to="/latihan">{t('home.try.all')}</Link>}>
            <ExercisePreview />
          </Section>

          <Section
            id="shortcut"
            title={t('home.shortcuts.title')}
            lead={t('home.shortcuts.lead')}
            action={<Link to="/shortcut">{t('home.shortcuts.open')}</Link>}
          >
            <ShortcutPreview />
          </Section>

          <Section
            id="worksheet"
            title={t('home.worksheets.title')}
            lead={t('home.worksheets.lead')}
            action={<Link to="/worksheet">{t('home.worksheets.all')}</Link>}
          >
            <WorksheetPreview />
          </Section>

          <SprintTeaser />
        </div>
      ) : (
        <Landing />
      )}
    </>
  );
}
