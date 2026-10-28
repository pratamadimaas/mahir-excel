import { Link, useParams } from 'react-router';
import { ArrowRight, CircleCheck, Circle, Lock } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { useProgress } from '../../app/ProgressContext';
import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { ProgressBar } from '../../components/learning/Bits';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import type { PathDetail, PathSummary } from '../../services/types';

export function PathsPage() {
  useDocumentTitle('Bidang');
  const { user } = useAuth();
  const { progress } = useProgress();
  const list = useAsync((s) => api.get<PathSummary[]>('/paths', s), []);

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Mulai dari tujuanmu</p>
        <h1>Bidang</h1>
        <p>
          Bingung mulai dari mana? Pilih bidang sesuai tujuanmu. Setiap bidang adalah urutan pelajaran dan latihan yang sudah dipilih, ditambah template yang cocok. Semua pelajarannya gratis; bidang hanya
          merapikan urutannya.
        </p>
      </header>

      {list.loading && <Loading label="Memuat bidang…" lines={3} />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <EmptyState title="Belum ada bidang" />}

      {list.data && (
        <ul className="xl-tpl-grid">
          {list.data.map((p) => {
            const done = user ? (p.lessonSlugs ?? []).filter((s) => progress.completedLessons.has(s)).length : 0;
            return (
              <li key={p.slug} className="xl-tpl-card">
                <h2 className="h5 m-0">
                  <Link to={`/jalur/${p.slug}`}>{p.title}</Link>
                </h2>
                <p className="mb-0">{p.tagline}</p>
                <p className="xl-small xl-muted mb-0">{p.forWho}</p>
                <p className="xl-small mb-0">
                  {p.lessons} pelajaran · sekitar {p.minutes} menit · {p.exercises} latihan
                </p>
                {user && <ProgressBar value={done} max={p.lessons} label={`Kemajuan bidang ${p.title}: ${done} dari ${p.lessons} pelajaran`} />}
                <div className="xl-tpl-foot">
                  <Link className="btn btn-primary btn-sm" to={`/jalur/${p.slug}`}>
                    {user && done > 0 ? 'Lanjutkan belajar' : 'Lihat bidang'} <ArrowRight className="xl-icon ms-1 me-0" aria-hidden="true" />
                  </Link>
                  {user && <span className="xl-small xl-muted">{done} dari {p.lessons} selesai</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="xl-small xl-muted mt-4">
        Bidang adalah susunan belajar yang kami pilih, bukan jaminan pekerjaan dan bukan sertifikasi resmi. Setiap perusahaan punya kebutuhan Excel yang berbeda.
      </p>
    </div>
  );
}

export function PathDetailPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { progress } = useProgress();
  const premium = !!user?.premium;
  const path = useAsync((s) => api.get<PathDetail>(`/paths/${encodeURIComponent(slug)}`, s), [slug]);
  useDocumentTitle(path.data ? `Bidang ${path.data.title}` : undefined);

  if (path.loading) {
    return (
      <div className="xl-page">
        <Loading label="Memuat bidang…" lines={5} />
      </div>
    );
  }
  if (path.error || !path.data) {
    const nf = path.error?.includes('tidak ditemukan');
    return (
      <div className="xl-page py-4">
        {nf ? (
          <EmptyState title="Bidang tidak ditemukan">
            <Link to="/jalur">Lihat semua bidang</Link>
          </EmptyState>
        ) : (
          <ErrorState message={path.error ?? 'Bidang tidak tersedia.'} onRetry={path.reload} />
        )}
      </div>
    );
  }

  const p = path.data;
  const done = user ? p.steps.filter((s) => progress.completedLessons.has(s.slug)).length : 0;
  const next = p.steps.find((s) => !progress.completedLessons.has(s.slug));

  return (
    <div className="xl-page">
      <nav aria-label="Breadcrumb" className="xl-breadcrumb">
        <Link to="/jalur">Bidang</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{p.title}</span>
      </nav>

      <header className="xl-page-head">
        <p className="xl-eyebrow">Bidang</p>
        <h1>{p.title}</h1>
        <p>{p.forWho}</p>
        <p className="xl-small xl-muted">
          {p.lessons} pelajaran · sekitar {p.minutes} menit · {p.exercises} latihan
        </p>
      </header>

      {user ? (
        <section aria-label="Kemajuanmu di bidang ini" className="mb-4">
          <ProgressBar value={done} max={p.lessons} label={`Kemajuan bidang: ${done} dari ${p.lessons} pelajaran`} large />
          <div className="d-flex align-items-center flex-wrap gap-3 mt-2">
            <span>
              {done} dari {p.lessons} pelajaran selesai
            </span>
            {next ? (
              <Link className="btn btn-primary btn-sm" to={`/belajar/${next.slug}`}>
                {done === 0 ? 'Mulai dari pelajaran pertama' : `Lanjutkan: ${next.title}`} <ArrowRight className="xl-icon ms-1 me-0" aria-hidden="true" />
              </Link>
            ) : (
              <strong>Bidang ini selesai.</strong>
            )}
          </div>
        </section>
      ) : (
        <p className="mb-4">
          <Link className="btn btn-primary btn-sm" to="/daftar">
            Daftar gratis untuk mulai
          </Link>{' '}
          <span className="xl-small xl-muted ms-2">Pelajaran bertanda “contoh” bisa dibaca tanpa akun.</span>
        </p>
      )}

      <section aria-labelledby="pj-bisa" className="mb-4">
        <h2 id="pj-bisa" className="h5">
          Setelah bidang ini kamu bisa
        </h2>
        <ul>
          {p.outcomes.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pj-urutan" className="mb-4">
        <h2 id="pj-urutan" className="h5">
          Urutan belajar
        </h2>
        <ol className="xl-file-list">
          {p.steps.map((s, i) => {
            const isDone = !!user && progress.completedLessons.has(s.slug);
            return (
              <li key={s.slug}>
                {isDone ? <CircleCheck className="xl-icon text-success" aria-label="Selesai" /> : <Circle className="xl-icon xl-muted" aria-label="Belum selesai" />}
                <div className="xl-file-main">
                  <Link to={`/belajar/${s.slug}`} className="xl-file-title">
                    {i + 1}. {s.title}
                  </Link>
                  <span className="xl-muted xl-small">{s.summary}</span>
                  <span className="xl-small xl-skills">
                    {s.moduleTitle} · {s.minutes} menit · {s.exerciseCount} latihan{s.publicLesson ? ' · contoh terbuka' : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {p.templates.length > 0 && (
        <section aria-labelledby="pj-template" className="mb-4">
          <h2 id="pj-template" className="h5">
            Template yang cocok
          </h2>
          <ul>
            {p.templates.map((t) => (
              <li key={t.slug}>
                <Link to="/template">{t.title}</Link> <span className={`xl-tag${t.free ? '' : ' premium'}`}>{t.free ? 'Gratis' : 'Premium'}</span>
                <div className="xl-small xl-muted">{t.description}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pj-premium" className="mb-4">
        <h2 id="pj-premium" className="h5">
          {premium ? 'Yang bisa kamu pakai sebagai Premium' : 'Tambahan dengan Premium'}
        </h2>
        {premium ? (
          <ul>
            {p.premiumExtras.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : (
          <div className="xl-premium-lock" role="note">
            <Lock className="xl-icon" aria-hidden="true" />
            <div>
              <ul className="mb-2">
                {p.premiumExtras.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <Link to="/premium">Lihat Premium</Link>
            </div>
          </div>
        )}
      </section>

      <p className="xl-small xl-muted">Bidang adalah susunan belajar yang kami pilih, bukan jaminan pekerjaan dan bukan sertifikasi resmi.</p>
    </div>
  );
}
