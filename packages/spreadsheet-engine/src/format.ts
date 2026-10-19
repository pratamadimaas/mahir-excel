import { type Value, isError } from './types';

const grouped = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 10 });
/** Angka di bawah 10.000 tampil tanpa pemisah ribuan, mirip format General Excel (tahun 2026 tidak tampil 2.026). */
const plain = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 10, useGrouping: false });

/**
 * Format tampilan nilai sel dengan pemisah ribuan/desimal Indonesia (1.500,5).
 * Ini hanya tampilan; nilai yang disimpan tetap angka biasa.
 */
export function formatValue(v: Value): string {
  if (isError(v)) return v.code;
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return (Math.abs(v) >= 10000 ? grouped : plain).format(v);
  return v;
}

/** Nilai untuk perbandingan/teks netral (titik desimal). */
export function valueToPlain(v: Value): string {
  if (isError(v)) return v.code;
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}
