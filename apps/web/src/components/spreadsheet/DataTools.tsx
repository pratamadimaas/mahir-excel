import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { indexToCol, type Value } from '@excellab/spreadsheet-engine';
import type { ExerciseTools } from '@excellab/shared';
import { parseDataRange, sortRows } from './dataOps';

interface Props {
  tools: ExerciseTools;
  cells: Record<string, string>;
  valueOf: (ref: string) => Value;
  headerText: (ref: string) => string;
  onCells: (next: Record<string, string>) => void;
  disabled?: boolean;
}

/** Panel Urutkan seperti tab Data di Excel; bekerja pada rentang yang ditentukan latihan. Filter ada di panah judul kolom. */
export function DataTools({ tools, cells, valueOf, headerText, onCells, disabled }: Props) {
  const sortRange = useMemo(() => (tools.sort ? parseDataRange(tools.sort.range) : null), [tools.sort]);
  const [sortCol, setSortCol] = useState(0);
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

  return (
    <div className="xl-datatools" role="group" aria-label="Alat data: urutkan">
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
      <div className="xl-datastatus" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  );
}
