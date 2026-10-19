import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Check, Timer, X, Zap } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { Status } from '../../components/feedback/Feedback';
import { Field } from '../../components/forms/Field';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiError, errorMessage } from '../../services/api';
import { Leaderboard } from './Leaderboard';

type Cell = string | number;

interface Question {
  index: number;
  kind: 'hasil' | 'galat' | 'shortcut';
  prompt: string;
  table: Cell[][];
  formula: string | null;
  options: string[];
}

interface StartData {
  token: string;
  durationMs: number;
  endsAtMs: number;
  serverNowMs: number;
  question: Question;
}

interface AnswerData {
  accepted: boolean;
  correct?: boolean;
  correctIndex?: number;
  delta?: number;
  score: number;
  streak?: number;
  finished: boolean;
  question?: Question | null;
}

interface Summary {
  score: number;
  correct: number;
  wrong: number;
  rankToday: number;
  rankAll: number;
  canSubmit: boolean;
  submitted: boolean;
}

type Phase = 'idle' | 'starting' | 'playing' | 'finishing' | 'done';

const NAME_KEY = 'excellab.sprint.name';
const nf = new Intl.NumberFormat('id-ID');
const colLetter = (i: number): string => String.fromCharCode(65 + i);

function readSavedName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* mode privat: nama hanya dipakai untuk sesi ini */
  }
}

/** Tabel data soal: hanya baca, tanpa mesin rumus (hasilnya ditanyakan, jadi tidak boleh dihitung di sini). */
function QuestionTable({ table }: { table: Cell[][] }) {
  if (table.length === 0) return null;
  const cols = Math.max(...table.map((r) => r.length));
  return (
    <div className="xl-sp-table-wrap">
      <table className="xl-sp-table">
        <caption className="visually-hidden">Data untuk soal ini</caption>
        <thead>
          <tr>
            <th scope="col" />
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} scope="col">
                {colLetter(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, r) => (
            <tr key={r}>
              <th scope="row">{r + 1}</th>
              {Array.from({ length: cols }, (_, c) => {
                const v = row[c];
                return (
                  <td key={c} className={typeof v === 'number' ? 'num' : undefined}>
                    {v === undefined || v === '' ? '' : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SprintPage() {
  useDocumentTitle('Sprint');
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [duration, setDuration] = useState(60_000);
  const [last, setLast] = useState<{ correct: boolean; delta: number; answer?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [name, setName] = useState(() => readSavedName());
  const [nameError, setNameError] = useState<string | undefined>();
  const [savedName, setSavedName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [introSeconds, setIntroSeconds] = useState(60);

  const session = useRef<{ token: string; endsAt: number; offset: number } | null>(null);
  const busy = useRef(false);
  const phaseRef = useRef<Phase>('idle');
  const questionRef = useRef<Question | null>(null);
  phaseRef.current = phase;
  questionRef.current = question;

  const finish = useCallback(async () => {
    const s = session.current;
    if (!s || phaseRef.current === 'finishing' || phaseRef.current === 'done') return;
    setPhase('finishing');
    phaseRef.current = 'finishing';
    for (let i = 0; i < 40 && busy.current; i++) await new Promise((r) => setTimeout(r, 50));
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const sum = await api.post<Summary>(`/sprint/${s.token}/finish`, {});
        setSummary(sum);
        setScore(sum.score);
        setPhase('done');
        return;
      } catch (e) {
        // Jam klien bisa sedikit mendahului server: coba lagi sebentar.
        if (e instanceof ApiError && e.status === 409 && attempt < 7) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        setError(errorMessage(e));
        setPhase('done');
        return;
      }
    }
  }, []);

  // Penghitung waktu mengikuti jam server (offset dihitung saat mulai), bukan jam perangkat.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      const s = session.current;
      if (!s) return;
      const left = Math.max(0, s.endsAt - (Date.now() + s.offset));
      setRemaining(left);
      const sec = Math.ceil(left / 1000);
      if (sec === 30 || sec === 10 || sec === 5) setAnnounce(`Sisa ${sec} detik`);
      if (left <= 0) void finish();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  const start = async (): Promise<void> => {
    setPhase('starting');
    setError(null);
    setNotice(null);
    setSummary(null);
    setSavedName(null);
    setNameError(undefined);
    setLast(null);
    setScore(0);
    setStreak(0);
    try {
      const d = await api.post<StartData>('/sprint/start', {});
      session.current = { token: d.token, endsAt: d.endsAtMs, offset: d.serverNowMs - Date.now() };
      setDuration(d.durationMs);
      setRemaining(d.durationMs);
      setQuestion(d.question);
      setAnnounce('Ronde dimulai');
      setPhase('playing');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  };

  const answer = useCallback(
    async (choice: number): Promise<void> => {
      const s = session.current;
      const q = questionRef.current;
      if (!s || !q || busy.current || phaseRef.current !== 'playing') return;
      busy.current = true;
      setNotice(null);
      try {
        const d = await api.post<AnswerData>(`/sprint/${s.token}/answer`, { q: q.index, choice });
        if (d.accepted) {
          setScore(d.score);
          setStreak(d.streak ?? 0);
          setLast({
            correct: !!d.correct,
            delta: d.delta ?? 0,
            answer: d.correct || d.correctIndex === undefined ? undefined : q.options[d.correctIndex],
          });
        }
        if (d.question) setQuestion(d.question);
        if (d.finished || !d.question) {
          busy.current = false;
          await finish();
          return;
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) setNotice('Terlalu cepat, baca soalnya dulu.');
        else if (e instanceof ApiError && e.status === 409) void finish();
        else setNotice(errorMessage(e));
      } finally {
        busy.current = false;
      }
    },
    [finish],
  );

  // Pintasan keyboard 1-4 (juga A-D) selama bermain.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      if (i >= 0 && e.key.length === 1) {
        e.preventDefault();
        void answer(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answer]);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const s = session.current;
    if (!s || saving) return;
    const chosen = (name || user?.displayName || '').trim();
    setSaving(true);
    setNameError(undefined);
    try {
      const r = await api.post<{ name: string }>(`/sprint/${s.token}/submit`, { name: chosen });
      saveName(r.name);
      setSavedName(r.name);
      setBoardKey((k) => k + 1);
    } catch (err) {
      setNameError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const seconds = Math.ceil(remaining / 1000);
  const pct = duration > 0 ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 0;

  return (
    <div className="xl-page xl-sp">
      <header className="xl-sp-head">
        <h1>
          Sprint <span className="xl-sp-sec">{introSeconds} detik</span>
        </h1>
        <p className="xl-l-lead mb-0">
          Jawab soal Excel sebanyak dan secepat mungkin. Soalnya dibuat acak tanpa habis, jadi tidak ada yang bisa menghafal.
        </p>
      </header>

      {error && (
        <Status tone="error" live>
          {error}
        </Status>
      )}

      {(phase === 'idle' || phase === 'starting') && (
        <div className="xl-sp-grid">
          <div>
            <ul className="xl-sp-rules">
              <li>
                <strong>Benar +10.</strong> Tiap jawaban benar berturut-turut menambah bonus 2 poin (maksimal 10).
              </li>
              <li>
                <strong>Salah -5</strong> dan rentetan putus. Menebak asal justru merugikan.
              </li>
              <li>Soal: hasil rumus, nama galat, dan shortcut Windows. Makin panjang rentetan benarmu, makin sulit.</li>
              <li>Tanpa akun. Isi nama di akhir. Nama tampil di papan peringkat publik.</li>
            </ul>
            <button type="button" className="btn btn-primary btn-lg xl-sp-go" onClick={() => void start()} disabled={phase === 'starting'}>
              <Zap className="xl-icon" aria-hidden="true" /> {phase === 'starting' ? 'Menyiapkan…' : 'Mulai'}
            </button>
            <p className="xl-small xl-muted mt-3 mb-0">
              Pintasan: tekan 1, 2, 3, atau 4 untuk memilih jawaban. Hasil tidak resmi dan bisa disembunyikan bila melanggar aturan.
            </p>
          </div>
          <Leaderboard limit={10} onLoaded={(b) => setIntroSeconds(b.durationSeconds)} />
        </div>
      )}

      {(phase === 'playing' || phase === 'finishing') && question && (
        <section aria-label="Ronde berlangsung" className="xl-sp-play">
          <div className="xl-sp-hud">
            <div className="xl-sp-time" aria-hidden="true">
              <Timer className="xl-icon" /> <strong>{seconds}</strong> <span>detik</span>
            </div>
            <div className="xl-sp-stat">
              <span className="label">Skor</span>
              <strong data-testid="skor">{nf.format(score)}</strong>
            </div>
            <div className="xl-sp-stat">
              <span className="label">Rentetan</span>
              <strong>{streak}</strong>
            </div>
          </div>
          <div className="xl-sp-bar" aria-hidden="true">
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="visually-hidden" role="status">
            {announce}
          </p>

          <div className="xl-sp-card">
            <p className="xl-sp-prompt">{question.prompt}</p>
            <QuestionTable table={question.table} />
            {question.formula && <code className="xl-sp-formula">{question.formula}</code>}
            <div className="xl-sp-options" role="group" aria-label="Pilihan jawaban">
              {question.options.map((o, i) => (
                <button
                  key={`${question.index}-${i}`}
                  type="button"
                  className="xl-sp-option"
                  onClick={() => void answer(i)}
                  disabled={phase !== 'playing'}
                  aria-keyshortcuts={String(i + 1)}
                >
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  <span>{o}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="xl-sp-last" role="status" aria-live="polite">
            {notice ? (
              notice
            ) : last ? (
              last.correct ? (
                <span className="ok">
                  <Check className="xl-icon" aria-hidden="true" /> Benar, {last.delta > 0 ? `+${last.delta}` : last.delta}
                </span>
              ) : (
                <span className="bad">
                  <X className="xl-icon" aria-hidden="true" /> Salah, {last.delta}
                  {last.answer ? <>. Jawabannya {last.answer}</> : null}
                </span>
              )
            ) : (
              'Pilih jawaban atau tekan 1 sampai 4.'
            )}
          </p>
          {phase === 'finishing' && <p className="xl-muted">Waktu habis. Menghitung skor…</p>}
        </section>
      )}

      {phase === 'done' && (
        <div className="xl-sp-grid">
          <section aria-labelledby="hasil-sprint" className="xl-sp-result">
            <h2 id="hasil-sprint" className="visually-hidden">
              Hasil ronde
            </h2>
            <p className="xl-sp-bigscore" data-testid="skor-akhir">
              {nf.format(summary?.score ?? score)}
              <span> poin</span>
            </p>
            {summary && (
              <p className="xl-muted">
                {summary.correct} benar, {summary.wrong} salah.
                {summary.canSubmit && (
                  <>
                    {' '}
                    Peringkat hari ini <strong>#{summary.rankToday}</strong>, sepanjang masa <strong>#{summary.rankAll}</strong> bila
                    disimpan.
                  </>
                )}
              </p>
            )}
            {summary?.canSubmit && !savedName && (
              <form onSubmit={submit} noValidate aria-label="Simpan skor">
                <Field
                  id="sprint-name"
                  label="Nama untuk papan peringkat"
                  value={name}
                  maxLength={20}
                  autoComplete="nickname"
                  onChange={(e) => setName(e.target.value)}
                  error={nameError}
                  hint="2 sampai 20 karakter. Nama ini tampil untuk umum, jadi tidak perlu nama lengkap."
                />
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan skor'}
                </button>
              </form>
            )}
            {savedName && (
              <Status tone="success" live>
                Tersimpan sebagai <strong>{savedName}</strong>.
              </Status>
            )}
            {summary && summary.score === 0 && <p className="xl-muted">Skor 0 tidak masuk papan peringkat. Coba lagi, pelan tapi pasti.</p>}
            <div className="d-flex flex-wrap gap-2 mt-3">
              <button type="button" className="btn btn-outline-primary" onClick={() => void start()}>
                Main lagi
              </button>
              {!user && (
                <Link to="/daftar" className="btn btn-outline-secondary">
                  Daftar gratis untuk belajar lebih jauh
                </Link>
              )}
            </div>
          </section>
          <Leaderboard limit={10} highlight={savedName} refreshKey={boardKey} />
        </div>
      )}
    </div>
  );
}
