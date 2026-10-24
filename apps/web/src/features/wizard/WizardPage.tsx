import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Sheet, formatValue, isError, traceFormula } from '@excellab/spreadsheet-engine';
import { useAuth } from '../../app/AuthContext';
import { PremiumLock } from '../../components/learning/PremiumLock';
import { FormulaDebugger } from '../../components/spreadsheet/FormulaDebugger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { GOALS, SAMPLE_CELLS, SAMPLE_TABLE, defaultsOf, validateFields, type WizardGoal } from './goals';

const sampleSheet = new Sheet(SAMPLE_CELLS);

export function WizardPage() {
  useDocumentTitle('Wizard rumus');
  const { user } = useAuth();
  const premium = !!user?.premium;
  const [goalId, setGoalId] = useState(GOALS[0]!.id);
  const goal = GOALS.find((g) => g.id === goalId)!;
  const [values, setValues] = useState<Record<string, string>>(() => defaultsOf(goal));
  const [copied, setCopied] = useState(false);

  const choose = (g: WizardGoal): void => {
    setGoalId(g.id);
    setValues(defaultsOf(g));
    setCopied(false);
  };

  const problem = validateFields(goal, values);
  const formula = problem ? null : goal.build(values);
  const open = goal.free || premium;
  const outcome = useMemo(() => (formula ? traceFormula(formula, sampleSheet).result : null), [formula]);

  const copy = async (): Promise<void> => {
    if (!formula) return;
    try {
      await navigator.clipboard.writeText(formula);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Alat bantu</p>
        <h1>Wizard rumus</h1>
        <p>
          Pilih apa yang mau kamu lakukan, isi alamat selnya, dan dapatkan rumus lengkap beserta penjelasannya. Hasilnya dicoba dulu pada tabel contoh di bawah;
          ganti alamat sel dengan alamat datamu sendiri.
        </p>
      </header>

      <section aria-labelledby="wz-sample" className="mb-4">
        <h2 id="wz-sample" className="h6">
          Tabel contoh
        </h2>
        <div className="xl-table-wrap">
          <table className="xl-table">
            <caption className="visually-hidden">Tabel contoh untuk mencoba rumus, kolom A sampai D, baris 1 sampai 9</caption>
            <thead>
              <tr>
                <th scope="col" aria-label="Nomor baris" />
                {['A', 'B', 'C', 'D'].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_TABLE.map((row, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  {row.map((cell, j) => (
                    <td key={j}>{cell.startsWith('=') ? formatValue(sampleSheet.getValue(`${'ABCD'[j]}${i + 1}`) as number) : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="row g-4">
        <div className="col-lg-5">
          <h2 className="h6" id="wz-goals">
            Apa yang mau kamu lakukan?
          </h2>
          <div className="xl-wizard-grid" role="group" aria-labelledby="wz-goals">
            {GOALS.map((g) => (
              <button key={g.id} type="button" className="xl-wizard-goal" aria-pressed={g.id === goalId} onClick={() => choose(g)}>
                <strong className="d-block">{g.title}</strong>
                <span className="xl-small xl-muted">{g.hint}</span>
                {!g.free && !premium && <span className="xl-chip premium ms-1">Premium</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="col-lg-7">
          <h2 className="h6">{goal.title}</h2>
          {!open ? (
            <PremiumLock title="Rumus ini khusus Premium">
              Wizard untuk SUM, AVERAGE, MAX, MIN, dan COUNT gratis. Tujuan lain (syarat, pencarian, IF, teks, pembulatan) terbuka untuk anggota Premium.
            </PremiumLock>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} aria-label={`Isian untuk ${goal.title}`}>
              {goal.fields.map((f) => (
                <div className="mb-3" key={`${goal.id}-${f.key}`}>
                  <label className="form-label" htmlFor={`wz-${f.key}`}>
                    {f.label}
                  </label>
                  {f.kind === 'choice' ? (
                    <select id={`wz-${f.key}`} className="form-select" value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                      {f.options!.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`wz-${f.key}`}
                      className="form-control"
                      value={values[f.key] ?? ''}
                      spellCheck={false}
                      autoComplete="off"
                      inputMode={f.kind === 'number' ? 'decimal' : undefined}
                      aria-describedby={f.help ? `wz-${f.key}-h` : undefined}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    />
                  )}
                  {f.help && (
                    <div id={`wz-${f.key}-h`} className="form-text">
                      {f.help}
                    </div>
                  )}
                </div>
              ))}
            </form>
          )}

          {open && (
            <div aria-live="polite">
              {problem ? (
                <p className="text-danger mb-0" role="status">
                  {problem}
                </p>
              ) : (
                formula && (
                  <>
                    <div className="xl-wizard-result" data-testid="wizard-formula">
                      {formula}
                    </div>
                    <div className="d-flex gap-2 align-items-center flex-wrap mt-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
                        {copied ? <Check className="xl-icon" aria-hidden="true" /> : <Copy className="xl-icon" aria-hidden="true" />} {copied ? 'Tersalin' : 'Salin rumus'}
                      </button>
                      <span className="xl-small" data-testid="wizard-outcome">
                        Hasil pada tabel contoh: <strong>{isError(outcome) ? `${outcome.code} (alamat selnya belum cocok dengan tabel contoh)` : outcome === null ? '(kosong)' : typeof outcome === 'number' ? formatValue(outcome) : String(outcome)}</strong>
                      </span>
                    </div>
                    <h3 className="h6 mt-3">Cara kerjanya</h3>
                    <ul>
                      {goal.explain(values).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                    <p className="xl-small xl-muted">
                      Tulis rumus ini di sel hasil. Pemisah argumen di Excel Indonesia kadang titik koma (;), ganti koma menjadi titik koma bila Excel-mu meminta begitu.
                    </p>
                    <FormulaDebugger raw={formula} sheet={sampleSheet} premium={premium} />
                  </>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
