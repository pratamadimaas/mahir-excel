import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CircleCheck, CircleX, Lock, Minus, Upload } from 'lucide-react';
import { Status } from '../../components/feedback/Feedback';
import { useAuth } from '../../app/AuthContext';
import { api, errorMessage } from '../../services/api';
import type { CheckItem, CheckResult, CheckVerdict, DatasetCheckResponse, WorksheetCheckResponse } from '../../services/types';
import { readDatasetAnswers, readWorksheetCells } from './answers';

const VERDICT: Record<CheckVerdict, { text: string; tone: 'ok' | 'bad' | 'idle' }> = {
  benar: { text: 'Benar', tone: 'ok' },
  salah: { text: 'Belum tepat', tone: 'bad' },
  kosong: { text: 'Belum diisi', tone: 'idle' },
  'tanpa-rumus': { text: 'Nilainya cocok, tapi belum memakai rumus', tone: 'bad' },
};

const show = (v: number | string): string => (typeof v === 'number' ? v.toLocaleString('id-ID') : v);

function Item({ item }: { item: CheckItem }) {
  const v = VERDICT[item.verdict];
  return (
    <li className={`xl-check-item ${v.tone}`}>
      {v.tone === 'ok' ? (
        <CircleCheck className="xl-icon" aria-hidden="true" />
      ) : v.tone === 'bad' ? (
        <CircleX className="xl-icon" aria-hidden="true" />
      ) : (
        <Minus className="xl-icon" aria-hidden="true" />
      )}
      <div>
        <strong>{item.label}</strong>
        <div className="xl-small">
          {v.text}
          {item.verdict === 'salah' && item.expected !== undefined && (
            <>
              . Seharusnya <code>{show(item.expected)}</code>
            </>
          )}
        </div>
        {item.hint && <div className="xl-check-hint xl-small">{item.hint}</div>}
      </div>
    </li>
  );
}

export function toDatasetView(r: DatasetCheckResponse, title: string | undefined): CheckResult {
  return {
    title,
    total: r.total,
    correct: r.correct,
    items: r.items.map((i) => ({
      label: `Tugas ${i.no}: ${i.ask.split(/(?<=[.?])\s/)[0]}`,
      verdict: i.verdict,
      hint: i.hint,
      expected: i.expected,
    })),
  };
}

export function toWorksheetView(r: WorksheetCheckResponse): CheckResult {
  return {
    total: r.total,
    correct: r.correct,
    items: r.items.map((i) => ({
      label: `Sel ${i.ref}${i.sheet === 'Latihan' ? '' : ` (${i.sheet})`}`,
      verdict: i.verdict,
      hint: i.hint,
      expected: i.expected,
    })),
  };
}

/** Unggah berkas hasil, periksa lewat server. Hanya Premium; berkas dibaca di browser, server hanya menerima nilai selnya. */
export function CheckPanel({ run, intro }: { run: (file: File) => Promise<CheckResult>; intro: string }) {
  const { user } = useAuth();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [name, setName] = useState('');

  if (!user) {
    return (
      <Status tone="info">
        <Link to="/masuk">Masuk</Link> dulu untuk memeriksa hasilmu. Pemeriksaan khusus anggota Premium.
      </Status>
    );
  }
  if (!user.premium) {
    return (
      <div className="xl-check-lock">
        <Lock className="xl-icon" aria-hidden="true" />
        <div>
          <strong>Pemeriksaan hasil khusus Premium</strong>
          <p className="xl-small xl-muted mb-2">{intro}</p>
          <Link className="btn btn-primary btn-sm" to="/premium">
            Lihat Premium
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (): Promise<void> => {
    const file = input.current?.files?.[0];
    if (!file) {
      setError('Pilih berkas .xlsx hasil kerjamu dulu.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await run(file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="xl-check">
      <p className="xl-muted">{intro}</p>
      <div className="xl-check-form">
        <label htmlFor={inputId} className="form-label">
          Berkas hasil kerjamu (.xlsx, maksimal 5 MB)
        </label>
        <input
          id={inputId}
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="form-control"
          onChange={(e) => setName(e.target.files?.[0]?.name ?? '')}
        />
        <button type="button" className="btn btn-primary mt-2" onClick={submit} disabled={busy}>
          <Upload className="xl-icon" aria-hidden="true" /> {busy ? 'Memeriksa…' : 'Periksa hasilku'}
        </button>
        {name && !busy && <span className="xl-small xl-muted ms-2">{name}</span>}
      </div>
      {error && <Status tone="error">{error}</Status>}
      {result && (
        <section aria-live="polite" className="xl-check-result" aria-label="Hasil pemeriksaan">
          <h3 className="h6">Hasil pemeriksaan{result.title ? `: ${result.title}` : ''}</h3>
          <p className="xl-muted xl-small">
            {result.correct} dari {result.total} benar.
          </p>
          <ul className="xl-check-list">
            {result.items.map((i) => (
              <Item key={i.label} item={i} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export async function checkDatasetFile(file: File, titleOf: (slug: string) => string | undefined): Promise<CheckResult> {
  const { slug, answers } = await readDatasetAnswers(file);
  const res = await api.post<DatasetCheckResponse>(`/datasets/${encodeURIComponent(slug)}/check`, { answers });
  return toDatasetView(res, titleOf(slug));
}

export async function checkWorksheetFile(file: File, slug: string, cells: { sheet: string; ref: string }[]): Promise<CheckResult> {
  const given = await readWorksheetCells(file, cells);
  const res = await api.post<WorksheetCheckResponse>(`/worksheets/${encodeURIComponent(slug)}/check`, { cells: given });
  return toWorksheetView(res);
}
