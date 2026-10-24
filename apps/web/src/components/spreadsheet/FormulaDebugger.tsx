import { useMemo, useState } from 'react';
import { ChevronsRight, RotateCcw, StepForward } from 'lucide-react';
import { type Sheet, isError, traceFormula } from '@excellab/spreadsheet-engine';
import { PremiumLock } from '../learning/PremiumLock';

interface Props {
  /** Isi mentah sel terpilih; hanya rumus (diawali "=") yang bisa ditelusuri. */
  raw: string;
  sheet: Sheet;
  premium: boolean;
}

/** Penelusur rumus langkah demi langkah, seperti "Evaluate Formula" di Excel. */
export function FormulaDebugger({ raw, sheet, premium }: Props) {
  const isFormulaRaw = raw.trimStart().startsWith('=');
  if (!isFormulaRaw) return null;
  return (
    <details className="xl-panel mt-3 xl-debugger">
      <summary className="xl-panel-head" style={{ cursor: 'pointer' }}>
        Telusuri rumus langkah demi langkah
      </summary>
      <div className="xl-panel-body">
        {premium ? (
          <Steps key={raw} raw={raw} sheet={sheet} />
        ) : (
          <PremiumLock title="Lihat rumusmu dihitung pelan-pelan">
            Penelusur menampilkan tiap bagian rumus diganti nilainya sampai ketemu hasil akhir, jadi kamu bisa menemukan bagian mana yang salah.
          </PremiumLock>
        )}
      </div>
    </details>
  );
}

function Steps({ raw, sheet }: { raw: string; sheet: Sheet }) {
  const trace = useMemo(() => traceFormula(raw, sheet), [raw, sheet]);
  const [shown, setShown] = useState(0);
  const total = trace.steps.length;
  const finished = shown >= total;

  if (trace.parseError) {
    return (
      <p className="mb-0" role="status">
        <strong>{trace.parseError.code}</strong> Rumus ini belum bisa ditelusuri karena belum bisa dibaca: {trace.parseError.message}
      </p>
    );
  }

  return (
    <div>
      <p className="xl-small xl-muted mb-2">
        Bagian bergaris bawah dihitung dulu, lalu diganti nilainya. Tekan “Langkah berikutnya” untuk melanjutkan.
      </p>
      <ol className="xl-trace" aria-label="Langkah penelusuran">
        <li>
          <code className="xl-trace-expr">={trace.start}</code>
          <span className="xl-muted xl-small"> rumus awal</span>
        </li>
        {trace.steps.slice(0, shown).map((s, i) => (
          <li key={i} className={s.isError ? 'err' : undefined}>
            <code className="xl-trace-expr">
              ={s.before.pre}
              <u>{s.before.target}</u>
              {s.before.post}
            </code>
            <div className="xl-small">
              <span aria-hidden="true">→</span> <code>{s.value}</code> <span className="xl-muted">{s.note}</span>
            </div>
          </li>
        ))}
      </ol>
      {finished && (
        <p className="mb-2" role="status">
          <strong>Hasil akhir:</strong>{' '}
          <code>{isError(trace.result) ? trace.result.code : trace.result === null ? '(kosong)' : String(trace.result)}</code>
          {isError(trace.result) && <span className="xl-muted"> {trace.result.message}</span>}
        </p>
      )}
      <div className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShown((n) => Math.min(total, n + 1))} disabled={finished}>
          <StepForward className="xl-icon" aria-hidden="true" /> Langkah berikutnya ({Math.min(shown + 1, total)}/{total})
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShown(total)} disabled={finished}>
          <ChevronsRight className="xl-icon" aria-hidden="true" /> Tampilkan semua
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShown(0)} disabled={shown === 0}>
          <RotateCcw className="xl-icon" aria-hidden="true" /> Ulangi
        </button>
      </div>
    </div>
  );
}
