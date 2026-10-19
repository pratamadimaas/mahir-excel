import { ErrorValue, type Scalar, type Value, isError } from './types';

/** Rentang nilai yang sudah dibaca dari sheet (baris demi baris). */
export interface Range {
  kind: 'range';
  rows: number;
  cols: number;
  values: Value[];
}

export const NUMERIC_TEXT = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/;

export const err = (code: ErrorValue['code'], message: string): ErrorValue => new ErrorValue(code, message);

export function toNumber(v: Value, ctx: string): number | ErrorValue {
  if (isError(v)) return v;
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (NUMERIC_TEXT.test(v)) return Number(v);
  return err('#VALUE!', `${ctx}: "${v}" adalah teks, bukan angka, sehingga tidak bisa dihitung.`);
}

export function toBool(v: Value, ctx: string): boolean | ErrorValue {
  if (isError(v)) return v;
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const up = v.trim().toUpperCase();
  if (up === 'TRUE') return true;
  if (up === 'FALSE') return false;
  return err('#VALUE!', `${ctx}: "${v}" tidak bisa dibaca sebagai TRUE atau FALSE.`);
}

/** Teks dari nilai (sel kosong = ""), mengikuti konversi Excel secara umum. Angka memakai titik desimal. */
export function toText(v: Value): string | ErrorValue {
  if (isError(v)) return v;
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

export const typeRank = (v: Scalar): number => (v === null ? 0 : typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 3);

export function compare(a: Scalar, b: Scalar): number {
  // Sel kosong diperlakukan seperti 0 atau "" tergantung pasangannya.
  if (a === null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b === null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = Number(a);
  const y = Number(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Menghilangkan derau floating point (0.1 + 0.2 => 0.3) seperti tampilan 15 digit Excel. */
export function clean(n: number): number {
  return Number(n.toPrecision(15));
}
