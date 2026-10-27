import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightToLine,
  Eye,
  FileSpreadsheet,
  Funnel,
  Lightbulb,
  RotateCcw,
  Send,
  Upload,
} from 'lucide-react';
import { FUNCTION_NAMES, addrToRef, expandRef, indexToCol, isFormula, parseCellRef, shiftFormula } from '@excellab/spreadsheet-engine';
import { useAuth } from '../../app/AuthContext';
import { useProgress } from '../../app/ProgressContext';
import { useAsync } from '../../hooks/useAsync';
import { api, errorMessage } from '../../services/api';
import {
  DIFFICULTY_LABELS,
  TOPIC_LABELS,
  type PublicExercise,
  type RevealResult,
  type SolutionQuota,
  type SubmitResult,
} from '../../services/types';
import { ConfirmDialog, Status } from '../feedback/Feedback';
import { Level } from '../learning/Bits';
import { ReportExercise } from '../learning/ReportExercise';
import { AnswerCompare } from './AnswerCompare';
import { DataTools } from './DataTools';
import { currentRegion, distinctTexts, hiddenByFilters, parseDataRange } from './dataOps';
import { FilterMenu } from './FilterMenu';
import { FormulaDebugger } from './FormulaDebugger';
import { HowToPanel } from './HowToPanel';
import { AnswerFileError, buildExerciseFile, readAnswerFile } from './excelFile';
import { cycleAbsolute } from './pointMode';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { expandAll, referencedCells, useSheetModel } from './useSheetModel';

interface Props {
  exercise: PublicExercise;
  /** Tampilkan panduan dua cara mengerjakan (isi langsung atau lewat Excel). Bawaan: tampil. */
  guide?: boolean;
  nextSlug?: string | null;
  /** Tambahkan ?preview=1 untuk pratinjau admin. */
  preview?: boolean;
}

const SUPPORTED = [...FUNCTION_NAMES].sort();

const dateLong = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' });

export function ExerciseWorkspace({ exercise, nextSlug, preview, guide = true }: Props) {
  const { recordSubmission, progress } = useProgress();
  const { user } = useAuth();
  const premium = !!user?.premium;
  // Akun gratis mendapat cicipan: satu solusi langsung setiap 7 hari. Solusi yang pernah dibuka bisa dibuka lagi.
  const quota = useAsync(
    (s) => (user && !user.premium ? api.get<SolutionQuota>('/solution-quota', s) : Promise.resolve(null)),
    [user?.id, user?.premium],
  );
  const unlockedHere = !!quota.data?.unlocked.includes(exercise.slug);
  const quotaOpen = !!quota.data?.available;
  const canReveal = premium || unlockedHere || quotaOpen;
  const nextFree = quota.data?.nextFreeAt ?? null;
  const editable = useMemo(() => expandAll(exercise.editable), [exercise.editable]);
  const targets = useMemo(() => new Set(exercise.targetCells), [exercise.targetCells]);
  const [cells, setCells] = useState<Record<string, string>>(exercise.cells);
  const [selected, setSelected] = useState<string>(exercise.targetCells[0] ?? [...editable][0] ?? 'A1');
  const [hintCount, setHintCount] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [awarded, setAwarded] = useState(0);
  const [revealed, setRevealed] = useState<RevealResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<Set<number> | null>(null);
  // Filter daftar centang: indeks kolom mutlak -> nilai yang boleh tampil.
  const [colFilters, setColFilters] = useState<Record<number, string[]>>({});
  const [openFilter, setOpenFilter] = useState<{ col: number; anchor: HTMLElement } | null>(null);
  const tableRange = useMemo(
    () =>
      exercise.tools?.filter ? parseDataRange(exercise.tools.filter.range) : currentRegion(exercise.cells, exercise.rows, exercise.cols),
    [exercise],
  );
  const [filterOn, setFilterOn] = useState(!!exercise.tools?.filter);
  const barRef = useRef<HTMLInputElement>(null);
  const [barActive, setBarActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelNote, setExcelNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const { sheet, getDisplay, getRaw } = useSheetModel(cells, hiddenRows);
  const raw = getRaw(selected);
  const selDisplay = getDisplay(selected);
  const highlights = useMemo(() => referencedCells(raw), [raw]);
  const canEdit = editable.has(selected);
  const done = !!progress.completedExercises[exercise.slug];
  const hintsLeft = exercise.hints.length - hintCount;
  const q = preview ? '?preview=1' : '';

  const setCell = (ref: string, value: string): void => {
    setNotice(null);
    setCells((prev) => {
      const next = { ...prev };
      if (value === '') delete next[ref];
      else next[ref] = value;
      return next;
    });
  };

  const submit = async (source: Record<string, string> = cells): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      for (const e of exercise.editable) for (const ref of expandRef(e)) body[ref] = source[ref] ?? '';
      const res = await api.post<SubmitResult>(`/exercises/${exercise.slug}/submit${q}`, { cells: body });
      setResult(res);
      setAwarded(await recordSubmission(exercise.slug, exercise.points, res));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (): Promise<void> => {
    setConfirmReveal(false);
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<RevealResult>(`/exercises/${exercise.slug}/reveal${q}`);
      setRevealed(res);
      if (res.free) quota.reload();
    } catch (e) {
      setError(errorMessage(e));
      quota.reload();
    } finally {
      setBusy(false);
    }
  };

  // --- isi otomatis (fill handle, Ctrl+D/R, tombol Isi ke bawah/kanan) ---
  const fillLine = (from: string, to: string): void => {
    const a = parseCellRef(from);
    const b = parseCellRef(to);
    if (!a || !b) return;
    const src = getRaw(from);
    if (src === '') return;
    const vertical = a.col === b.col;
    const step = vertical ? Math.sign(b.row - a.row) : Math.sign(b.col - a.col);
    const len = vertical ? Math.abs(b.row - a.row) : Math.abs(b.col - a.col);
    let skipped = 0;
    const next = { ...cells };
    for (let i = 1; i <= len; i++) {
      const dc = vertical ? 0 : step * i;
      const dr = vertical ? step * i : 0;
      const ref = addrToRef({ col: a.col + dc, row: a.row + dr });
      if (!editable.has(ref)) {
        skipped++;
        continue;
      }
      next[ref] = shiftFormula(src, dc, dr);
    }
    setCells(next);
    setNotice(skipped ? `${skipped} sel dilewati karena bagian dari soal dan tidak dapat diisi.` : null);
  };

  const fillFromNeighbour = (kind: 'from-above' | 'from-left'): void => {
    const a = parseCellRef(selected);
    if (!a) return;
    if (!canEdit) return setNotice('Sel ini adalah data soal dan tidak dapat diisi.');
    const from = kind === 'from-above' ? { col: a.col, row: a.row - 1 } : { col: a.col - 1, row: a.row };
    if (from.col < 0 || from.row < 0) return setNotice('Tidak ada sel di atas/kiri untuk disalin.');
    fillLine(addrToRef(from), selected);
  };

  const fillRun = (dir: 'down' | 'right'): void => {
    const a = parseCellRef(selected);
    if (!a || getRaw(selected) === '') return;
    let end = { ...a };
    for (;;) {
      const nxt = dir === 'down' ? { col: end.col, row: end.row + 1 } : { col: end.col + 1, row: end.row };
      if (nxt.row >= exercise.rows || nxt.col >= exercise.cols || !editable.has(addrToRef(nxt))) break;
      end = nxt;
    }
    if (end.col === a.col && end.row === a.row) return setNotice('Tidak ada sel kosong yang boleh diisi di arah itu.');
    fillLine(selected, addrToRef(end));
  };

  // --- mode Excel: unduh berkas soal, kerjakan di Excel, unggah untuk dinilai ---
  const downloadExcel = async (): Promise<void> => {
    setExcelBusy(true);
    try {
      const bytes = await buildExerciseFile(exercise);
      const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `mahir-excel-${exercise.slug}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExcelNote({
        tone: 'info',
        text: 'File terunduh. Buka di Excel (klik Enable Editing kalau diminta), isi sel hijau, simpan, lalu klik “Unggah jawaban” di sini.',
      });
    } catch {
      setExcelNote({ tone: 'error', text: 'Gagal membuat file Excel. Coba lagi, atau kerjakan langsung di sini.' });
    } finally {
      setExcelBusy(false);
    }
  };

  const uploadExcel = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = ''; // supaya file yang sama bisa dipilih lagi
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setExcelNote({ tone: 'error', text: 'Pilih file berformat .xlsx, yaitu file yang diunduh dari halaman ini.' });
      return;
    }
    setExcelBusy(true);
    setExcelNote(null);
    try {
      const parsed = await readAnswerFile(file, exercise);
      const next = { ...exercise.cells };
      for (const [ref, raw] of Object.entries(parsed.answers)) if (raw !== '') next[ref] = raw;
      clearFilters();
      setCells(next);
      setResult(null);
      setNotice(null);
      const notes: string[] = [];
      if (parsed.otherExercise) notes.push(`File ini dibuat untuk latihan lain (${parsed.otherExercise}); hasilnya mungkin tidak cocok.`);
      if (parsed.changed.length) {
        const shown = parsed.changed.slice(0, 6).join(', ');
        notes.push(
          `Data soal di ${shown}${parsed.changed.length > 6 ? ' dan lainnya' : ''} berbeda dari aslinya. Penilaian memakai data asli.`,
        );
      }
      setExcelNote(notes.length ? { tone: 'info', text: notes.join(' ') } : null);
      await submit(next);
    } catch (err) {
      setExcelNote({
        tone: 'error',
        text:
          err instanceof AnswerFileError ? err.message : 'Berkas tidak bisa dibaca. Simpan ulang dari Excel sebagai .xlsx lalu coba lagi.',
      });
    } finally {
      setExcelBusy(false);
    }
  };

  const clearFilters = (): void => {
    setColFilters({});
    setHiddenRows(null);
    setOpenFilter(null);
  };

  const applyFilter = (col: number, next: Set<string> | null): void => {
    if (!tableRange) return;
    const all = { ...colFilters };
    if (next === null) delete all[col];
    else all[col] = [...next];
    setColFilters(all);
    const map = new Map(Object.entries(all).map(([c, v]) => [Number(c), new Set(v)]));
    setHiddenRows(map.size === 0 ? null : hiddenByFilters(tableRange, map, (ref) => getDisplay(ref).text));
    setOpenFilter(null);
  };

  const toggleFilter = (): void => {
    if (filterOn) clearFilters();
    setFilterOn(!filterOn);
  };

  const reset = (): void => {
    clearFilters();
    setFilterOn(!!exercise.tools?.filter);
    setCells(exercise.cells);
    setResult(null);
    setNotice(null);
    setError(null);
    setSelected(exercise.targetCells[0] ?? 'A1');
  };

  const onBarKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      // Selesai mengetik: simpan dan pindah ke sel di bawahnya, seperti Excel.
      e.preventDefault();
      const a = parseCellRef(selected);
      const below = a && a.row + 1 < exercise.rows ? addrToRef({ col: a.col, row: a.row + 1 }) : selected;
      e.currentTarget.blur();
      setNotice(null);
      setSelected(below);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`td[data-ref="${below}"]`)?.focus());
      return;
    }
    if (e.key !== 'F4') return;
    e.preventDefault();
    const el = e.currentTarget;
    const r = cycleAbsolute(el.value, el.selectionStart ?? el.value.length);
    if (!r) return;
    setCell(selected, r.text);
    requestAnimationFrame(() => el.setSelectionRange(r.caret, r.caret));
  };

  const kindLabel = isFormula(raw) ? 'Rumus' : raw === '' ? 'Kosong' : selDisplay.kind === 'num' ? 'Angka' : 'Teks';
  const errDisplay = isFormula(raw) && selDisplay.kind === 'err' ? selDisplay : null;
  const solutionCells = result?.solution ?? revealed?.solution;
  const explanation = result?.explanation ?? revealed?.explanation;

  const focusGrid = (): void => {
    document.querySelector<HTMLElement>('.xl-grid td[tabindex="0"]')?.focus();
  };

  return (
    <>
      {guide && <HowToPanel mode="latihan" onHere={focusGrid} onDownload={downloadExcel} busy={busy || excelBusy} />}
      <div className="xl-playground">
        <aside aria-label="Instruksi latihan">
          <section className="xl-panel xl-task">
            <div className="xl-eyebrow">{TOPIC_LABELS[exercise.topic] ?? exercise.topic}</div>
            <h2>Tugas</h2>
            <p>{exercise.task}</p>
            <div className="d-flex flex-wrap align-items-center gap-3 xl-small xl-muted">
              <Level difficulty={exercise.difficulty} />
              <span>{exercise.points} poin</span>
              {done && <span className="text-success fw-semibold">Sudah selesai</span>}
            </div>
          </section>

          {hintCount > 0 && (
            <section className="xl-panel mt-3" aria-label="Petunjuk">
              <div className="xl-panel-head">
                <Lightbulb className="xl-icon" aria-hidden="true" /> Petunjuk
              </div>
              <ol className="xl-hints xl-panel-body mb-0 ps-4">
                {exercise.hints.slice(0, hintCount).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
            </section>
          )}

          <details className="xl-panel mt-3">
            <summary className="xl-panel-head" style={{ cursor: 'pointer' }}>
              Rumus yang didukung playground
            </summary>
            <div className="xl-panel-body xl-small">
              <p className="mb-2">
                {SUPPORTED.map((f) => (
                  <code key={f} className="me-1">
                    {f}
                  </code>
                ))}
              </p>
              <p className="mb-1">Pemisah argumen boleh koma (,) atau titik koma (;). Desimal di dalam rumus memakai titik (3.5).</p>
              <p className="mb-0 xl-muted">
                Playground adalah simulasi terbatas; perilakunya tidak identik dengan Microsoft Excel. Fungsi lain akan menampilkan galat
                #NAME?.
              </p>
            </div>
          </details>

          <FormulaDebugger raw={raw} sheet={sheet} premium={premium} />
        </aside>

        <div>
          <div className="xl-workspace">
            <div className="xl-toolbar" role="toolbar" aria-label="Aksi latihan">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy}>
                <Send className="xl-icon" aria-hidden="true" /> {busy ? 'Memeriksa…' : 'Periksa jawaban'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setHintCount((n) => Math.min(exercise.hints.length, n + 1))}
                disabled={hintsLeft <= 0}
              >
                <Lightbulb className="xl-icon" aria-hidden="true" /> Petunjuk ({hintCount}/{exercise.hints.length})
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={reset}>
                <RotateCcw className="xl-icon" aria-hidden="true" /> Reset
              </button>
              <span className="xl-toolbar-sep" aria-hidden="true" />
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => fillRun('down')}
                disabled={!canEdit || raw === ''}
                title="Salin isi sel terpilih ke sel di bawahnya yang boleh diisi. Referensi relatif ikut bergeser, seperti menyeret gagang isi otomatis."
              >
                <ArrowDownToLine className="xl-icon" aria-hidden="true" /> Isi ke bawah
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => fillRun('right')}
                disabled={!canEdit || raw === ''}
                title="Salin isi sel terpilih ke sel di kanannya yang boleh diisi."
              >
                <ArrowRightToLine className="xl-icon" aria-hidden="true" /> Isi ke kanan
              </button>
              {tableRange && (
                <button
                  type="button"
                  className={`btn btn-sm ${filterOn ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={toggleFilter}
                  aria-pressed={filterOn}
                  title="Tampilkan panah filter di judul kolom tabel, seperti Data > Filter di Excel."
                >
                  <Funnel className="xl-icon" aria-hidden="true" /> Filter
                </button>
              )}
              <span className="xl-toolbar-sep" aria-hidden="true" />
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={downloadExcel}
                disabled={busy || excelBusy}
                title="Unduh soal ini sebagai file .xlsx untuk dikerjakan di Microsoft Excel, lalu unggah kembali untuk dinilai."
              >
                <FileSpreadsheet className="xl-icon" aria-hidden="true" /> Kerjakan di Excel
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={busy || excelBusy}
                title="Pilih file .xlsx hasil pengerjaanmu di Excel. Isinya dinilai sama seperti jawaban di sini."
              >
                <Upload className="xl-icon" aria-hidden="true" /> Unggah jawaban
              </button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label="Pilih file jawaban .xlsx"
                onChange={uploadExcel}
              />
              <span className="xl-toolbar-spacer" />
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmReveal(true)} disabled={busy}>
                <Eye className="xl-icon" aria-hidden="true" />{' '}
                {!premium && !unlockedHere && quotaOpen ? 'Lihat solusi (gratis minggu ini)' : 'Lihat solusi'}
              </button>
            </div>

            {exercise.tools?.sort && (
              <DataTools
                tools={exercise.tools}
                cells={cells}
                valueOf={(ref) => sheet.getValue(ref)}
                headerText={(ref) => getDisplay(ref).text}
                onCells={(next) => {
                  clearFilters(); // baris berpindah, jadi filter lama tidak berlaku lagi
                  setCells(next);
                  setNotice(null);
                }}
                disabled={busy}
              />
            )}

            <div className="xl-formula-bar">
              <div className="xl-namebox" aria-label="Nama sel terpilih" data-testid="namebox">
                {selected}
              </div>
              <div className={`xl-fx${isFormula(raw) ? ' on' : ''}`} aria-hidden="true">
                fx
              </div>
              <input
                ref={barRef}
                className="xl-formula-input"
                aria-label={`Isi sel ${selected}`}
                value={raw}
                onFocus={() => setBarActive(true)}
                onBlur={() => setBarActive(false)}
                onKeyDown={onBarKey}
                disabled={!canEdit}
                spellCheck={false}
                autoComplete="off"
                placeholder={canEdit ? 'Ketik nilai atau rumus, mis. =SUM(B2:B6)' : 'Sel ini hanya baca'}
                onChange={(e) => setCell(selected, e.target.value)}
              />
              <div className="xl-kind" aria-label="Jenis isi sel">
                {kindLabel}
              </div>
            </div>
            <div className={`xl-formula-note ${errDisplay || notice ? 'err' : 'ok'}`} role="status" aria-live="polite">
              {notice ? (
                notice
              ) : errDisplay ? (
                <>
                  <strong>{errDisplay.text}</strong> {errDisplay.title}
                </>
              ) : canEdit ? (
                'Sel hijau muda boleh diisi. Tekan Enter atau ketik langsung. Setelah mengetik =, klik atau seret sel untuk memasukkan alamatnya, lalu tekan Enter untuk selesai. F4 mengunci ($). Ctrl+D menyalin dari sel di atas.'
              ) : (
                'Sel ini bagian dari soal dan tidak dapat diubah.'
              )}
            </div>

            {tableRange && filterOn && hiddenRows && (
              <div className="xl-filter-status px-2 py-1" role="status" aria-live="polite">
                {tableRange.bottom - tableRange.top - hiddenRows.size} dari {tableRange.bottom - tableRange.top} baris ditemukan.
              </div>
            )}
            <SpreadsheetGrid
              label={`Lembar kerja latihan: ${exercise.title}`}
              rows={exercise.rows}
              cols={exercise.cols}
              getRaw={getRaw}
              getDisplay={getDisplay}
              editable={editable}
              targets={targets}
              highlights={highlights}
              selected={selected}
              onSelect={(r) => {
                setSelected(r);
                setNotice(null);
              }}
              onChange={setCell}
              onReadOnlyAttempt={(r) => setNotice(`Sel ${r} adalah data soal dan tidak dapat diubah. Isi sel hijau muda.`)}
              disabled={busy}
              hiddenRows={hiddenRows ?? undefined}
              filtered={!!hiddenRows}
              onFill={fillFromNeighbour}
              onFillDrag={fillLine}
              barInput={barRef}
              barActive={barActive}
              filterHeader={
                tableRange && filterOn
                  ? {
                      topRow: tableRange.top,
                      cols: new Set(Array.from({ length: tableRange.right - tableRange.left + 1 }, (_, i) => tableRange.left + i)),
                      active: new Set(Object.keys(colFilters).map(Number)),
                      openCol: openFilter?.col ?? null,
                      onOpen: (col, anchor) => setOpenFilter((cur) => (cur?.col === col ? null : { col, anchor })),
                    }
                  : undefined
              }
            />
            {tableRange && filterOn && openFilter && (
              <FilterMenu
                anchor={openFilter.anchor}
                label={getDisplay(`${indexToCol(openFilter.col)}${tableRange.top}`).text || indexToCol(openFilter.col)}
                values={distinctTexts(tableRange, openFilter.col, (ref) => getDisplay(ref).text)}
                selected={colFilters[openFilter.col] ? new Set(colFilters[openFilter.col]) : null}
                onApply={(next) => applyFilter(openFilter.col, next)}
                onClose={() => setOpenFilter(null)}
              />
            )}
            <div className="xl-legend" aria-hidden="true">
              <span>
                <i className="xl-swatch edit" /> Boleh diisi
              </span>
              <span>
                <i className="xl-swatch ro" /> Data soal
              </span>
              <span>
                <i className="xl-swatch ref" /> Dirujuk rumus
              </span>
            </div>
          </div>

          <div className="mt-3" aria-live="polite" data-testid="feedback">
            {excelNote && (
              <div className="mb-2">
                <Status tone={excelNote.tone}>{excelNote.text}</Status>
              </div>
            )}
            {error && (
              <Status tone="error" live>
                {error}
              </Status>
            )}
            {result && !result.correct && (
              <Status tone="error">
                <strong>Belum tepat.</strong> {result.message}
                <ul>
                  {result.targets
                    .filter((t) => !t.ok)
                    .slice(0, 5)
                    .map((t) => (
                      <li key={t.cell}>{t.message}</li>
                    ))}
                  {result.targets.filter((t) => !t.ok).length > 5 && (
                    <li>…dan {result.targets.filter((t) => !t.ok).length - 5} sel lain yang belum sesuai.</li>
                  )}
                </ul>
                <div className="mt-2 d-flex gap-2 flex-wrap">
                  {hintsLeft > 0 && (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setHintCount((n) => n + 1)}>
                      Buka petunjuk berikutnya
                    </button>
                  )}
                </div>
              </Status>
            )}
            {result?.correct && (
              <Status tone="success">
                <strong>Benar!</strong> {result.message}{' '}
                {awarded > 0 ? (
                  <span>+{awarded} poin.</span>
                ) : (
                  <span>Latihan ini sudah pernah diselesaikan, jadi tidak ada poin tambahan.</span>
                )}
              </Status>
            )}
            {(result?.correct || revealed) && (
              <section className="xl-panel mt-3">
                <div className="xl-panel-head">{result?.correct ? 'Penjelasan' : 'Solusi'}</div>
                <div className="xl-panel-body">
                  {explanation && <p>{explanation}</p>}
                  {solutionCells && (
                    <div className="xl-solution" aria-label="Jawaban acuan">
                      {Object.entries(solutionCells).map(([ref, v]) => (
                        <div key={ref}>
                          <strong>{ref}</strong> <span className="xl-muted">→</span> {v}
                        </div>
                      ))}
                    </div>
                  )}
                  {solutionCells && <AnswerCompare base={exercise.cells} solution={solutionCells} mine={cells} premium={premium} />}
                  <div className="d-flex gap-2 flex-wrap mt-3">
                    {nextSlug && (
                      <Link className="btn btn-primary btn-sm" to={`/latihan/${nextSlug}`}>
                        Latihan berikutnya <ArrowRight className="xl-icon ms-1 me-0" aria-hidden="true" />
                      </Link>
                    )}
                    {exercise.lessonSlug && (
                      <Link className="btn btn-outline-secondary btn-sm" to={`/belajar/${exercise.lessonSlug}`}>
                        Kembali ke pelajaran
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            )}
            {!result && !revealed && !error && (
              <p className="xl-muted xl-small mb-0">
                Tingkat {DIFFICULTY_LABELS[exercise.difficulty].toLowerCase()}. Hasil rumus dihitung langsung di browser-mu; tekan “Periksa
                jawaban” bila sudah yakin.
              </p>
            )}
            {!preview && (
              <div className="mt-3">
                <ReportExercise slug={exercise.slug} />
              </div>
            )}
          </div>

          <ConfirmDialog
            open={confirmReveal && canReveal}
            title="Lihat solusi sekarang?"
            confirmLabel="Ya, tampilkan"
            onConfirm={reveal}
            onCancel={() => setConfirmReveal(false)}
          >
            <p className={premium || unlockedHere ? 'mb-0' : 'mb-2'}>
              Cobalah buka petunjuk dulu; belajar lebih melekat bila kamu menemukan jawabannya sendiri. Poin tetap hanya diberikan satu kali
              per latihan.
            </p>
            {!premium && !unlockedHere && (
              <p className="mb-0">
                <strong>Ini memakai jatah solusi gratis minggu ini.</strong> Jatah berikutnya tersedia 7 hari setelah ini.
              </p>
            )}
          </ConfirmDialog>
          {confirmReveal && !canReveal && (
            <Status tone="info">
              <strong>Jatah solusi gratis minggu ini sudah terpakai.</strong>
              {nextFree ? ` Jatah berikutnya tersedia ${dateLong.format(new Date(nextFree))}.` : ''} Yang gratis: buka petunjuk satu per
              satu, dan solusi lengkap muncul otomatis begitu jawabanmu benar. Premium membuka solusi kapan saja.{' '}
              <Link to="/premium">Lihat Premium</Link>{' '}
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setConfirmReveal(false)}>
                Tutup
              </button>
            </Status>
          )}
        </div>
      </div>
    </>
  );
}
