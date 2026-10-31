/** Isi sel jawaban yang dibaca dari berkas peserta: nilai tersimpan (hasil rumus) dan apakah selnya berisi rumus. */
export interface GivenAnswer {
  value: string | number | null;
  formula: boolean;
}

export type Verdict = 'benar' | 'salah' | 'kosong' | 'tanpa-rumus';

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

function asNumber(v: string | number): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = v.trim().replace(/\s/g, '');
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return null;
  return Number(t.replace(',', '.'));
}

/** Menilai satu jawaban. Rumus wajib dipakai: angka yang cocok tetapi diketik langsung tidak dihitung benar. */
export function gradeValue(
  expected: number | string,
  tol: number | undefined,
  given: GivenAnswer | undefined,
  needFormula = true,
): Verdict {
  if (!given || given.value === null || (typeof given.value === 'string' && given.value.trim() === '')) return 'kosong';
  let ok: boolean;
  if (typeof expected === 'number') {
    const g = asNumber(given.value);
    ok = g !== null && Math.abs(g - expected) <= (tol ?? 0.01) + Math.abs(expected) * 1e-9;
  } else {
    ok = norm(String(given.value)) === norm(expected);
  }
  if (!ok) return 'salah';
  return needFormula && !given.formula ? 'tanpa-rumus' : 'benar';
}
