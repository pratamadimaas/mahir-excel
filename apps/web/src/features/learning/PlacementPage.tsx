import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  evaluatePlacement,
  placementLevel,
  placementOrdered,
  placementProgress,
  placementQuestions,
  placementTierOf,
  PLACEMENT_TIERS,
  type PlacementResult,
} from '@excellab/shared';
import { useAuth } from '../../app/AuthContext';
import { Status } from '../../components/feedback/Feedback';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import { useModules } from '../../services/catalog';
import { getStorage } from '../../services/progressStore';
import { TOPIC_LABELS } from '../../services/types';

const KEY = 'excellab.placement.v1';

export interface SavedPlacement {
  answers: Record<string, number>;
  at: string;
}

export function loadPlacement(): SavedPlacement | null {
  try {
    const raw = getStorage()?.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedPlacement;
    if (!v || typeof v !== 'object' || typeof v.answers !== 'object' || v.answers === null) return null;
    const answers: Record<string, number> = {};
    for (const q of placementQuestions) {
      const a = (v.answers as Record<string, unknown>)[q.id];
      if (typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < q.options.length) answers[q.id] = a;
    }
    return { answers, at: typeof v.at === 'string' ? v.at : new Date(0).toISOString() };
  } catch {
    return null;
  }
}

function savePlacement(p: SavedPlacement): void {
  try {
    getStorage()?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* mode privat: hasil hanya tampil di halaman ini */
  }
}

export function clearPlacement(): void {
  try {
    getStorage()?.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

/** Hasil dari jawaban yang tuntas menurut alur tes; null bila tes belum selesai. */
export function resultFromAnswers(answers: Record<string, number>): PlacementResult | null {
  const { asked, next } = placementProgress(answers);
  return asked.length > 0 && !next ? evaluatePlacement(answers, asked) : null;
}

/** Ringkasan hasil tes yang tersimpan, dipakai banner di halaman Akademi. */
export function usePlacementResult(): PlacementResult | null {
  return useMemo(() => {
    const saved = loadPlacement();
    return saved ? resultFromAnswers(saved.answers) : null;
  }, []);
}

/** Teks yang dibagikan: hanya skor dan level, tanpa data pribadi. */
export function shareText(result: PlacementResult, url: string): string {
  return `Skor tes penempatan Excel saya ${result.score}/${result.total} (level ${placementLevel(result)}). Coba juga, gratis: ${url}`;
}

function ShareResult({ result }: { result: PlacementResult }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/tes-penempatan`;
  const text = shareText(result, url);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard tidak tersedia: tombol WhatsApp tetap bisa dipakai */
    }
  };

  return (
    <div className="xl-panel xl-panel-body my-3" aria-label="Bagikan hasil">
      <p className="mb-2">Ajak temanmu mencoba juga.</p>
      <div className="d-flex flex-wrap gap-2">
        <a
          className="btn btn-success btn-sm"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Bagikan ke WhatsApp
        </a>
        {canShare && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => void navigator.share({ text, url }).catch(() => undefined)}
          >
            Bagikan…
          </button>
        )}
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void copy()}>
          {copied ? 'Tersalin' : 'Salin teks'}
        </button>
      </div>
      <p className="xl-small xl-muted mt-2 mb-0">Yang dibagikan hanya skor dan level, tanpa namamu.</p>
    </div>
  );
}

const LEVEL_NOTE: Record<string, string> = {
  Pemula: 'Dasar-dasarnya masih perlu dikuatkan dulu. Tenang, justru di sini awal yang paling enak untuk belajar.',
  Menengah: 'Dasarmu sudah kuat. Selanjutnya fungsi logika, bersyarat, dan pencarian yang paling berguna untuk kerjaan.',
  Mahir: 'Dasar dan fungsi menengahmu sudah kuat. Tinggal mengasah teks, tanggal, dan merapikan data.',
};

/** Penanda tiga tingkat di atas soal: yang sudah dilewati, yang sedang dikerjakan, dan yang menunggu. */
function TierSteps({ current, done }: { current: string | null; done: Set<string> }) {
  return (
    <ol className="xl-pt-tiers" aria-label="Tingkat tes">
      {PLACEMENT_TIERS.map((t) => {
        const state = done.has(t.level) ? 'done' : t.level === current ? 'now' : 'wait';
        return (
          <li key={t.level} className={`xl-pt-tier ${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="xl-pt-dot" aria-hidden="true">
              {state === 'done' ? '✓' : ''}
            </span>
            {t.level}
          </li>
        );
      })}
    </ol>
  );
}

export function PlacementPage() {
  useDocumentTitle('Tes penempatan');
  const { modules } = useModules();
  const { user } = useAuth();
  const [saved, setSaved] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const progress = placementProgress(answers);
  const current = progress.next;
  const tier = current ? placementTierOf(current.module) : null;
  const tierQuestions = tier ? placementOrdered.filter((q) => placementTierOf(q.module) === tier) : [];
  const posInTier = current ? tierQuestions.findIndex((q) => q.id === current.id) + 1 : 0;
  const doneTiers = new Set<string>();
  for (const t of PLACEMENT_TIERS) {
    const qs = placementOrdered.filter((q) => placementTierOf(q.module) === t.level);
    if (qs.length > 0 && qs.every((q) => answers[q.id] !== undefined)) doneTiers.add(t.level);
  }

  const advance = (): void => {
    if (!current || pending === null) return;
    const nextAnswers = { ...answers, [current.id]: pending };
    const after = placementProgress(nextAnswers);
    setPending(null);
    if (after.next) {
      setAnswers(nextAnswers);
      return;
    }
    // Tes selesai: simpan hanya jawaban yang termasuk alur tes.
    const clean = Object.fromEntries(after.asked.map((q) => [q.id, nextAnswers[q.id]!]));
    setAnswers(clean);
    savePlacement({ answers: clean, at: new Date().toISOString() });
    setResult(evaluatePlacement(clean, after.asked));
    setSaved('idle');
    // Skor disimpan di server (tanpa nama/IP bila tidak masuk); hasil tetap tampil walau penyimpanan gagal.
    api
      .post('/placement', { answers: clean })
      .then(() => setSaved('ok'))
      .catch(() => setSaved('fail'));
    window.scrollTo?.({ top: 0 });
  };

  const back = (): void => {
    const last = progress.asked[progress.asked.length - 1];
    if (!last) return;
    setAnswers((a) => {
      const rest = { ...a };
      delete rest[last.id];
      return rest;
    });
    setPending(answers[last.id] ?? null);
  };

  const startModule = result?.startModule ? modules?.find((m) => m.slug === result.startModule) : null;
  const missed = result ? placementQuestions.filter((q) => result.missed.includes(q.id)) : [];

  return (
    <div className="xl-page xl-page-narrow">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Tes penempatan</p>
        <h1>Mulai dari mana?</h1>
        <p>
          Jawab satu per satu, paling banyak {placementQuestions.length} pertanyaan (sekitar 4 menit). Soal naik bertahap dari Pemula sampai Mahir, dan tes
          berhenti lebih awal kalau soal berikutnya sudah terlalu jauh. Santai saja, ini bukan ujian dan tidak ada nilai resmi.
        </p>
        <p className="xl-small xl-muted">Tanpa perlu akun. Hasilnya dicatat tanpa nama supaya kami bisa membuat materi yang lebih pas.</p>
      </header>

      {result ? (
        <section aria-labelledby="hasil" aria-live="polite">
          <div className="xl-pt-level">
            <p className="xl-eyebrow mb-1">Level kamu</p>
            <h2 id="hasil" className="mb-1">
              {result.level}
            </h2>
            <p className="mb-2">{LEVEL_NOTE[result.level]}</p>
            <p className="xl-small xl-muted mb-0">
              Skormu {result.score} dari {result.total} pertanyaan yang kamu jawab.
            </p>
          </div>
          <ul className="xl-pt-summary" aria-label="Hasil per tingkat">
            {PLACEMENT_TIERS.map((t) => {
              const r = result.tiers.find((x) => x.level === t.level);
              return (
                <li key={t.level} className={r ? (r.passed ? 'ok' : 'no') : 'skip'}>
                  <strong>{t.level}</strong>
                  <span>{r ? `${r.correct}/${r.total} benar, ${r.passed ? 'lulus' : 'belum lulus'}` : 'tidak diuji'}</span>
                </li>
              );
            })}
          </ul>
          <ShareResult result={result} />
          {saved === 'ok' && (
            <p className="xl-small xl-muted" role="status">
              Skormu sudah tersimpan.
            </p>
          )}
          {saved === 'fail' && (
            <p className="xl-small xl-muted" role="status">
              Skormu belum berhasil dicatat, tetapi hasil di bawah tetap berlaku.
            </p>
          )}
          {!user && (
            <Status tone="info">
              <strong>Mau mulai belajar?</strong> Materi, latihan, shortcut, dan worksheet tersedia gratis setelah kamu masuk.
              <div className="mt-2 d-flex flex-wrap gap-2">
                <Link className="btn btn-primary btn-sm" to="/daftar">
                  Daftar gratis
                </Link>
                <Link className="btn btn-outline-secondary btn-sm" to="/masuk">
                  Masuk
                </Link>
              </div>
            </Status>
          )}
          {result.startModule === null ? (
            <Status tone="success">
              <strong>Semua jawaban benar.</strong> Kamu siap langsung ke modul lanjutan. Coba{' '}
              <Link to="/belajar">proyek akhir tiap modul</Link> atau <Link to="/tantangan">tantangan harian</Link>.
            </Status>
          ) : (
            <Status tone="info">
              <strong>Saran: mulai dari modul “{TOPIC_LABELS[result.startModule] ?? startModule?.title ?? result.startModule}”.</strong>{' '}
              Modul sebelumnya sudah kamu kuasai berdasarkan tes ini; kamu tetap boleh membukanya untuk mengulang.
              {startModule?.lessons[0] && (
                <div className="mt-2">
                  <Link className="btn btn-primary btn-sm" to={`/belajar/${startModule.lessons[0].slug}`}>
                    Mulai: {startModule.lessons[0].title}
                  </Link>
                </div>
              )}
            </Status>
          )}

          <h3 className="mt-4">Per modul</h3>
          <ul className="xl-module-summary">
            {result.perModule.map((m) => (
              <li key={m.module}>
                <span>{TOPIC_LABELS[m.module] ?? modules?.find((x) => x.slug === m.module)?.title ?? m.module}</span>
                <span className={m.correct === m.total ? 'text-success fw-semibold' : 'xl-muted'}>
                  {m.correct}/{m.total} {m.correct === m.total ? '(dikuasai)' : '(perlu latihan)'}
                </span>
              </li>
            ))}
          </ul>

          {missed.length > 0 && (
            <>
              <h3 className="mt-4">Pembahasan jawaban yang belum tepat</h3>
              <ul className="xl-review">
                {missed.map((q) => (
                  <li key={q.id}>
                    <strong>{q.question}</strong>
                    <div className="xl-small">Jawaban benar: {q.options[q.answerIndex]}</div>
                    <div className="xl-small xl-muted">{q.explanation}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary mt-3"
            onClick={() => {
              setResult(null);
              setAnswers({});
              setPending(null);
            }}
          >
            Ulangi tes
          </button>
        </section>
      ) : (
        current && (
          <form
            aria-label="Tes penempatan"
            onSubmit={(e) => {
              e.preventDefault();
              advance();
            }}
          >
            <TierSteps current={tier} done={doneTiers} />
            <p className="xl-small xl-muted mb-2" role="status">
              {tier}: soal {posInTier} dari {tierQuestions.length}
            </p>
            <div className="xl-progress mb-3" aria-hidden="true">
              <span style={{ width: `${(progress.asked.length / placementQuestions.length) * 100}%` }} />
            </div>
            <fieldset key={current.id} className="xl-quiz">
              <legend className="h5">{current.question}</legend>
              {current.options.map((o, oi) => (
                <div className="form-check" key={oi}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name={current.id}
                    id={`${current.id}-${oi}`}
                    checked={pending === oi}
                    onChange={() => setPending(oi)}
                  />
                  <label className="form-check-label" htmlFor={`${current.id}-${oi}`}>
                    {o}
                  </label>
                </div>
              ))}
            </fieldset>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={back} disabled={progress.asked.length === 0}>
                Kembali
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending === null}>
                {pending !== null && !placementProgress({ ...answers, [current.id]: pending }).next ? 'Lihat hasil' : 'Lanjut'}
              </button>
            </div>
          </form>
        )
      )}
    </div>
  );
}

/** Ajakan tes penempatan, atau ringkasan hasilnya bila sudah pernah mengikuti. */
export function PlacementBanner() {
  const result = usePlacementResult();
  const { modules } = useModules();
  const title = result?.startModule
    ? (modules?.find((m) => m.slug === result.startModule)?.title ?? TOPIC_LABELS[result.startModule])
    : null;
  return (
    <p className="xl-small mt-3 mb-0">
      {result ? (
        <>
          Level tesmu: {result.level}.{' '}
          {result.startModule === null ? 'Siap ke modul lanjutan.' : `Saran mulai dari modul “${title}”.`}{' '}
          <Link to="/tes-penempatan">Ulangi tes</Link>
        </>
      ) : (
        <>
          Belum yakin mulai dari mana? <Link to="/tes-penempatan">Ikuti tes penempatan (sekitar 4 menit)</Link>.
        </>
      )}
    </p>
  );
}
