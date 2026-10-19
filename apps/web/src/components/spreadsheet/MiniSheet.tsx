import { useMemo, useState } from 'react';
import { indexToCol } from '@excellab/spreadsheet-engine';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { referencedCells, useSheetModel } from './useSheetModel';

type Row = (string | number)[];

/** Tabel contoh read-only dengan formula bar; sel dapat dipilih untuk melihat isinya. */
export function MiniSheet({ table, label, initial }: { table: Row[]; label: string; initial?: string }) {
  const cells = useMemo(() => {
    const out: Record<string, string> = {};
    table.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v !== '') out[`${indexToCol(c)}${r + 1}`] = String(v);
      }),
    );
    return out;
  }, [table]);
  const first = Object.keys(cells).find((k) => cells[k]!.startsWith('=')) ?? 'A1';
  const [selected, setSelected] = useState(initial ?? first);
  const { getDisplay, getRaw } = useSheetModel(cells);
  const raw = getRaw(selected);
  const highlights = useMemo(() => referencedCells(raw), [raw]);
  const cols = Math.max(...table.map((r) => r.length));

  return (
    <div className="xl-minisheet">
      <div className="xl-formula-bar">
        <div className="xl-namebox" aria-label="Nama sel terpilih">
          {selected}
        </div>
        <div className={`xl-fx${raw.startsWith('=') ? ' on' : ''}`} aria-hidden="true">
          fx
        </div>
        <input className="xl-formula-input" readOnly value={raw} aria-label={`Isi sel ${selected}`} />
      </div>
      <SpreadsheetGrid
        label={label}
        rows={table.length}
        cols={cols}
        getRaw={getRaw}
        getDisplay={getDisplay}
        editable={new Set()}
        highlights={highlights}
        selected={selected}
        onSelect={setSelected}
        onChange={() => undefined}
      />
    </div>
  );
}
