import { useCallback, useMemo } from 'react';
import { Sheet, expandRef, extractReferences, formatValue, isError, isFormula } from '@excellab/spreadsheet-engine';
import type { CellDisplay } from './SpreadsheetGrid';

/** Menghitung sheet dari isi mentah sel dan menyediakan tampilan per sel. */
export function useSheetModel(cells: Record<string, string>) {
  const sheet = useMemo(() => new Sheet(cells), [cells]);

  const getDisplay = useCallback(
    (ref: string): CellDisplay => {
      const raw = sheet.getRaw(ref);
      if (raw === '') return { text: '', kind: 'empty' };
      const v = sheet.getValue(ref);
      if (isError(v)) return { text: v.code, kind: 'err', title: v.message };
      if (typeof v === 'number') return { text: formatValue(v), kind: 'num' };
      if (typeof v === 'boolean') return { text: formatValue(v), kind: 'bool' };
      if (v === null) return { text: '', kind: 'empty' };
      return { text: v, kind: 'text' };
    },
    [sheet],
  );

  const getRaw = useCallback((ref: string) => sheet.getRaw(ref), [sheet]);
  return { sheet, getDisplay, getRaw };
}

/** Sel yang dirujuk rumus pada sel terpilih (untuk disorot seperti di Excel). */
export function referencedCells(raw: string): Set<string> {
  const out = new Set<string>();
  if (!isFormula(raw)) return out;
  for (const r of extractReferences(raw)) for (const c of expandRef(r)) out.add(c);
  return out;
}

export function expandAll(refs: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of refs) for (const c of expandRef(r)) out.add(c);
  return out;
}
