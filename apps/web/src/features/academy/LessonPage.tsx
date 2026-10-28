import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, CircleCheck, Circle } from 'lucide-react';
import { isPublicLesson } from '@excellab/shared';
import { useAuth } from '../../app/AuthContext';
import { useProgress } from '../../app/ProgressContext';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { Level } from '../../components/learning/Bits';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiError } from '../../services/api';
import type { LessonDetail } from '../../services/types';
import { LessonBody } from './LessonBody';

export function LessonPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const q = preview ? '?preview=1' : '';
  const { user, loading: authLoading } = useAuth();
  const guest = !authLoading && !user;
  // Pengunjung tanpa akun hanya boleh membuka pelajaran contoh; yang lain langsung diarahkan masuk tanpa meminta ke server.
  const blocked = guest && !isPublicLesson(slug);
  const lesson = useAsync(
    (s) =>
      blocked || authLoading
        ? new Promise<LessonDetail>(() => undefined)
        : api.get<LessonDetail>(`/lessons/${encodeURIComponent(slug)}${q}`, s),
    [slug, q, blocked, authLoading],
  );
  const { progress, completeLesson, uncompleteLesson } = useProgress();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useDocumentTitle(lesson.data?.title);

  if (blocked) {
    return (
      <div className="xl-page xl-page-narrow py-4">
        <EmptyState title="Pelajaran ini untuk anggota">
          <p>Masuk atau daftar gratis untuk membuka semua pelajaran, latihan, shortcut, dan worksheet.</p>
          <Link to="/daftar" className="btn btn-primary btn-sm me-2">
            Daftar gratis
          </Link>
          <Link to="/masuk" className="btn btn-outline-secondary btn-sm">
            Masuk
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (lesson.loading) {
    return (
      <div className="xl-page">
        <Loading label="Memuat pelajaran…" lines={6} />
      </div>
    );
  }
  if (lesson.error || !lesson.data) {
    const notFound = lesson.error?.includes('tidak ditemukan');
    return (
      <div className="xl-page xl-page-narrow py-4">
        {notFound ? (
          <EmptyState title="Pelajaran tidak ditemukan">
            <Link to="/belajar">Kembali ke daftar pelajaran</Link>
          </EmptyState>
        ) : (
          <ErrorState message={lesson.error ?? 'Pelajaran tidak tersedia.'} onRetry={lesson.reload} />
        )}
      </div>
    );
  }

  const l = lesson.data;
  const c = l.content;
  const done = progress.completedLessons.has(l.slug);
  const siblings = l.siblings;

  const toggle = async (): Promise<void> => {
    setBusy(true);
    setSaveError(null);
    try {
      if (done) await uncompleteLesson(l.slug);
      else await completeLesson(l.slug);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Gagal menyimpan progres.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="xl-page">
      <nav aria-label="Breadcrumb" className="xl-breadcrumb">
        {guest ? <span>Belajar</span> : <Link to="/belajar">Belajar</Link>}
        <span aria-hidden="true">/</span>
        <span>{l.module.title}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{l.title}</span>
      </nav>

      {preview && <Status tone="warning">Mode pratinjau admin{!l.published && ' - pelajaran ini belum diterbitkan'}.</Status>}

      <div className="xl-lesson-layout">
        <article className="xl-lesson">
          <LessonBody
            title={l.title}
            summary={l.summary}
            minutes={l.minutes}
            content={c}
            practice={
              <section aria-labelledby="praktik" className="xl-practice">
                <h2 id="praktik">Coba sekarang</h2>
                {l.exercises.length === 0 ? (
                  <p className="xl-muted">
                    {c.guide
                      ? 'Pelajaran ini berupa langkah di menu Excel, jadi tidak ada latihan di playground. Coba langsung di Excel-mu, lalu cek pemahamanmu lewat kuis di bawah.'
                      : 'Belum ada latihan untuk pelajaran ini.'}
                  </p>
                ) : (
                  <ul className="xl-exercise-links">
                    {l.exercises.map((e) => {
                      const ok = !!progress.completedExercises[e.slug];
                      return (
                        <li key={e.slug}>
                          {ok ? (
                            <CircleCheck className="xl-icon text-success" aria-label="Selesai" />
                          ) : (
                            <Circle className="xl-icon xl-muted" aria-label="Belum selesai" />
                          )}
                          {guest ? <span>{e.title}</span> : <Link to={`/latihan/${e.slug}${q}`}>{e.title}</Link>}
                          <Level difficulty={e.difficulty} />
                          <span className="xl-muted xl-small">{e.points} poin</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            }
          />

          {guest && (
            <Status tone="info">
              <strong>Ini pelajaran contoh.</strong> Daftar gratis untuk mengerjakan latihannya, menyimpan progres, dan membuka pelajaran
              lainnya.
              <div className="mt-2 d-flex flex-wrap gap-2">
                <Link to="/daftar" className="btn btn-primary btn-sm">
                  Daftar gratis
                </Link>
                <Link to="/masuk" className="btn btn-outline-secondary btn-sm">
                  Masuk
                </Link>
              </div>
            </Status>
          )}

          {!guest && (
            <section className="xl-completion" aria-labelledby="selesai">
              <h2 id="selesai" className="h6">
                {done ? 'Pelajaran selesai' : 'Sudah paham pelajaran ini?'}
              </h2>
              {saveError && (
                <Status tone="error" live>
                  {saveError}
                </Status>
              )}
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <button
                  type="button"
                  className={`btn ${done ? 'btn-outline-secondary' : 'btn-primary'}`}
                  onClick={toggle}
                  disabled={busy}
                  aria-pressed={done}
                >
                  {done ? 'Batalkan tanda selesai' : 'Tandai pelajaran selesai'}
                </button>
                {done && l.next && (
                  <Link to={`/belajar/${l.next.slug}`} className="btn btn-primary">
                    Lanjut: {l.next.title}
                  </Link>
                )}
              </div>
              {done && (
                <p className="xl-small xl-muted mt-2 mb-0">
                  {progress.source === 'account' ? 'Tersimpan di akunmu.' : 'Tersimpan di browser ini.'}
                </p>
              )}
            </section>
          )}

          <nav className="xl-prevnext" aria-label="Pelajaran sebelumnya dan berikutnya">
            {l.prev && (!guest || isPublicLesson(l.prev.slug)) ? (
              <Link to={`/belajar/${l.prev.slug}`}>
                <ArrowLeft className="xl-icon" aria-hidden="true" /> <span className="xl-muted xl-small d-block">Sebelumnya</span>
                {l.prev.title}
              </Link>
            ) : (
              <span />
            )}
            {l.next && (!guest || isPublicLesson(l.next.slug)) && (
              <Link to={`/belajar/${l.next.slug}`} className="text-end">
                <span className="xl-muted xl-small d-block">
                  Berikutnya <ArrowRight className="xl-icon" aria-hidden="true" />
                </span>
                {l.next.title}
              </Link>
            )}
          </nav>
        </article>

        <aside className="xl-lesson-aside" aria-label={`Pelajaran di modul ${l.module.title}`}>
          <h2 className="h6">{l.module.title}</h2>
          <ol>
            {siblings.map((s) => (
              <li key={s.slug}>
                {guest && !isPublicLesson(s.slug) ? (
                  <span className="xl-muted">{s.title}</span>
                ) : (
                  <Link to={`/belajar/${s.slug}`} aria-current={s.slug === l.slug ? 'page' : undefined}>
                    {progress.completedLessons.has(s.slug) ? (
                      <CircleCheck className="xl-icon text-success" aria-label="Selesai" />
                    ) : (
                      <Circle className="xl-icon xl-muted" aria-hidden="true" />
                    )}
                    {s.title}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
