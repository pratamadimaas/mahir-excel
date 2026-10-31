import type { Rng } from './rng';

export type Cell = string | number | Date | null;
export type Fmt = 'date' | 'time' | 'rp' | 'int' | 'dec' | undefined;
export type Field = 'admin' | 'hrd' | 'jualan' | 'keuangan';

export interface Task {
  ask: string;
  hint: string;
  expected: number | string;
  /** Selisih yang masih dianggap benar untuk jawaban angka. */
  tol?: number;
}

export interface Built {
  headers: string[];
  rows: Cell[][];
  tasks: Task[];
  fmt?: Fmt[];
}

export interface DatasetSpec {
  slug: string;
  title: string;
  field: Field;
  /** Satu kalimat tentang isi data. */
  blurb: string;
  /** "Yang bikin repot": jebakan yang sengaja diselipkan. */
  mess: string;
  build: (r: Rng) => Built;
}

// ---------------------------------------------------------------- angka dan tanggal

export const sum = (a: number[]): number => a.reduce((s, x) => s + x, 0);
export const round = (n: number, d = 0): number => {
  const k = 10 ** d;
  return Math.round(n * k) / k;
};
export const pad = (n: number, w = 4): string => String(n).padStart(w, '0');
export const D = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m - 1, d));
export const iso = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);
export const dayDiff = (a: Date, b: Date): number => Math.round((a.getTime() - b.getTime()) / 86_400_000);
export const randDate = (r: Rng, from: Date, days: number): Date => addDays(from, r.int(0, days - 1));
/** Jam dalam sehari sebagai Date 1899-12-30 agar Excel membacanya sebagai waktu. */
export const clock = (h: number, m: number): Date => new Date(Date.UTC(1899, 11, 30, h, m));
export const rp = (n: number): string => `Rp ${n.toLocaleString('id-ID')}`;

export const task = (ask: string, hint: string, expected: number | string, tol?: number): Task => ({
  ask,
  hint,
  expected,
  ...(tol !== undefined ? { tol } : {}),
});

// ---------------------------------------------------------------- pengacakan data

/** Teks dengan kerusakan ringan: spasi di depan atau belakang, atau huruf besar dan kecil yang berbeda. */
export function mess(r: Rng, s: string, p = 0.08): string {
  const x = r.next();
  if (x >= p) return s;
  if (x < p * 0.35) return ` ${s}`;
  if (x < p * 0.6) return `${s} `;
  if (x < p * 0.8) return s.toLowerCase();
  return s.toUpperCase();
}

/** Tanggal yang sebagian disimpan sebagai teks berformat tahun-bulan-hari. */
export const dateCell = (r: Rng, d: Date, p = 0.06): Cell => (r.chance(p) ? iso(d) : d);

/** Angka yang sebagian disimpan sebagai teks. */
export const numCell = (r: Rng, n: number, p = 0.05): Cell => (r.chance(p) ? String(n) : n);

/** Menyisipkan salinan persis dari k baris di posisi acak (data ganda). */
export function withDuplicates<T>(r: Rng, rows: T[], k: number): T[] {
  const out = [...rows];
  for (let i = 0; i < k; i++) {
    const src = rows[r.int(0, rows.length - 1)]!;
    out.splice(r.int(0, out.length), 0, src);
  }
  return out;
}

/** Pilihan condong ke awal daftar, supaya selalu ada satu yang jelas paling banyak. */
export const skewed = <T>(r: Rng, arr: readonly T[], power = 1.7): T =>
  arr[Math.min(arr.length - 1, Math.floor(arr.length * r.next() ** power))]!;

export function tally<T>(a: T[], key: (x: T) => string, val: (x: T) => number = () => 1): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of a) m.set(key(x), (m.get(key(x)) ?? 0) + val(x));
  return m;
}

/** Kunci dengan nilai tertinggi. Gagal bila seri, karena jawaban harus tidak ambigu. */
export function topUnique(m: Map<string, number>, label = 'data'): [string, number] {
  const sorted = [...m.entries()].sort((x, y) => y[1] - x[1]);
  if (sorted.length === 0) throw new Error(`${label}: kosong`);
  if (sorted.length > 1 && sorted[0]![1] === sorted[1]![1])
    throw new Error(`${label}: seri di puncak (${sorted[0]![0]} dan ${sorted[1]![0]})`);
  return sorted[0]!;
}

export const sortBy = <T>(a: T[], key: (x: T) => number): T[] => [...a].sort((x, y) => key(x) - key(y));
