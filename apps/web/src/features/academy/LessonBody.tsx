import { useState, type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { Status } from '../../components/feedback/Feedback';
import { MiniSheet } from '../../components/spreadsheet/MiniSheet';
import type { LessonContent } from '../../services/types';

function Quiz({ quiz }: { quiz: LessonContent['quiz'] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  return (
    <div>
      {quiz.map((q, i) => {
        const chosen = answers[i];
        const isChecked = checked[i];
        const correct = chosen === q.answerIndex;
        return (
          <fieldset key={i} className="xl-quiz">
            <legend className="h6">{q.question}</legend>
            {q.options.map((o, oi) => (
              <div className="form-check" key={oi}>
                <input
                  className="form-check-input"
                  type="radio"
                  name={`quiz-${i}`}
                  id={`quiz-${i}-${oi}`}
                  checked={chosen === oi}
                  onChange={() => (setAnswers((a) => ({ ...a, [i]: oi })), setChecked((c) => ({ ...c, [i]: false })))}
                />
                <label className="form-check-label" htmlFor={`quiz-${i}-${oi}`}>
                  {o}
                </label>
              </div>
            ))}
            <div className="mt-2" aria-live="polite">
              {isChecked ? (
                <Status tone={correct ? 'success' : 'error'}>
                  <strong>{correct ? 'Benar.' : 'Belum tepat.'}</strong> {q.explanation}
                </Status>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={chosen === undefined}
                  onClick={() => setChecked((c) => ({ ...c, [i]: true }))}
                >
                  Periksa jawaban
                </button>
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

interface Props {
  title: string;
  summary: string;
  minutes: number;
  content: LessonContent;
  /** Isi bagian "Coba sekarang". Pratinjau admin tidak memakainya. */
  practice?: ReactNode;
}

/** Isi pelajaran dari judul sampai kuis. Dipakai halaman pelajaran dan pratinjau di admin. */
export function LessonBody({ title, summary, minutes, content: c, practice }: Props) {
  return (
    <>
      <header className="mb-4">
        <h1>{title}</h1>
        <p className="xl-muted mb-2">{summary}</p>
        <span className="xl-muted xl-small">
          <Clock className="xl-icon me-1" aria-hidden="true" />
          Perkiraan {minutes} menit
        </span>
      </header>

      <section aria-labelledby="tujuan" className="xl-objectives">
        <h2 id="tujuan" className="h6 xl-eyebrow">
          Tujuan belajar
        </h2>
        <ul>
          {c.objectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      </section>

      {c.sections.map((s, si) => (
        <section key={si}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}

      {c.syntax && (
        <section aria-labelledby="sintaks">
          <h2 id="sintaks">Sintaks</h2>
          <pre className="xl-code">{c.syntax.signature}</pre>
          <dl className="xl-params">
            {c.syntax.params.map((p, i) => (
              <div key={i}>
                <dt>
                  <code>{p.name}</code>
                </dt>
                <dd>{p.description}</dd>
              </div>
            ))}
          </dl>
          {c.syntax.notes?.map((n, i) => (
            <p key={i} className="xl-muted xl-small">
              {n}
            </p>
          ))}
        </section>
      )}

      <section aria-labelledby="contoh">
        <h2 id="contoh">Contoh: {c.example.title}</h2>
        <p>{c.example.description}</p>
        <MiniSheet table={c.example.table} label={`Contoh: ${c.example.title}`} />
        <p className="mt-3 mb-1">Rumus:</p>
        <pre className="xl-code">{c.example.formula}</pre>
        <p className="mb-1">
          <strong>Hasil:</strong> {c.example.result}
        </p>
        <p className="xl-muted">{c.example.walkthrough}</p>
      </section>

      <section aria-labelledby="kesalahan">
        <h2 id="kesalahan">Kesalahan yang sering terjadi</h2>
        <ul className="xl-mistakes">
          {c.mistakes.map((m, i) => (
            <li key={i}>
              <strong>{m.title}.</strong> {m.detail}
            </li>
          ))}
        </ul>
      </section>

      {c.playgroundNote && (
        <Status tone="info">
          <strong>Excel asli vs playground.</strong> {c.playgroundNote}
        </Status>
      )}

      {practice}

      <section aria-labelledby="kuis">
        <h2 id="kuis">Cek pemahaman</h2>
        <Quiz quiz={c.quiz} />
      </section>
    </>
  );
}
