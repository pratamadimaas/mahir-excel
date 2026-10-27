import { buildMatcher } from './criteria';
import { type ExtraCtx, callExtra } from './extra';
import { type Range, clean, compare, err, toBool, toNumber } from './helpers';
import { FUNCTION_ARITY } from './functions-meta';
import { parseFormula } from './parser';
import { addrToRef, normalizeRef, parseCellRef } from './refs';
import { type CellAddress, type ErrorValue, FormulaError, LIMITS, type Node, type Scalar, type Value, isError } from './types';

export type Cells = Record<string, string>;

type Result = Value | Range;

const isRange = (r: Result): r is Range => typeof r === 'object' && r !== null && (r as Range).kind === 'range';

/** Mengubah isi mentah sel (yang diketik pengguna) menjadi nilai literal. */
export function parseLiteral(raw: string): Scalar {
  const t = raw.trim();
  if (t === '') return null;
  if (/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(t)) return Number(t);
  const up = t.toUpperCase();
  if (up === 'TRUE') return true;
  if (up === 'FALSE') return false;
  return raw;
}

export function isFormula(raw: string): boolean {
  return raw.trimStart().startsWith('=') && raw.trim().length > 0;
}

export interface SheetOptions {
  maxSteps?: number;
  /** Waktu "sekarang" untuk TODAY(); bawaan jam sistem. Dipakai tes agar deterministik. */
  now?: Date | (() => Date);
  /** Nomor baris (mulai 1) yang disembunyikan filter. SUBTOTAL mengabaikan sel di baris ini, seperti Excel. */
  hiddenRows?: ReadonlySet<number>;
}

/**
 * Sheet menyimpan isi mentah sel dan mengevaluasinya secara malas dengan cache.
 * Deteksi referensi melingkar, batas kedalaman, dan batas langkah mencegah komputasi tak terbatas.
 */
export class Sheet {
  private raw = new Map<string, string>();
  private cache = new Map<string, Value>();
  private asts = new Map<string, Node | FormulaError>();
  private visiting = new Set<string>();
  private steps = 0;
  private depth = 0;
  private readonly maxSteps: number;
  private readonly nowFn: () => Date;
  private readonly hiddenRows: ReadonlySet<number>;

  constructor(cells: Cells = {}, opts: SheetOptions = {}) {
    this.maxSteps = opts.maxSteps ?? LIMITS.maxEvalSteps;
    this.hiddenRows = opts.hiddenRows ?? new Set();
    const n = opts.now;
    this.nowFn = typeof n === 'function' ? n : n ? () => n : () => new Date();
    for (const [k, v] of Object.entries(cells)) {
      const ref = normalizeRef(k);
      if (ref && v !== '') this.raw.set(ref, v);
    }
  }

  setCell(ref: string, value: string): void {
    const key = normalizeRef(ref);
    if (!key) return;
    if (value === '') this.raw.delete(key);
    else this.raw.set(key, value);
    this.cache.clear();
    this.asts.delete(key);
    this.steps = 0;
  }

  getRaw(ref: string): string {
    return this.raw.get(normalizeRef(ref) ?? '') ?? '';
  }

  /** Nilai terhitung sebuah sel (galat dikembalikan sebagai ErrorValue, tidak dilempar). */
  getValue(ref: string): Value {
    const key = normalizeRef(ref);
    if (!key) return err('#REF!', `Referensi ${ref} tidak valid.`);
    this.steps = 0;
    return this.cellValue(key);
  }

  /** Menghitung satu potongan rumus (dipakai penelusur langkah). Galat dikembalikan sebagai nilai. */
  evaluateNode(node: Node): Value {
    this.steps = 0;
    try {
      const r = this.evalNode(node);
      return isRange(r) ? err('#VALUE!', 'Rumus menghasilkan rentang sel. Gunakan fungsi seperti SUM untuk meringkasnya.') : r;
    } catch (x) {
      return x instanceof FormulaError ? x.toValue() : err('#ERROR!', 'Terjadi kesalahan saat menghitung rumus.');
    }
  }

  /** Semua sel yang berisi data beserta nilainya. */
  evaluateAll(): Record<string, Value> {
    const out: Record<string, Value> = {};
    for (const key of this.raw.keys()) out[key] = this.getValue(key);
    return out;
  }

  private tick(n = 1): void {
    this.steps += n;
    if (this.steps > this.maxSteps) {
      throw new FormulaError('#LIMIT!', 'Perhitungan terlalu berat sehingga dihentikan (batas sumber daya).');
    }
  }

  private cellValue(key: string): Value {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const raw = this.raw.get(key);
    if (raw === undefined) return null;
    if (!isFormula(raw)) {
      const lit = parseLiteral(raw);
      this.cache.set(key, lit);
      return lit;
    }
    if (this.visiting.has(key)) {
      return err('#CIRC!', `Referensi melingkar terdeteksi di sel ${key}: rumus merujuk dirinya sendiri, langsung atau tidak langsung.`);
    }
    if (this.depth >= LIMITS.maxEvalDepth) {
      return err('#LIMIT!', 'Rantai referensi antar sel terlalu dalam.');
    }
    this.visiting.add(key);
    this.depth++;
    let value: Value;
    try {
      let ast = this.asts.get(key);
      if (!ast) {
        try {
          ast = parseFormula(raw.trim());
        } catch (e) {
          ast = e instanceof FormulaError ? e : new FormulaError('#ERROR!', 'Rumus tidak valid.');
        }
        this.asts.set(key, ast);
      }
      if (ast instanceof FormulaError) {
        value = ast.toValue();
      } else {
        const r = this.evalNode(ast);
        value = isRange(r) ? err('#VALUE!', 'Rumus menghasilkan rentang sel. Gunakan fungsi seperti SUM untuk meringkasnya.') : r;
      }
    } catch (e) {
      value = e instanceof FormulaError ? e.toValue() : err('#ERROR!', 'Terjadi kesalahan saat menghitung rumus.');
    } finally {
      this.visiting.delete(key);
      this.depth--;
    }
    // Hasil yang tergantung pada galat melingkar tidak di-cache agar urutan evaluasi tidak memengaruhi hasil.
    if (!(isError(value) && value.code === '#CIRC!')) this.cache.set(key, value);
    return value;
  }

  private readRange(from: CellAddress, to: CellAddress): Range {
    const rows = to.row - from.row + 1;
    const cols = to.col - from.col + 1;
    this.tick(rows * cols);
    const values: Value[] = [];
    for (let r = from.row; r <= to.row; r++) {
      for (let c = from.col; c <= to.col; c++) values.push(this.cellValue(addrToRef({ col: c, row: r })));
    }
    return { kind: 'range', rows, cols, values };
  }

  /** Mengevaluasi node menjadi nilai skalar; rentang di konteks skalar -> #VALUE!. */
  private scalar(node: Node): Value {
    const r = this.evalNode(node);
    if (isRange(r)) {
      if (r.rows === 1 && r.cols === 1) return r.values[0]!;
      return err('#VALUE!', 'Di sini dibutuhkan satu nilai, tetapi yang diberikan adalah rentang sel.');
    }
    return r;
  }

  private evalNode(node: Node): Result {
    this.tick();
    switch (node.type) {
      case 'num':
      case 'str':
      case 'bool':
        return node.value;
      case 'val':
        return node.value;
      case 'ref':
        return this.cellValue(addrToRef(node.addr));
      case 'range':
        return this.readRange(node.from, node.to);
      case 'unary': {
        const n = toNumber(this.scalar(node.arg), 'Operator -');
        if (isError(n)) return n;
        return node.op === '-' ? -n : n;
      }
      case 'percent': {
        const n = toNumber(this.scalar(node.arg), 'Operator %');
        return isError(n) ? n : clean(n / 100);
      }
      case 'binary':
        return this.binary(node.op, node.left, node.right);
      case 'call':
        return this.call(node.name, node.args);
    }
  }

  private binary(op: string, l: Node, r: Node): Value {
    const a = this.scalar(l);
    const b = this.scalar(r);
    if (isError(a)) return a;
    if (isError(b)) return b;
    if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
      const c = compare(a, b);
      switch (op) {
        case '=':
          return c === 0;
        case '<>':
          return c !== 0;
        case '<':
          return c < 0;
        case '>':
          return c > 0;
        case '<=':
          return c <= 0;
        default:
          return c >= 0;
      }
    }
    if (op === '&') return `${a === null ? '' : String(a)}${b === null ? '' : String(b)}`;
    const x = toNumber(a, `Operator ${op}`);
    if (isError(x)) return x;
    const y = toNumber(b, `Operator ${op}`);
    if (isError(y)) return y;
    switch (op) {
      case '+':
        return clean(x + y);
      case '-':
        return clean(x - y);
      case '*':
        return clean(x * y);
      case '/':
        return y === 0 ? err('#DIV/0!', 'Pembagian dengan nol tidak bisa dihitung. Periksa sel pembagi (penyebut).') : clean(x / y);
      case '^': {
        const p = Math.pow(x, y);
        return Number.isFinite(p) ? clean(p) : err('#NUM!', 'Hasil perpangkatan tidak valid atau terlalu besar.');
      }
    }
    return err('#ERROR!', `Operator ${op} tidak didukung.`);
  }

  // ---- fungsi ----

  private call(name: string, args: Node[]): Value {
    const spec = FUNCTION_ARITY[name];
    if (!spec) return err('#NAME?', `Fungsi ${name} tidak didukung.`);
    if (args.length < spec.min || args.length > spec.max) {
      const need = spec.min === spec.max ? `${spec.min}` : spec.max >= 64 ? `minimal ${spec.min}` : `${spec.min} sampai ${spec.max}`;
      return err('#ERROR!', `Fungsi ${name} membutuhkan ${need} argumen, tetapi diberi ${args.length}.`);
    }
    switch (name) {
      case 'IF': {
        const cond = toBool(this.scalar(args[0]!), 'IF');
        if (isError(cond)) return cond;
        if (cond) return this.scalar(args[1]!);
        return args[2] ? this.scalar(args[2]) : false;
      }
      case 'IFERROR': {
        let v: Value;
        try {
          v = this.scalar(args[0]!);
        } catch (e) {
          // Batas sumber daya tidak boleh ditutupi oleh IFERROR.
          if (e instanceof FormulaError && e.code === '#LIMIT!') throw e;
          if (e instanceof FormulaError) v = e.toValue();
          else throw e;
        }
        if (isError(v) && v.code !== '#LIMIT!') return this.scalar(args[1]!);
        return v;
      }
      case 'AND':
      case 'OR':
        return this.logical(name, args);
      case 'SUM':
      case 'AVERAGE':
      case 'MIN':
      case 'MAX':
      case 'COUNT':
      case 'COUNTA':
        return this.aggregate(name, args);
      case 'COUNTIF':
      case 'COUNTIFS':
      case 'SUMIF':
      case 'SUMIFS':
      case 'AVERAGEIF':
      case 'MAXIFS':
      case 'MINIFS':
        return this.conditional(name, args);
      case 'SUBTOTAL':
        return this.subtotal(args);
      case 'COUNTBLANK': {
        const r = this.rangeArg(args[0]!, name, 'rentang');
        if (isError(r)) return r;
        return r.values.filter((v) => v === null || v === '').length;
      }
    }
    const extra = callExtra(name, args, this.extraCtx());
    if (extra !== undefined) return extra;
    return err('#NAME?', `Fungsi ${name} tidak didukung.`);
  }

  private extraCtx(): ExtraCtx {
    return {
      scalar: (node) => this.scalar(node),
      range: (node, fn, label) => this.rangeArg(node, fn, label),
      now: this.nowFn,
      tick: (n) => this.tick(n),
    };
  }

  private logical(name: 'AND' | 'OR', args: Node[]): Value {
    const bools: boolean[] = [];
    for (const a of args) {
      const r = this.evalNode(a);
      if (isRange(r)) {
        for (const v of r.values) {
          if (isError(v)) return v;
          if (typeof v === 'boolean') bools.push(v);
          else if (typeof v === 'number') bools.push(v !== 0);
        }
      } else {
        const b = toBool(r, name);
        if (isError(b)) return b;
        bools.push(b);
      }
    }
    if (bools.length === 0) return err('#VALUE!', `${name} tidak menemukan nilai logika (TRUE/FALSE atau angka) untuk diperiksa.`);
    return name === 'AND' ? bools.every(Boolean) : bools.some(Boolean);
  }

  private aggregate(name: string, args: Node[]): Value {
    const nums: number[] = [];
    let counta = 0;
    for (const a of args) {
      const r = this.evalNode(a);
      const fromReference = isRange(r) || a.type === 'ref';
      const list: Value[] = isRange(r) ? r.values : [r];
      for (const v of list) {
        if (name === 'COUNTA') {
          if (v !== null) counta++;
          continue;
        }
        if (isError(v)) return v;
        if (typeof v === 'number') nums.push(v);
        else if (!fromReference) {
          // Argumen langsung (bukan referensi): boolean dan teks angka ikut dihitung.
          if (v === null) continue;
          const n = toNumber(v, name);
          if (isError(n)) {
            if (name === 'COUNT') continue;
            return n;
          }
          nums.push(n);
        }
      }
    }
    switch (name) {
      case 'COUNTA':
        return counta;
      case 'COUNT':
        return nums.length;
      case 'SUM':
        return clean(nums.reduce((s, n) => s + n, 0));
      case 'AVERAGE':
        return nums.length === 0
          ? err(
              '#DIV/0!',
              'AVERAGE tidak menemukan satu pun angka di rentang, sehingga tidak bisa dibagi. Periksa apakah data berupa angka, bukan teks.',
            )
          : clean(nums.reduce((s, n) => s + n, 0) / nums.length);
      case 'MIN':
        return nums.length === 0 ? 0 : Math.min(...nums);
      default:
        return nums.length === 0 ? 0 : Math.max(...nums);
    }
  }

  private rangeArg(node: Node, fn: string, label: string): Range | ErrorValue {
    if (node.type !== 'range' && node.type !== 'ref') {
      return err('#VALUE!', `${fn}: ${label} harus berupa rentang sel, misalnya B2:B10.`);
    }
    const r = this.evalNode(node);
    return isRange(r) ? r : { kind: 'range', rows: 1, cols: 1, values: [r] };
  }

  private conditional(name: string, args: Node[]): Value {
    // Bentuk argumen: kolom [rentang_kriteria, kriteria]+ dan rentang_jumlah opsional/wajib.
    let sumRange: Range | null = null;
    const pairs: Array<{ range: Range; crit: Scalar }> = [];
    let pairStart = 0;

    if (name === 'SUMIFS' || name === 'MAXIFS' || name === 'MINIFS') {
      const s = this.rangeArg(args[0]!, name, name === 'SUMIFS' ? 'rentang jumlah' : 'rentang nilai');
      if (isError(s)) return s;
      sumRange = s;
      pairStart = 1;
    }
    if (name === 'SUMIF' || name === 'COUNTIF' || name === 'AVERAGEIF') {
      const rg = this.rangeArg(args[0]!, name, 'rentang');
      if (isError(rg)) return rg;
      const c = this.scalar(args[1]!);
      if (isError(c)) return c;
      pairs.push({ range: rg, crit: c });
      if ((name === 'SUMIF' || name === 'AVERAGEIF') && args[2]) {
        const s = this.rangeArg(args[2], name, 'rentang jumlah');
        if (isError(s)) return s;
        // Seperti Excel: rentang jumlah dihitung dari sel kiri atas dengan ukuran yang sama dengan rentang kriteria.
        if (args[2].type === 'range') {
          const sr = this.evalRangeResized(args[2], rg.rows, rg.cols);
          if (isError(sr)) return sr;
          sumRange = sr;
        } else sumRange = s;
      } else if (name === 'SUMIF' || name === 'AVERAGEIF') sumRange = rg;
    } else {
      if ((args.length - pairStart) % 2 !== 0) {
        return err('#ERROR!', `Fungsi ${name} membutuhkan pasangan (rentang kriteria, kriteria). Jumlah argumen kurang atau berlebih.`);
      }
      for (let i = pairStart; i < args.length; i += 2) {
        const rg = this.rangeArg(args[i]!, name, 'rentang kriteria');
        if (isError(rg)) return rg;
        const c = this.scalar(args[i + 1]!);
        if (isError(c)) return c;
        pairs.push({ range: rg, crit: c });
      }
    }

    const base = pairs[0]!.range;
    for (const p of pairs) {
      if (p.range.rows !== base.rows || p.range.cols !== base.cols) {
        return err('#VALUE!', `${name}: semua rentang harus memiliki ukuran (jumlah baris dan kolom) yang sama.`);
      }
    }
    if (sumRange && (sumRange.rows !== base.rows || sumRange.cols !== base.cols)) {
      return err('#VALUE!', `${name}: rentang jumlah harus berukuran sama dengan rentang kriteria.`);
    }

    const matchers = pairs.map((p) => buildMatcher(p.crit as Scalar));
    let count = 0;
    let sum = 0;
    let numCount = 0;
    const picked: number[] = [];
    for (let i = 0; i < base.values.length; i++) {
      let ok = true;
      for (let k = 0; k < pairs.length; k++) {
        const cell = pairs[k]!.range.values[i]!;
        if (isError(cell) || !matchers[k]!(cell)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      count++;
      if (sumRange) {
        const sv = sumRange.values[i]!;
        if (isError(sv)) return sv;
        if (typeof sv === 'number') {
          sum += sv;
          numCount++;
          picked.push(sv);
        }
      }
    }
    if (name === 'AVERAGEIF') {
      return numCount === 0
        ? err('#DIV/0!', 'AVERAGEIF tidak menemukan angka yang memenuhi syarat, sehingga tidak bisa dihitung rata-ratanya.')
        : clean(sum / numCount);
    }
    if (name === 'MAXIFS' || name === 'MINIFS') {
      if (picked.length === 0) return 0;
      return name === 'MAXIFS' ? Math.max(...picked) : Math.min(...picked);
    }
    return name === 'COUNTIF' || name === 'COUNTIFS' ? count : clean(sum);
  }

  /** SUBTOTAL: seperti SUM/AVERAGE/dst., tetapi melewati baris yang disembunyikan filter dan sel SUBTOTAL lain. */
  private subtotal(args: Node[]): Value {
    const code = toNumber(this.scalar(args[0]!), 'SUBTOTAL');
    if (isError(code)) return code;
    const fn = Math.trunc(code);
    const base = fn >= 101 ? fn - 100 : fn;
    if (!((fn >= 1 && fn <= 11) || (fn >= 101 && fn <= 111))) {
      return err('#VALUE!', `SUBTOTAL: nomor fungsi ${fn} tidak valid. Pakai 1 sampai 11, atau 101 sampai 111.`);
    }
    if (![1, 2, 3, 4, 5, 6, 9].includes(base)) {
      return err(
        '#VALUE!',
        `SUBTOTAL: nomor fungsi ${fn} belum didukung di playground. Pakai 1 (rata-rata), 2 (hitung angka), 3 (hitung isi), 4 (maks), 5 (min), 6 (kali), atau 9 (jumlah).`,
      );
    }
    const nums: number[] = [];
    let filled = 0;
    for (const a of args.slice(1)) {
      if (a.type !== 'ref' && a.type !== 'range') {
        return err('#VALUE!', 'SUBTOTAL: argumen setelah nomor fungsi harus berupa referensi sel atau rentang, misalnya B2:B10.');
      }
      const from = a.type === 'ref' ? a.addr : a.from;
      const to = a.type === 'ref' ? a.addr : a.to;
      this.tick((to.row - from.row + 1) * (to.col - from.col + 1));
      for (let r = from.row; r <= to.row; r++) {
        if (this.hiddenRows.has(r + 1)) continue;
        for (let c = from.col; c <= to.col; c++) {
          const key = addrToRef({ col: c, row: r });
          const raw = this.raw.get(key);
          if (raw !== undefined && isFormula(raw) && /\bSUBTOTAL\s*\(/i.test(raw)) continue; // SUBTOTAL bersarang tidak ikut dihitung
          const v = this.cellValue(key);
          if (v !== null) filled++;
          if (base === 3) continue;
          if (isError(v)) return v;
          if (typeof v === 'number') nums.push(v);
        }
      }
    }
    switch (base) {
      case 1:
        return nums.length === 0
          ? err('#DIV/0!', 'SUBTOTAL: tidak ada angka yang terlihat untuk dirata-ratakan.')
          : clean(nums.reduce((s, n) => s + n, 0) / nums.length);
      case 2:
        return nums.length;
      case 3:
        return filled;
      case 4:
        return nums.length === 0 ? 0 : Math.max(...nums);
      case 5:
        return nums.length === 0 ? 0 : Math.min(...nums);
      case 6:
        return nums.length === 0 ? 0 : clean(nums.reduce((p, n) => p * n, 1));
      default:
        return clean(nums.reduce((s, n) => s + n, 0));
    }
  }

  private evalRangeResized(node: Node, rows: number, cols: number): Range | ErrorValue {
    if (node.type !== 'range') return err('#VALUE!', 'Rentang jumlah tidak valid.');
    const to = { col: node.from.col + cols - 1, row: node.from.row + rows - 1 };
    if (to.col >= LIMITS.maxCols || to.row >= LIMITS.maxRows) return err('#REF!', 'Rentang jumlah keluar dari batas grid.');
    return this.readRange(node.from, to);
  }
}

/** Menghitung seluruh sel dalam grid mentah. Shortcut untuk pemakaian tanpa kelas Sheet. */
export function evaluateCells(cells: Cells): Record<string, Value> {
  return new Sheet(cells).evaluateAll();
}

/** Mengambil daftar sel/rentang yang dirujuk sebuah rumus (untuk penyorotan di UI). */
export function extractReferences(formula: string): string[] {
  const out: string[] = [];
  const walk = (n: Node): void => {
    switch (n.type) {
      case 'ref':
        out.push(addrToRef(n.addr));
        break;
      case 'range':
        out.push(`${addrToRef(n.from)}:${addrToRef(n.to)}`);
        break;
      case 'unary':
      case 'percent':
        walk(n.arg);
        break;
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'call':
        n.args.forEach(walk);
        break;
    }
  };
  try {
    walk(parseFormula(formula.trim()));
  } catch {
    /* rumus tidak valid: tidak ada referensi untuk disorot */
  }
  return out;
}

/** Nama fungsi yang dipakai sebuah rumus (huruf besar, tanpa duplikat). */
export function extractFunctions(formula: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    if (n.type === 'call') {
      out.add(n.name);
      n.args.forEach(walk);
    } else if (n.type === 'unary' || n.type === 'percent') walk(n.arg);
    else if (n.type === 'binary') {
      walk(n.left);
      walk(n.right);
    }
  };
  try {
    walk(parseFormula(formula.trim()));
  } catch {
    /* abaikan */
  }
  return [...out];
}

/** Mengembalikan sel yang tercakup sebuah teks rentang "A1:B3" atau sel tunggal. */
export function expandRef(text: string): string[] {
  const [a, b] = text.split(':');
  const from = parseCellRef(a ?? '');
  if (!from) return [];
  const to = b ? parseCellRef(b) : from;
  if (!to) return [];
  const out: string[] = [];
  for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) {
    for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++) out.push(addrToRef({ col: c, row: r }));
  }
  return out;
}
