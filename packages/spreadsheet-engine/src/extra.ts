import { FUNCTION_ARITY } from './functions-meta';
import { type Range, clean, compare, err, toNumber, toText, typeRank } from './helpers';
import { callMore } from './more';
import { type ErrorValue, type Node, type Scalar, type Value, isError } from './types';

/** Kemampuan Sheet yang dibutuhkan fungsi tambahan (teks, tanggal, pencarian). */
export interface ExtraCtx {
  scalar(node: Node): Value;
  range(node: Node, fn: string, label: string): Range | ErrorValue;
  now(): Date;
  tick(n?: number): void;
}

/** Serial tanggal Excel: jumlah hari sejak 1899-12-30 (sistem tanggal 1900). */
const EPOCH_OFFSET = 25569;
const DAY_MS = 86_400_000;

const serialOf = (utcMs: number): number => Math.floor(utcMs / DAY_MS) + EPOCH_OFFSET;

function jakartaToday(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    now,
  );
  const [y, m, d] = parts.split('-').map(Number) as [number, number, number];
  return serialOf(Date.UTC(y, m - 1, d));
}

function roundHalfAwayFromZero(n: number, digits: number): number {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return n;
  const sign = n < 0 ? -1 : 1;
  const shifted = Number(`${Math.abs(n).toPrecision(15)}e${digits}`);
  return sign * Number(`${Math.round(shifted)}e${-digits}`);
}

const wildcard = (s: string): RegExp =>
  new RegExp(`^${[...s].map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('')}$`, 'i');

/** Kesamaan untuk pencarian: angka dengan angka, teks (tidak peka huruf besar-kecil, wildcard) dengan teks, boolean dengan boolean. */
function same(cell: Value, key: Scalar, useWildcard: boolean): boolean {
  if (isError(cell) || cell === null || key === null) return false;
  if (typeof key === 'number') return typeof cell === 'number' && cell === key;
  if (typeof key === 'boolean') return typeof cell === 'boolean' && cell === key;
  if (typeof cell !== 'string') return false;
  if (useWildcard && /[*?]/.test(key)) return wildcard(key).test(cell);
  return cell.toLowerCase() === key.toLowerCase();
}

const comparable = (cell: Value, key: Scalar): cell is Scalar =>
  !isError(cell) && cell !== null && key !== null && typeRank(cell) === typeRank(key);

const orEmpty = (v: Value): Value => (v === null ? 0 : v);

function vector(r: Range, fn: string, label: string): Value[] | ErrorValue {
  if (r.rows !== 1 && r.cols !== 1) return err('#VALUE!', `${fn}: ${label} harus satu baris atau satu kolom saja.`);
  return r.values;
}

/** Fungsi di luar inti: pembulatan, tanggal, teks, dan pencarian. Mengembalikan galat sebagai nilai. */
export function callExtra(name: string, args: Node[], ctx: ExtraCtx): Value | undefined {
  if (!(name in FUNCTION_ARITY)) return undefined;

  const num = (i: number, label = name): number | ErrorValue => toNumber(ctx.scalar(args[i]!), label);
  const txt = (i: number): string | ErrorValue => toText(ctx.scalar(args[i]!));

  switch (name) {
    case 'ROUND': {
      const n = num(0);
      if (isError(n)) return n;
      const d = args[1] ? num(1) : 0;
      if (isError(d)) return d;
      const digits = Math.trunc(d);
      if (Math.abs(digits) > 15) return err('#NUM!', 'ROUND: jumlah digit harus antara -15 dan 15.');
      return clean(roundHalfAwayFromZero(n, digits));
    }
    case 'TODAY':
      return jakartaToday(ctx.now());
    case 'DATE': {
      const y = num(0);
      const m = num(1);
      const d = num(2);
      if (isError(y)) return y;
      if (isError(m)) return m;
      if (isError(d)) return d;
      let year = Math.trunc(y);
      if (year < 0 || year > 9999) return err('#NUM!', 'DATE: tahun harus antara 0 dan 9999.');
      if (year < 1900) year += 1900; // perilaku Excel: 0-1899 ditambah 1900
      const ms = Date.UTC(year, Math.trunc(m) - 1, Math.trunc(d));
      const s = serialOf(ms);
      if (Number.isNaN(ms) || s < 1 || new Date(ms).getUTCFullYear() > 9999)
        return err('#NUM!', 'DATE: hasil tanggal di luar rentang yang didukung.');
      return s;
    }
    case 'YEAR':
    case 'MONTH':
    case 'DAY': {
      const n = num(0);
      if (isError(n)) return n;
      if (n < 1 || n > 2958465) return err('#NUM!', `${name}: nomor tanggal harus antara 1 dan 2958465.`);
      const date = new Date((Math.floor(n) - EPOCH_OFFSET) * DAY_MS);
      return name === 'YEAR' ? date.getUTCFullYear() : name === 'MONTH' ? date.getUTCMonth() + 1 : date.getUTCDate();
    }
    case 'LEN': {
      const t = txt(0);
      return isError(t) ? t : [...t].length;
    }
    case 'TRIM': {
      const t = txt(0);
      return isError(t) ? t : t.replace(/ +/g, ' ').trim();
    }
    case 'UPPER':
    case 'LOWER':
    case 'PROPER': {
      const t = txt(0);
      if (isError(t)) return t;
      if (name === 'UPPER') return t.toUpperCase();
      if (name === 'LOWER') return t.toLowerCase();
      return t.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
    }
    case 'LEFT':
    case 'RIGHT': {
      const t = txt(0);
      if (isError(t)) return t;
      const n = args[1] ? num(1) : 1;
      if (isError(n)) return n;
      if (n < 0) return err('#VALUE!', `${name}: jumlah karakter tidak boleh negatif.`);
      const chars = [...t];
      const k = Math.trunc(n);
      return name === 'LEFT' ? chars.slice(0, k).join('') : k === 0 ? '' : chars.slice(-k).join('');
    }
    case 'MID': {
      const t = txt(0);
      const s = num(1);
      const l = num(2);
      if (isError(t)) return t;
      if (isError(s)) return s;
      if (isError(l)) return l;
      if (s < 1 || l < 0) return err('#VALUE!', 'MID: posisi awal minimal 1 dan jumlah karakter tidak boleh negatif.');
      return [...t].slice(Math.trunc(s) - 1, Math.trunc(s) - 1 + Math.trunc(l)).join('');
    }
    case 'IFNA': {
      const v = ctx.scalar(args[0]!);
      return isError(v) && v.code === '#N/A' ? ctx.scalar(args[1]!) : v;
    }
    case 'VLOOKUP': {
      const key = ctx.scalar(args[0]!);
      if (isError(key)) return key;
      const table = ctx.range(args[1]!, name, 'tabel');
      if (isError(table)) return table;
      const col = num(2);
      if (isError(col)) return col;
      let exact = false;
      if (args[3]) {
        const e = ctx.scalar(args[3]);
        if (isError(e)) return e;
        exact = e === false || e === 0;
      }
      const idx = Math.trunc(col);
      if (idx < 1) return err('#VALUE!', 'VLOOKUP: nomor kolom minimal 1.');
      if (idx > table.cols) return err('#REF!', `VLOOKUP: nomor kolom ${idx} melebihi jumlah kolom tabel (${table.cols}).`);
      ctx.tick(table.rows);
      let found = -1;
      for (let r = 0; r < table.rows; r++) {
        const cell = table.values[r * table.cols]!;
        if (exact) {
          if (same(cell, key, true)) {
            found = r;
            break;
          }
        } else if (comparable(cell, key) && compare(cell, key) <= 0) {
          // Pencocokan perkiraan: ambil nilai terbesar yang <= kunci (data kolom pertama harus terurut naik).
          if (found < 0 || compare(table.values[found * table.cols] as Scalar, cell) <= 0) found = r;
        }
      }
      if (found < 0) return err('#N/A', `VLOOKUP: nilai "${String(key)}" tidak ditemukan di kolom pertama tabel.`);
      return orEmpty(table.values[found * table.cols + idx - 1]!);
    }
    case 'XLOOKUP': {
      const key = ctx.scalar(args[0]!);
      if (isError(key)) return key;
      const look = ctx.range(args[1]!, name, 'rentang pencarian');
      if (isError(look)) return look;
      const ret = ctx.range(args[2]!, name, 'rentang hasil');
      if (isError(ret)) return ret;
      const lv = vector(look, name, 'rentang pencarian');
      if (isError(lv)) return lv;
      const rv = vector(ret, name, 'rentang hasil');
      if (isError(rv)) return rv;
      if (lv.length !== rv.length) return err('#VALUE!', 'XLOOKUP: rentang pencarian dan rentang hasil harus sama panjang.');
      const mm = args[4] ? num(4) : 0;
      const sm = args[5] ? num(5) : 1;
      if (isError(mm)) return mm;
      if (isError(sm)) return sm;
      if (![0, -1, 1, 2].includes(mm)) return err('#VALUE!', 'XLOOKUP: mode pencocokan hanya mendukung 0, -1, 1, atau 2.');
      if (sm !== 1 && sm !== -1)
        return err('#VALUE!', 'XLOOKUP: mode pencarian hanya mendukung 1 (awal ke akhir) atau -1 (akhir ke awal).');
      ctx.tick(lv.length);
      const order = lv.map((_, i) => i);
      if (sm === -1) order.reverse();
      let best = -1;
      for (const i of order) {
        const cell = lv[i]!;
        if (same(cell, key, mm === 2)) {
          best = i;
          break;
        }
        if ((mm === -1 || mm === 1) && comparable(cell, key)) {
          const c = compare(cell, key);
          if (mm === -1 && c < 0 && (best < 0 || compare(lv[best] as Scalar, cell) < 0)) best = i;
          if (mm === 1 && c > 0 && (best < 0 || compare(lv[best] as Scalar, cell) > 0)) best = i;
        }
      }
      if (best < 0) {
        if (args[3]) return ctx.scalar(args[3]);
        return err('#N/A', `XLOOKUP: nilai "${String(key)}" tidak ditemukan.`);
      }
      return orEmpty(rv[best]!);
    }
    case 'MATCH': {
      const key = ctx.scalar(args[0]!);
      if (isError(key)) return key;
      const arr = ctx.range(args[1]!, name, 'rentang');
      if (isError(arr)) return arr;
      const v = vector(arr, name, 'rentang');
      if (isError(v)) return v;
      const type = args[2] ? num(2) : 1;
      if (isError(type)) return type;
      ctx.tick(v.length);
      let best = -1;
      for (let i = 0; i < v.length; i++) {
        const cell = v[i]!;
        if (type === 0) {
          if (same(cell, key, true)) {
            best = i;
            break;
          }
        } else if (comparable(cell, key)) {
          const c = compare(cell, key);
          if (type > 0 && c <= 0 && (best < 0 || compare(v[best] as Scalar, cell) <= 0)) best = i;
          if (type < 0 && c >= 0 && (best < 0 || compare(v[best] as Scalar, cell) >= 0)) best = i;
        }
      }
      if (best < 0) return err('#N/A', `MATCH: nilai "${String(key)}" tidak ditemukan.`);
      return best + 1;
    }
    case 'INDEX': {
      const arr = ctx.range(args[0]!, name, 'rentang');
      if (isError(arr)) return arr;
      const r = num(1);
      if (isError(r)) return r;
      const c = args[2] ? num(2) : undefined;
      if (c !== undefined && isError(c)) return c;
      let row = Math.trunc(r);
      let col = c === undefined ? 1 : Math.trunc(c);
      if (c === undefined && arr.rows === 1 && arr.cols > 1) {
        // Satu baris: angka tunggal dibaca sebagai nomor kolom.
        col = row;
        row = 1;
      }
      if (row === 0 || col === 0)
        return err('#VALUE!', 'INDEX: nomor baris/kolom 0 (mengambil seluruh baris/kolom) belum didukung di playground.');
      if (row < 0 || col < 0) return err('#VALUE!', 'INDEX: nomor baris/kolom tidak boleh negatif.');
      if (row > arr.rows || col > arr.cols) return err('#REF!', 'INDEX: nomor baris/kolom melebihi ukuran rentang.');
      return orEmpty(arr.values[(row - 1) * arr.cols + (col - 1)]!);
    }
  }
  return callMore(name, args, ctx);
}
