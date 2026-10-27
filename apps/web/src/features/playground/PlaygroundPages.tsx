import { Link, useParams, useSearchParams } from 'react-router';
import { CircleCheck, Circle } from 'lucide-react';
import { useProgress } from '../../app/ProgressContext';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { Level } from '../../components/learning/Bits';
import { ExerciseWorkspace } from '../../components/spreadsheet/ExerciseWorkspace';
import { HowToPanel } from '../../components/spreadsheet/HowToPanel';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import { ShareButton } from '../progress/Sharing';
import { TOPIC_LABELS, type ChallengeToday, type Difficulty, type ExerciseSummary, type PublicExercise } from '../../services/types';

const DIFFS: Difficulty[] = ['mudah', 'sedang', 'sulit'];

export function ExerciseCatalogPage() {
  useDocumentTitle('Latihan');
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const { progress } = useProgress();

  const qs = new URLSearchParams({ pageSize: '100' });
  if (topic && topic in TOPIC_LABELS) qs.set('topic', topic);
  if (DIFFS.includes(difficulty as Difficulty)) qs.set('difficulty', difficulty);
  const list = useAsync((s) => api.get<ExerciseSummary[]>(`/exercises?${qs.toString()}`, s), [qs.toString()]);

  const set = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Latihan</p>
        <h1>Katalog latihan</h1>
        <p>Setiap latihan berupa lembar kerja mini dengan tugas, petunjuk bertahap, dan umpan balik yang menjelaskan jawabanmu.</p>
      </header>

      <HowToPanel mode="katalog" />

      <form className="xl-filters" onSubmit={(e) => e.preventDefault()} aria-label="Saring latihan">
        <div>
          <label htmlFor="f-topic" className="form-label">
            Topik
          </label>
          <select id="f-topic" className="form-select" value={topic} onChange={(e) => set('topic', e.target.value)}>
            <option value="">Semua topik</option>
            {Object.entries(TOPIC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-diff" className="form-label">
            Tingkat
          </label>
          <select id="f-diff" className="form-select" value={difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            <option value="">Semua tingkat</option>
            {DIFFS.map((d) => (
              <option key={d} value={d}>
                {d[0]!.toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {(topic || difficulty) && (
          <div className="align-self-end">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setParams({}, { replace: true })}>
              Hapus filter
            </button>
          </div>
        )}
      </form>

      {list.loading && <Loading label="Memuat latihan…" lines={5} />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && (
        <EmptyState title="Tidak ada latihan yang cocok">
          Coba ubah filter.{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setParams({}, { replace: true })}>
            Tampilkan semua
          </button>
        </EmptyState>
      )}
      {list.data && list.data.length > 0 && (
        <>
          <p className="xl-muted xl-small" role="status">
            {list.data.length} latihan
          </p>
          <ul className="xl-exercise-rows">
            {list.data.map((e) => {
              const done = !!progress.completedExercises[e.slug];
              return (
                <li key={e.slug}>
                  {done ? (
                    <CircleCheck className="xl-icon text-success" aria-label="Selesai" />
                  ) : (
                    <Circle className="xl-icon xl-muted" aria-label="Belum selesai" />
                  )}
                  <Link to={`/latihan/${e.slug}`} className="xl-exercise-main">
                    <span className="xl-lesson-title">{e.title}</span>
                    <span className="xl-muted xl-small">{e.description}</span>
                  </Link>
                  <span className="xl-muted xl-small d-none d-md-inline">{TOPIC_LABELS[e.topic] ?? e.topic}</span>
                  <Level difficulty={e.difficulty} />
                  <span className="xl-small text-nowrap">{e.points} poin</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function PlaygroundPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const ex = useAsync(
    (s) => api.get<PublicExercise>(`/exercises/${encodeURIComponent(slug)}${preview ? '?preview=1' : ''}`, s),
    [slug, preview],
  );
  const all = useAsync((s) => api.get<ExerciseSummary[]>('/exercises?pageSize=100', s).catch(() => [] as ExerciseSummary[]), []);
  useDocumentTitle(ex.data?.title);

  if (ex.loading) {
    return (
      <div className="xl-page">
        <Loading label="Memuat latihan…" lines={5} />
      </div>
    );
  }
  if (ex.error || !ex.data) {
    const nf = ex.error?.includes('tidak ditemukan');
    return (
      <div className="xl-page py-4">
        {nf ? (
          <EmptyState title="Latihan tidak ditemukan">
            <Link to="/latihan">Lihat semua latihan</Link>
          </EmptyState>
        ) : (
          <ErrorState message={ex.error ?? 'Latihan tidak tersedia.'} onRetry={ex.reload} />
        )}
      </div>
    );
  }
  const e = ex.data;
  const idx = all.data?.findIndex((x) => x.slug === e.slug) ?? -1;
  const next = idx >= 0 && all.data ? (all.data[idx + 1]?.slug ?? null) : null;

  return (
    <div className="xl-page">
      <nav aria-label="Breadcrumb" className="xl-breadcrumb">
        <Link to="/latihan">Latihan</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/latihan?topic=${e.topic}`}>{TOPIC_LABELS[e.topic] ?? e.topic}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{e.title}</span>
      </nav>
      {preview && <Status tone="warning">Mode pratinjau admin.</Status>}
      <header className="mb-3">
        <h1 className="mb-1">{e.title}</h1>
        <p className="xl-muted mb-2">{e.description}</p>
        <ShareButton title={`Latihan Excel: ${e.title}`} path={`/latihan/${e.slug}`} label="Bagikan latihan" />
      </header>
      <ExerciseWorkspace key={e.slug} exercise={e} nextSlug={next} preview={preview} />
    </div>
  );
}

export function ChallengePage() {
  useDocumentTitle('Tantangan harian');
  const ch = useAsync((s) => api.get<ChallengeToday>('/challenges/today', s), []);
  const { progress } = useProgress();
  const dateLabel = ch.data
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' }).format(new Date(`${ch.data.date}T12:00:00+07:00`))
    : '';
  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Tantangan harian</p>
        <h1>Satu latihan untuk hari ini</h1>
        <p>
          Tantangan berganti setiap hari (zona waktu WIB) dengan memutar daftar latihan yang tersedia.{' '}
          {dateLabel && <strong>{dateLabel}</strong>}
        </p>
        <p className="mb-0 xl-small">
          Streak belajarmu: <strong>{progress.streak.current} hari</strong> (terpanjang {progress.streak.longest}). Menyelesaikan latihan
          atau pelajaran apa pun menambah hari aktif.
        </p>
      </header>
      {ch.loading && <Loading label="Memuat tantangan…" lines={4} />}
      {ch.error && <ErrorState message={ch.error} onRetry={ch.reload} />}
      {ch.data && (
        <>
          <h2 className="h4">{ch.data.exercise.title}</h2>
          <p className="xl-muted">{ch.data.exercise.description}</p>
          <div className="mb-3">
            <ShareButton title="Tantangan harian Mahir Excel" path="/tantangan" label="Bagikan tantangan" />
          </div>
          <ExerciseWorkspace key={ch.data.exercise.slug} exercise={ch.data.exercise} nextSlug={null} />
        </>
      )}
    </div>
  );
}
