import { buildMatcher, indexToCol, isError, parseCellRef, shiftFormula, type Value } from '@excellab/spreadsheet-engine';

/** Rentang data untuk sort/filter. `top` adalah baris judul; data dimulai di baris top + 1 (semua 1-based, kolom 0-based). */
export interface DataRange {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function parseDataRange(spec: string): DataRange | null {
  const [a, b] = spec.split(':');
  const from = parseCellRef(a ?? '');
  const to = parseCellRef(b ?? '');
  if (!from || !to) return null;
  return {
    top: Math.min(from.row, to.row) + 1,
    bottom: Math.max(from.row, to.row) + 1,
    left: Math.min(from.col, to.col),
    right: Math.max(from.col, to.col),
  };
}

const ref = (col: number, row: number): string => `${indexToCol(col)}${row}`;

/** Urutan Excel untuk sort naik: angka, teks, boolean; sel kosong selalu terakhir. */
const rank = (v: Value): number => (v === null ? 3 : isError(v) ? 2.5 : typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);

function compareValues(a: Value, b: Value): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'id', { sensitivity: 'base', numeric: true });
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return 0;
}

/**
 * Mengurutkan baris data berdasarkan satu kolom dan memindahkan seluruh baris (nilai tetap berpasangan).
 * Rumus ikut digeser ke baris barunya, seperti Excel. Mengembalikan peta sel baru.
 */
export function sortRows(
  cells: Record<string, string>,
  range: DataRange,
  columnOffset: number,
  order: 'asc' | 'desc',
  valueOf: (cellRef: string) => Value,
): Record<string, string> {
  const rows: number[] = [];
  for (let r = range.top + 1; r <= range.bottom; r++) rows.push(r);
  const keyCol = range.left + columnOffset;
  const keyed = rows.map((r) => ({ r, key: valueOf(ref(keyCol, r)) }));
  keyed.sort((x, y) => {
    const blankX = x.key === null;
    const blankY = y.key === null;
    if (blankX || blankY) return Number(blankX) - Number(blankY); // kosong selalu terakhir
    const c = compareValues(x.key, y.key);
    return (order === 'asc' ? c : -c) || x.r - y.r; // stabil
  });
  const next = { ...cells };
  for (const r of rows) for (let c = range.left; c <= range.right; c++) delete next[ref(c, r)];
  keyed.forEach(({ r: oldRow }, i) => {
    const newRow = range.top + 1 + i;
    for (let c = range.left; c <= range.right; c++) {
      const raw = cells[ref(c, oldRow)];
      if (raw === undefined || raw === '') continue;
      next[ref(c, newRow)] = shiftFormula(raw, 0, newRow - oldRow);
    }
  });
  return next;
}

export type FilterOp = 'sama' | 'berisi' | 'lebih-besar' | 'lebih-kecil';

export const FILTER_LABELS: Record<FilterOp, string> = {
  sama: 'sama dengan',
  berisi: 'berisi',
  'lebih-besar': 'lebih besar dari',
  'lebih-kecil': 'lebih kecil dari',
};

/** Baris mana yang disembunyikan oleh filter (nomor baris 1-based) serta jumlah baris yang tampil. */
export function filterRows(
  range: DataRange,
  columnOffset: number,
  op: FilterOp,
  text: string,
  valueOf: (cellRef: string) => Value,
): { hidden: Set<number>; visible: number; total: number } {
  const total = range.bottom - range.top;
  const value = text.trim();
  if (value === '') return { hidden: new Set(), visible: total, total };
  const criteria = op === 'sama' ? `=${value}` : op === 'berisi' ? `=*${value}*` : op === 'lebih-besar' ? `>${value}` : `<${value}`;
  const matches = buildMatcher(criteria);
  const hidden = new Set<number>();
  for (let r = range.top + 1; r <= range.bottom; r++) {
    const v = valueOf(ref(range.left + columnOffset, r));
    if (isError(v) || !matches(v)) hidden.add(r);
  }
  return { hidden, visible: total - hidden.size, total };
}
