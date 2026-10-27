import { indexToCol, isError, parseCellRef, shiftFormula, type Value } from '@excellab/spreadsheet-engine';

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

/**
 * Area tabel otomatis seperti "current region" di Excel: blok sel berisi yang saling bersambung dari sel berisi paling
 * kiri-atas. Baris pertama dianggap judul. Null bila tidak ada tabel yang layak disaring (minimal judul dan dua baris data).
 */
export function currentRegion(cells: Record<string, string>, rows: number, cols: number): DataRange | null {
  const filled = new Set<string>();
  for (const [k, v] of Object.entries(cells)) {
    const a = parseCellRef(k);
    if (a && v !== '' && a.row < rows && a.col < cols) filled.add(`${a.col},${a.row}`);
  }
  let start: { col: number; row: number } | null = null;
  for (let r = 0; r < rows && !start; r++) for (let c = 0; c < cols; c++) if (filled.has(`${c},${r}`)) { start = { col: c, row: r }; break; }
  if (!start) return null;
  const seen = new Set([`${start.col},${start.row}`]);
  const queue = [start];
  let minC = start.col, maxC = start.col, minR = start.row, maxR = start.row;
  while (queue.length) {
    const cur = queue.pop()!;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const key = `${cur.col + dc},${cur.row + dr}`;
        if (seen.has(key) || !filled.has(key)) continue;
        seen.add(key);
        queue.push({ col: cur.col + dc, row: cur.row + dr });
        minC = Math.min(minC, cur.col + dc); maxC = Math.max(maxC, cur.col + dc);
        minR = Math.min(minR, cur.row + dr); maxR = Math.max(maxR, cur.row + dr);
      }
    }
  }
  if (maxR - minR < 2) return null;
  return { top: minR + 1, bottom: maxR + 1, left: minC, right: maxC };
}

/** Nilai unik (sebagai teks tampilan) di satu kolom data, urut alami. Sel kosong menjadi teks kosong. */
export function distinctTexts(range: DataRange, col: number, textOf: (cellRef: string) => string): string[] {
  const set = new Set<string>();
  for (let r = range.top + 1; r <= range.bottom; r++) set.add(textOf(ref(col, r)));
  return [...set].sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base', numeric: true }));
}

/**
 * Baris yang disembunyikan (nomor baris 1-based) oleh filter daftar centang. `filters` memetakan indeks kolom
 * mutlak ke nilai teks yang boleh tampil; sebuah baris tampil hanya bila lolos di semua kolom yang difilter.
 */
export function hiddenByFilters(
  range: DataRange,
  filters: ReadonlyMap<number, ReadonlySet<string>>,
  textOf: (cellRef: string) => string,
): Set<number> {
  const hidden = new Set<number>();
  for (let r = range.top + 1; r <= range.bottom; r++) {
    for (const [col, allowed] of filters) {
      if (!allowed.has(textOf(ref(col, r)))) {
        hidden.add(r);
        break;
      }
    }
  }
  return hidden;
}
