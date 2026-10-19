import { useState } from 'react';
import { shortcutCategories } from '@excellab/shared';
import { Status } from '../../components/feedback/Feedback';
import { Keycaps } from '../../components/learning/Bits';
import type { ShortcutView } from '../../services/types';
import type { Platform } from './prefs';

const ROUNDS = 10;

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface Question {
  item: ShortcutView;
  options: ShortcutView[];
}

export function buildQuestions(
  shortcuts: ShortcutView[],
  platform: Platform,
  rnd: () => number = Math.random,
  rounds = ROUNDS,
): Question[] {
  const key = (s: ShortcutView): string | null => (platform === 'mac' ? s.keysMac : s.keysWindows);
  const pool = shortcuts.filter((s) => key(s));
  const picked = shuffle(pool, rnd).slice(0, Math.min(rounds, pool.length));
  return picked.map((item) => {
    // Pilihan pengecoh harus memiliki kombinasi tombol berbeda dari jawaban.
    const used = new Set<string | null>([key(item)]);
    const distractors: ShortcutView[] = [];
    for (const s of shuffle(pool, rnd)) {
      if (distractors.length === 3) break;
      if (s.slug === item.slug || used.has(key(s))) continue;
      used.add(key(s));
      distractors.push(s);
    }
    return { item, options: shuffle([item, ...distractors], rnd) };
  });
}

export function ShortcutQuiz({
  shortcuts,
  platform,
  onPlatform,
}: {
  shortcuts: ShortcutView[];
  platform: Platform;
  onPlatform: (p: Platform) => void;
}) {
  const [questions, setQuestions] = useState(() => buildQuestions(shortcuts, platform));
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const restart = (p: Platform = platform): void => {
    setQuestions(buildQuestions(shortcuts, p));
    setIndex(0);
    setChosen(null);
    setScore(0);
  };

  const keyOf = (s: ShortcutView): string => (platform === 'mac' ? s.keysMac : s.keysWindows) ?? '';

  if (questions.length === 0) return <Status tone="warning">Tidak ada shortcut untuk platform ini.</Status>;

  const finished = index >= questions.length;
  const q = questions[index];

  return (
    <div className="xl-panel xl-quiz-panel">
      <div className="xl-panel-head">
        Kuis shortcut
        <span className="ms-auto d-flex align-items-center gap-2">
          <label htmlFor="quiz-plat" className="visually-hidden">
            Platform kuis
          </label>
          <select
            id="quiz-plat"
            className="form-select form-select-sm"
            value={platform}
            onChange={(e) => {
              const p = e.target.value as Platform;
              onPlatform(p);
              restart(p);
            }}
          >
            <option value="windows">Windows</option>
            <option value="mac">Mac</option>
          </select>
        </span>
      </div>
      <div className="xl-panel-body">
        {finished ? (
          <div aria-live="polite">
            <h2 className="h4">
              Skor akhir: {score} dari {questions.length}
            </h2>
            <p className="xl-muted">
              {score === questions.length
                ? 'Sempurna! Coba platform lain atau ulangi untuk soal berbeda.'
                : 'Ulangi untuk memperkuat ingatan. Soal diacak setiap kali.'}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => restart()}>
              Main lagi
            </button>
          </div>
        ) : (
          q && (
            <div>
              <p className="xl-muted xl-small mb-1">
                Soal {index + 1} dari {questions.length} · skor {score}
              </p>
              <h2 className="h5" id="quiz-q">
                Shortcut mana yang dipakai untuk: <em>{q.item.action}</em>?
              </h2>
              <div role="radiogroup" aria-labelledby="quiz-q" className="xl-quiz-options">
                {q.options.map((o) => {
                  const picked = chosen === o.slug;
                  const isAnswer = o.slug === q.item.slug;
                  const state = chosen ? (isAnswer ? 'correct' : picked ? 'wrong' : '') : '';
                  return (
                    <button
                      key={o.slug}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      className={`xl-quiz-option ${state}`}
                      disabled={!!chosen}
                      onClick={() => {
                        setChosen(o.slug);
                        if (isAnswer) setScore((s) => s + 1);
                      }}
                    >
                      <Keycaps combo={keyOf(o)} />
                      {chosen && isAnswer && <span className="xl-small fw-semibold ms-auto">Jawaban benar</span>}
                      {chosen && picked && !isAnswer && <span className="xl-small fw-semibold ms-auto">Pilihanmu</span>}
                    </button>
                  );
                })}
              </div>
              <div aria-live="polite" className="mt-3">
                {chosen && (
                  <>
                    <Status tone={chosen === q.item.slug ? 'success' : 'error'}>
                      <strong>{chosen === q.item.slug ? 'Benar!' : 'Belum tepat.'}</strong> {q.item.action} ={' '}
                      <Keycaps combo={keyOf(q.item)} />. {q.item.explanation}
                      <div className="xl-small xl-muted mt-1">Kategori: {shortcutCategories[q.item.category]}</div>
                    </Status>
                    <button
                      type="button"
                      className="btn btn-primary mt-3"
                      onClick={() => {
                        setIndex((i) => i + 1);
                        setChosen(null);
                      }}
                    >
                      {index + 1 === questions.length ? 'Lihat skor' : 'Soal berikutnya'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
