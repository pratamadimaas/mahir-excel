import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, Filter, FilterX } from 'lucide-react';
import { indexToCol, type Value } from '@excellab/spreadsheet-engine';
import type { ExerciseTools } from '@excellab/shared';
import { FILTER_LABELS, type FilterOp, filterRows, parseDataRange, sortRows } from './dataOps';

interface Props {
  tools: ExerciseTools;
  cells: Record<string, string>;
  valueOf: (ref: string) => Value;
  headerText: (ref: string) => string;
  onCells: (next: Record<string, string>) => void;
  onHidden: (rows: Set<number> | null) => void;
  disabled?: boolean;
}

/** Panel Urutkan dan Filter seperti tab Data di Excel; bekerja pada rentang yang ditentukan latihan. */
export function DataTools({ tools, cells, valueOf, headerText, onCells, onHidden, disabled }: Props) {
  const sortRange = useMemo(() => (tools.sort ? parseDataRange(tools.sort.range) : null), [tools.sort]);
  const filterRange = useMemo(() => (tools.filter ? parseDataRange(tools.filter.range) : null), [tools.filter]);
  const [sortCol, setSortCol] = useState(0);
  const [filterCol, setFilterCol] = useState(0);
  const [op, setOp] = useState<FilterOp>('sama');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const columnsOf = (r: { top: number; left: number; right: number }): { offset: number; label: string }[] =>
    Array.from({ length: r.right - r.left + 1 }, (_, i) => ({
      offset: i,
      label: headerText(`${indexToCol(r.left + i)}${r.top}`) || `Kolom ${indexToCol(r.left + i)}`,
    }));

  const doSort = (order: 'asc' | 'desc'): void => {
    if (!sortRange) return;
    onCells(sortRows(cells, sortRange, sortCol, order, valueOf));
    setStatus(
      `Data diurutkan menurut “${columnsOf(sortRange)[sortCol]?.label}” (${order === 'asc' ? 'A ke Z / terkecil dulu' : 'Z ke A / terbesar dulu'}).`,
    );
  };

  const apply = (): void => {
    if (!filterRange) return;
    const r = filterRows(filterRange, filterCol, op, text, valueOf);
    if (text.trim() === '') {
      onHidden(null);
      setStatus(null);
      return;
    }
    onHidden(r.hidden);
    setStatus(`${r.visible} dari ${r.total} baris ditemukan.`);
  };

  const clear = (): void => {
    onHidden(null);
    setText('');
    setStatus('Filter dihapus.');
  };

  return (
    <div className="xl-datatools" role="group" aria-label="Alat data: urutkan dan filter">
      {sortRange && (
        <fieldset>
          <legend>Urutkan</legend>
          <div>
            <label htmlFor="sort-col">Kolom</label>
            <select
              id="sort-col"
              className="form-select"
              value={sortCol}
              onChange={(e) => setSortCol(Number(e.target.value))}
              disabled={disabled}
            >
              {columnsOf(sortRange).map((c) => (
                <option key={c.offset} value={c.offset}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => doSort('asc')} disabled={disabled}>
            <ArrowDownAZ className="xl-icon" aria-hidden="true" /> Naik
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => doSort('desc')} disabled={disabled}>
            <ArrowUpZA className="xl-icon" aria-hidden="true" /> Turun
          </button>
        </fieldset>
      )}
      {filterRange && (
        <fieldset>
          <legend>Filter</legend>
          <div>
            <label htmlFor="filter-col">Kolom</label>
            <select
              id="filter-col"
              className="form-select"
              value={filterCol}
              onChange={(e) => setFilterCol(Number(e.target.value))}
              disabled={disabled}
            >
              {columnsOf(filterRange).map((c) => (
                <option key={c.offset} value={c.offset}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-op">Syarat</label>
            <select
              id="filter-op"
              className="form-select"
              value={op}
              onChange={(e) => setOp(e.target.value as FilterOp)}
              disabled={disabled}
            >
              {(Object.keys(FILTER_LABELS) as FilterOp[]).map((k) => (
                <option key={k} value={k}>
                  {FILTER_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-text">Nilai</label>
            <input
              id="filter-text"
              className="form-control"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              disabled={disabled}
            />
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={apply} disabled={disabled}>
            <Filter className="xl-icon" aria-hidden="true" /> Terapkan
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={clear} disabled={disabled}>
            <FilterX className="xl-icon" aria-hidden="true" /> Hapus filter
          </button>
        </fieldset>
      )}
      <div className="xl-datastatus" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  );
}
