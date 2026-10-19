import { colToIndex, indexToCol } from './refs';
import { LIMITS } from './types';

/** Referensi sel A1 yang bukan bagian dari nama fungsi (mis. LOG10() atau angka seperti 1E5. */
const REF = /(?<![A-Za-z0-9_.$])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(.])/g;

/**
 * Menggeser referensi relatif pada rumus seperti fitur isi-otomatis (fill handle) Excel:
 * `B2*$E$1` digeser satu baris ke bawah menjadi `B3*$E$1`. Tanda $ mengunci kolom/baris.
 * Teks dalam tanda kutip tidak diubah. Referensi yang keluar dari grid menjadi `#REF!`.
 */
export function shiftFormula(formula: string, dCols: number, dRows: number): string {
  if (!formula.startsWith('=')) return formula;
  const parts = formula.split(/("(?:[^"]|"")*")/); // indeks ganjil = literal teks
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(REF, (_m, absCol: string, col: string, absRow: string, row: string) => {
        const c = absCol ? colToIndex(col) : colToIndex(col) + dCols;
        const r = absRow ? Number(row) : Number(row) + dRows;
        if (c < 0 || c >= LIMITS.maxCols || r < 1 || r > LIMITS.maxRows) return '#REF!';
        return `${absCol}${indexToCol(c)}${absRow}${r}`;
      });
    })
    .join('');
}
