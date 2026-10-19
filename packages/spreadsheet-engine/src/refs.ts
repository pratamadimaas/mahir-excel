import { type CellAddress, FormulaError, LIMITS } from './types';

export function colToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToCol(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const REF_PATTERN = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/;

/** Mengurai "A1", "$B$2" dan sejenisnya. Mengembalikan null bila bukan referensi sel. */
export function parseCellRef(text: string): CellAddress | null {
  const m = REF_PATTERN.exec(text);
  if (!m) return null;
  const col = colToIndex(m[1]!);
  const row = Number(m[2]) - 1;
  if (row < 0) return null;
  return { col, row };
}

/** Melempar #REF! bila alamat di luar batas grid. */
export function assertInBounds(addr: CellAddress, text: string): void {
  if (addr.col >= LIMITS.maxCols || addr.row >= LIMITS.maxRows || addr.row < 0) {
    throw new FormulaError('#REF!', `Referensi ${text} berada di luar batas grid (maksimal kolom ZZ dan baris ${LIMITS.maxRows}).`);
  }
}

export function addrToRef(addr: CellAddress): string {
  return `${indexToCol(addr.col)}${addr.row + 1}`;
}

/** Normalisasi "a1"/"$A$1" menjadi "A1" (untuk kunci penyimpanan sel). */
export function normalizeRef(text: string): string | null {
  const a = parseCellRef(text);
  return a ? addrToRef(a) : null;
}
