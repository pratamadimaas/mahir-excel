import type { ExtraCtx } from './extra';
import { NUMERIC_TEXT, type Range, clean, compare, err, toBool, toNumber, toText, typeRank } from './helpers';
import { type ErrorValue, type Node, type Scalar, type Value, isError } from './types';

/** Fungsi tambahan: statistik, logika bertingkat, teks, tanggal, dan pencarian mendatar. Mengembalikan galat sebagai nilai. */

const EPOCH_OFFSET = 25569;
const DAY_MS = 86_400_000;
const MAX_SERIAL = 2958465;

const serialOf = (utcMs: number): number => Math.floor(utcMs / DAY_MS) + EPOCH_OFFSET;
const dateOf = (serial: number): Date => new Date((Math.floor(serial) - EPOCH_OFFSET) * DAY_MS);

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function jakartaNow(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string): number => Number(parts.find((p) => p.type === t)!.value);
  const day = serialOf(Date.UTC(get('year'), get('month') - 1, get('day')));
  return day + (get('hour') * 3600 + get('minute') * 60 + get('second')) / 86_400;
}

function roundTo(n: number, digits: number, mode: 'up' | 'down'): number {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return n;
  const sign = n < 0 ? -1 : 1;
  const shifted = Number(`${Math.abs(n).toPrecision(15)}e${digits}`);
  const r = mode === 'up' ? Math.ceil(shifted) : Math.floor(shifted);
  return sign * Number(`${r}e${-digits}`);
}

const isRef = (n: Node): boolean => n.type === 'range' || n.type === 'ref';

/** Mengumpulkan angka dari argumen: rentang dan referensi hanya angka, nilai langsung boleh teks angka atau boolean. */
function numbersFrom(nodes: Node[], ctx: ExtraCtx, fn: string): number[] | ErrorValue {
  const out: number[] = [];
  for (const node of nodes) {
    if (isRef(node)) {
      const r = ctx.range(node, fn, 'rentang');
      if (isError(r)) return r;
      ctx.tick(r.values.length);
      for (const v of r.values) {
        if (isError(v)) return v;
        if (typeof v === 'number') out.push(v);
      }
    } else {
      const v = ctx.scalar(node);
      if (isError(v)) return v;
      if (v === null) continue;
      const n = toNumber(v, fn);
      if (isError(n)) return n;
      out.push(n);
    }
  }
  return out;
}

/** Semua nilai dari argumen (rentang diratakan) sebagai teks, untuk CONCAT dan TEXTJOIN. */
function valuesFrom(nodes: Node[], ctx: ExtraCtx, fn: string): Value[] | ErrorValue {
  const out: Value[] = [];
  for (const node of nodes) {
    if (isRef(node)) {
      const r = ctx.range(node, fn, 'rentang');
      if (isError(r)) return r;
      ctx.tick(r.values.length);
      out.push(...r.values);
    } else out.push(ctx.scalar(node));
  }
  return out;
}

function groupDigits(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Format angka bergaya Indonesia: pemisah ribuan titik, desimal koma. */
function formatNumberCode(n: number, fmt: string): string | null {
  const m = /^(#,##0|0+)(?:\.(0+))?(%)?$/.exec(fmt);
  if (!m) return null;
  const decimals = m[2]?.length ?? 0;
  const value = m[3] ? n * 100 : n;
  const neg = value < 0;
  const rounded = Number(`${Math.round(Number(`${Math.abs(value).toPrecision(15)}e${decimals}`))}e${-decimals}`);
  const [intPart = '0', frac = ''] = rounded.toFixed(decimals).split('.');
  let int = intPart;
  if (m[1] === '#,##0') int = groupDigits(int);
  else int = int.padStart(m[1]!.length, '0');
  const body = decimals > 0 ? `${int},${frac}` : int;
  return `${neg && rounded !== 0 ? '-' : ''}${body}${m[3] ?? ''}`;
}

function formatDateCode(serial: number, fmt: string): string | null {
  if (serial < 1 || serial > MAX_SERIAL) return null;
  const date = dateOf(serial);
  const secs = Math.round((serial - Math.floor(serial)) * 86_400);
  const hh = Math.floor(secs / 3600) % 24;
  const mi = Math.floor(secs / 60) % 60;
  const ss = secs % 60;
  const tokens = fmt.match(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|[^a-zA-Z]+|./gi) ?? [];
  const lower = tokens.map((t) => t.toLowerCase());
  const known = new Set(['yyyy', 'yy', 'mmmm', 'mmm', 'mm', 'm', 'dddd', 'ddd', 'dd', 'd', 'hh', 'h', 'ss', 's']);
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = lower[i]!;
    if (!known.has(t)) {
      if (/[a-zA-Z]/.test(tokens[i]!)) return null;
      out += tokens[i];
      continue;
    }
    // "mm" setelah jam atau sebelum detik berarti menit, bukan bulan.
    const minute = (t === 'mm' || t === 'm') && (lower.slice(0, i).reverse().find((x) => known.has(x)) === 'hh' || lower.slice(0, i).reverse().find((x) => known.has(x)) === 'h' || lower.slice(i + 1).find((x) => known.has(x)) === 'ss' || lower.slice(i + 1).find((x) => known.has(x)) === 's');
    const pad = (n: number, w: number): string => String(n).padStart(w, '0');
    switch (t) {
      case 'yyyy':
        out += pad(date.getUTCFullYear(), 4);
        break;
      case 'yy':
        out += pad(date.getUTCFullYear() % 100, 2);
        break;
      case 'mmmm':
        out += MONTHS[date.getUTCMonth()];
        break;
      case 'mmm':
        out += MONTHS_SHORT[date.getUTCMonth()];
        break;
      case 'mm':
        out += minute ? pad(mi, 2) : pad(date.getUTCMonth() + 1, 2);
        break;
      case 'm':
        out += minute ? String(mi) : String(date.getUTCMonth() + 1);
        break;
      case 'dddd':
        out += DAYS[date.getUTCDay()];
        break;
      case 'ddd':
        out += DAYS_SHORT[date.getUTCDay()];
        break;
      case 'dd':
        out += pad(date.getUTCDate(), 2);
        break;
      case 'd':
        out += String(date.getUTCDate());
        break;
      case 'hh':
        out += pad(hh, 2);
        break;
      case 'h':
        out += String(hh);
        break;
      case 'ss':
        out += pad(ss, 2);
        break;
      case 's':
        out += String(ss);
        break;
    }
  }
  return out;
}

const DATE_LETTERS = /[dmyhs]/i;

export function callMore(name: string, args: Node[], ctx: ExtraCtx): Value | undefined {
  const num = (i: number, label = name): number | ErrorValue => toNumber(ctx.scalar(args[i]!), label);
  const txt = (i: number): string | ErrorValue => toText(ctx.scalar(args[i]!));
  const dateArg = (i: number): number | ErrorValue => {
    const n = num(i);
    if (isError(n)) return n;
    if (n < 1 || n > MAX_SERIAL) return err('#NUM!', `${name}: nomor tanggal harus antara 1 dan ${MAX_SERIAL}.`);
    return Math.floor(n);
  };

  switch (name) {
    case 'NOW':
      return clean(jakartaNow(ctx.now()));

    case 'ROUNDUP':
    case 'ROUNDDOWN': {
      const n = num(0);
      const d = num(1);
      if (isError(n)) return n;
      if (isError(d)) return d;
      const digits = Math.trunc(d);
      if (Math.abs(digits) > 15) return err('#NUM!', `${name}: jumlah digit harus antara -15 dan 15.`);
      return clean(roundTo(n, digits, name === 'ROUNDUP' ? 'up' : 'down'));
    }

    case 'MEDIAN': {
      const nums = numbersFrom(args, ctx, name);
      if (isError(nums)) return nums;
      if (nums.length === 0) return err('#NUM!', 'MEDIAN tidak menemukan satu pun angka.');
      const s = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return clean(s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2);
    }

    case 'LARGE':
    case 'SMALL': {
      const nums = numbersFrom([args[0]!], ctx, name);
      if (isError(nums)) return nums;
      const k = num(1);
      if (isError(k)) return k;
      const kk = Math.trunc(k);
      if (kk < 1 || kk > nums.length) return err('#NUM!', `${name}: urutan ke-${kk} di luar jumlah angka (${nums.length}).`);
      const s = [...nums].sort((a, b) => (name === 'LARGE' ? b - a : a - b));
      return s[kk - 1]!;
    }

    case 'RANK': {
      const n = num(0);
      if (isError(n)) return n;
      const nums = numbersFrom([args[1]!], ctx, name);
      if (isError(nums)) return nums;
      const order = args[2] ? num(2) : 0;
      if (isError(order)) return order;
      if (!nums.includes(n)) return err('#N/A', `RANK: angka ${n} tidak ada di dalam rentang.`);
      const ahead = nums.filter((x) => (order === 0 ? x > n : x < n)).length;
      return ahead + 1;
    }

    case 'SUMPRODUCT': {
      const arrays: Range[] = [];
      for (const node of args) {
        if (isRef(node)) {
          const r = ctx.range(node, name, 'rentang');
          if (isError(r)) return r;
          arrays.push(r);
        } else {
          const v = ctx.scalar(node);
          if (isError(v)) return v;
          arrays.push({ kind: 'range', rows: 1, cols: 1, values: [v] });
        }
      }
      const first = arrays[0]!;
      for (const a of arrays) {
        if (a.rows !== first.rows || a.cols !== first.cols)
          return err('#VALUE!', 'SUMPRODUCT: semua rentang harus berukuran sama (jumlah baris dan kolom).');
      }
      ctx.tick(first.values.length * arrays.length);
      let sum = 0;
      for (let i = 0; i < first.values.length; i++) {
        let p = 1;
        for (const a of arrays) {
          const v = a.values[i]!;
          if (isError(v)) return v;
          p *= typeof v === 'number' ? v : 0;
        }
        sum += p;
      }
      return clean(sum);
    }

    case 'IFS': {
      if (args.length % 2 !== 0) return err('#ERROR!', 'IFS membutuhkan pasangan (syarat, hasil). Jumlah argumen harus genap.');
      for (let i = 0; i < args.length; i += 2) {
        const cond = toBool(ctx.scalar(args[i]!), 'IFS');
        if (isError(cond)) return cond;
        if (cond) return ctx.scalar(args[i + 1]!);
      }
      return err('#N/A', 'IFS: tidak ada syarat yang benar. Tambahkan pasangan terakhir dengan syarat TRUE sebagai "selain itu".');
    }

    case 'SWITCH': {
      const key = ctx.scalar(args[0]!);
      if (isError(key)) return key;
      const pairs = args.length - 1;
      const hasDefault = pairs % 2 === 1;
      const last = hasDefault ? args.length - 1 : args.length;
      for (let i = 1; i < last; i += 2) {
        const v = ctx.scalar(args[i]!);
        if (isError(v)) return v;
        if (typeRank(v) === typeRank(key) && compare(v, key) === 0) return ctx.scalar(args[i + 1]!);
      }
      if (hasDefault) return ctx.scalar(args[args.length - 1]!);
      return err('#N/A', 'SWITCH: tidak ada nilai yang cocok dan tidak ada nilai bawaan di akhir.');
    }

    case 'SUBSTITUTE': {
      const t = txt(0);
      const oldT = txt(1);
      const newT = txt(2);
      if (isError(t)) return t;
      if (isError(oldT)) return oldT;
      if (isError(newT)) return newT;
      if (oldT === '') return t;
      if (!args[3]) return t.split(oldT).join(newT);
      const n = num(3);
      if (isError(n)) return n;
      const nth = Math.trunc(n);
      if (nth < 1) return err('#VALUE!', 'SUBSTITUTE: urutan kemunculan minimal 1.');
      let from = 0;
      for (let k = 1; k <= nth; k++) {
        const at = t.indexOf(oldT, from);
        if (at < 0) return t;
        if (k === nth) return t.slice(0, at) + newT + t.slice(at + oldT.length);
        from = at + oldT.length;
      }
      return t;
    }

    case 'FIND': {
      const needle = txt(0);
      const hay = txt(1);
      if (isError(needle)) return needle;
      if (isError(hay)) return hay;
      const s = args[2] ? num(2) : 1;
      if (isError(s)) return s;
      const chars = [...hay];
      const start = Math.trunc(s);
      if (start < 1 || start > chars.length + 1) return err('#VALUE!', 'FIND: posisi awal harus antara 1 dan panjang teks.');
      const offset = chars.slice(0, start - 1).join('').length;
      const at = hay.indexOf(needle, offset);
      if (at < 0) return err('#VALUE!', `FIND: "${needle}" tidak ditemukan di dalam teks. FIND membedakan huruf besar dan kecil.`);
      return [...hay.slice(0, at)].length + 1;
    }

    case 'CONCAT': {
      const vals = valuesFrom(args, ctx, name);
      if (isError(vals)) return vals;
      let out = '';
      for (const v of vals) {
        const t = toText(v);
        if (isError(t)) return t;
        out += t;
      }
      return out;
    }

    case 'TEXTJOIN': {
      const delim = txt(0);
      if (isError(delim)) return delim;
      const ignore = toBool(ctx.scalar(args[1]!), name);
      if (isError(ignore)) return ignore;
      const vals = valuesFrom(args.slice(2), ctx, name);
      if (isError(vals)) return vals;
      const parts: string[] = [];
      for (const v of vals) {
        const t = toText(v);
        if (isError(t)) return t;
        if (ignore && t === '') continue;
        parts.push(t);
      }
      return parts.join(delim);
    }

    case 'TEXT': {
      const v = ctx.scalar(args[0]!);
      if (isError(v)) return v;
      const fmt = txt(1);
      if (isError(fmt)) return fmt;
      if (typeof v === 'string' && !/^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(v)) return v;
      const n = toNumber(v, 'TEXT');
      if (isError(n)) return n;
      const out = DATE_LETTERS.test(fmt) ? formatDateCode(n, fmt) : formatNumberCode(n, fmt);
      if (out === null) {
        return err(
          '#VALUE!',
          `TEXT: kode format "${fmt}" belum didukung di playground. Yang tersedia: 0, 0.00, #,##0, #,##0.00, 0%, 0.0%, serta kode tanggal seperti dd/mm/yyyy, dd mmmm yyyy, dddd, dan hh:mm.`,
        );
      }
      return out;
    }

    case 'DATEDIF': {
      const s = dateArg(0);
      const e = dateArg(1);
      if (isError(s)) return s;
      if (isError(e)) return e;
      const unit = txt(2);
      if (isError(unit)) return unit;
      if (s > e) return err('#NUM!', 'DATEDIF: tanggal awal tidak boleh lebih besar dari tanggal akhir.');
      const a = dateOf(s);
      const b = dateOf(e);
      const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
      switch (unit.toUpperCase()) {
        case 'Y':
          return Math.floor(months / 12);
        case 'M':
          return months;
        case 'YM':
          return months % 12;
        case 'D':
          return e - s;
      }
      return err('#NUM!', 'DATEDIF: satuan hanya mendukung "Y" (tahun), "M" (bulan), "YM" (sisa bulan), atau "D" (hari).');
    }

    case 'EOMONTH': {
      const s = dateArg(0);
      const m = num(1);
      if (isError(s)) return s;
      if (isError(m)) return m;
      const d = dateOf(s);
      const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(m) + 1, 0);
      const out = serialOf(ms);
      if (Number.isNaN(ms) || out < 1 || out > MAX_SERIAL) return err('#NUM!', 'EOMONTH: hasil tanggal di luar rentang yang didukung.');
      return out;
    }

    case 'NETWORKDAYS': {
      const s = dateArg(0);
      const e = dateArg(1);
      if (isError(s)) return s;
      if (isError(e)) return e;
      const holidays = new Set<number>();
      if (args[2]) {
        const h = numbersFrom([args[2]], ctx, name);
        if (isError(h)) return h;
        for (const x of h) holidays.add(Math.floor(x));
      }
      const lo = Math.min(s, e);
      const hi = Math.max(s, e);
      if (hi - lo > 40_000) return err('#NUM!', 'NETWORKDAYS: rentang tanggal terlalu panjang (maksimal sekitar 100 tahun).');
      ctx.tick(hi - lo + 1);
      let count = 0;
      for (let d = lo; d <= hi; d++) {
        const dow = dateOf(d).getUTCDay();
        if (dow !== 0 && dow !== 6 && !holidays.has(d)) count++;
      }
      return s <= e ? count : -count;
    }

    case 'ISBLANK':
      return ctx.scalar(args[0]!) === null;
    case 'ISNUMBER':
      return typeof ctx.scalar(args[0]!) === 'number';
    case 'ISTEXT':
      return typeof ctx.scalar(args[0]!) === 'string';
    case 'VALUE': {
      const v = ctx.scalar(args[0]!);
      if (isError(v)) return v;
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && NUMERIC_TEXT.test(v)) return Number(v);
      if (v === null) return 0;
      return err('#VALUE!', `VALUE: "${String(v)}" tidak bisa diubah menjadi angka.`);
    }
    case 'ABS': {
      const n = num(0);
      return isError(n) ? n : Math.abs(n);
    }
    case 'INT': {
      const n = num(0);
      return isError(n) ? n : Math.floor(n);
    }
    case 'MOD': {
      const n = num(0);
      const d = num(1);
      if (isError(n)) return n;
      if (isError(d)) return d;
      if (d === 0) return err('#DIV/0!', 'MOD: pembagi tidak boleh nol.');
      return clean(n - d * Math.floor(n / d));
    }
    case 'EDATE': {
      const start = dateArg(0);
      const months = num(1);
      if (isError(start)) return start;
      if (isError(months)) return months;
      const d = new Date((start - EPOCH_OFFSET) * DAY_MS);
      const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + Math.trunc(months);
      const y = Math.floor(total / 12);
      const m = total - y * 12;
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const serial = Math.floor(Date.UTC(y, m, Math.min(d.getUTCDate(), last)) / DAY_MS) + EPOCH_OFFSET;
      return serial < 1 || serial > MAX_SERIAL ? err('#NUM!', 'EDATE: hasil tanggal di luar rentang yang didukung.') : serial;
    }
    case 'WEEKDAY': {
      const n = dateArg(0);
      if (isError(n)) return n;
      const type = args[1] ? num(1) : 1;
      if (isError(type)) return type;
      const dow = new Date((n - EPOCH_OFFSET) * DAY_MS).getUTCDay(); // 0 = Minggu
      if (type === 1) return dow + 1;
      if (type === 2) return ((dow + 6) % 7) + 1;
      if (type === 3) return (dow + 6) % 7;
      return err('#NUM!', 'WEEKDAY: jenis hanya mendukung 1 (Minggu=1), 2 (Senin=1), atau 3 (Senin=0).');
    }

    case 'HLOOKUP': {
      const key = ctx.scalar(args[0]!);
      if (isError(key)) return key;
      const table = ctx.range(args[1]!, name, 'tabel');
      if (isError(table)) return table;
      const row = num(2);
      if (isError(row)) return row;
      let exact = false;
      if (args[3]) {
        const e = ctx.scalar(args[3]);
        if (isError(e)) return e;
        exact = e === false || e === 0;
      }
      const idx = Math.trunc(row);
      if (idx < 1) return err('#VALUE!', 'HLOOKUP: nomor baris minimal 1.');
      if (idx > table.rows) return err('#REF!', `HLOOKUP: nomor baris ${idx} melebihi jumlah baris tabel (${table.rows}).`);
      ctx.tick(table.cols);
      let found = -1;
      for (let c = 0; c < table.cols; c++) {
        const cell = table.values[c]!;
        if (isError(cell) || cell === null || key === null) continue;
        if (exact) {
          const eq =
            typeof key === 'string' && typeof cell === 'string'
              ? cell.toLowerCase() === key.toLowerCase()
              : typeRank(cell) === typeRank(key) && cell === key;
          if (eq) {
            found = c;
            break;
          }
        } else if (typeRank(cell) === typeRank(key) && compare(cell, key) <= 0) {
          if (found < 0 || compare(table.values[found] as Scalar, cell) <= 0) found = c;
        }
      }
      if (found < 0) return err('#N/A', `HLOOKUP: nilai "${String(key)}" tidak ditemukan di baris pertama tabel.`);
      const out = table.values[(idx - 1) * table.cols + found]!;
      return out === null ? 0 : out;
    }
  }
  return undefined;
}
