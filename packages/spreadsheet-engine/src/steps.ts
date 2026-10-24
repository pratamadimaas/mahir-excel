import { type Sheet } from './evaluator';
import { addrToRef } from './refs';
import { FormulaError, type Node, type Value, isError } from './types';
import { parseFormula } from './parser';

/** Satu langkah penelusuran, seperti "Evaluate Formula" di Excel: bagian bergaris bawah dihitung lalu diganti nilainya. */
export interface FormulaStep {
  /** Rumus sebelum langkah ini, dipecah supaya bagian yang dihitung bisa digarisbawahi. */
  before: { pre: string; target: string; post: string };
  /** Teks nilai pengganti bagian yang dihitung. */
  value: string;
  /** Penjelasan singkat dalam bahasa sehari-hari. */
  note: string;
  /** True bila hasil langkah ini galat. */
  isError: boolean;
}

export interface FormulaTrace {
  /** Rumus awal yang sudah dirapikan (dari pohon rumus). */
  start: string;
  steps: FormulaStep[];
  result: Value;
  /** Terisi bila rumus tidak bisa dibaca sama sekali. */
  parseError: { code: string; message: string } | null;
}

const MAX_STEPS = 80;
const MARK_A = '\u0001';
const MARK_B = '\u0002';

const val = (value: Value): Node => ({ type: 'val', value });

function num(n: number): string {
  return String(Number(n.toPrecision(12)));
}

/** Teks sebuah nilai seperti tampil di rumus. */
function valueText(v: Value): string {
  if (v === null) return '(kosong)';
  if (isError(v)) return v.code;
  if (typeof v === 'number') return num(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `"${v.replace(/"/g, '""')}"`;
}

const PREC: Record<string, number> = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };

function render(node: Node, target: Node | null, parentPrec = 0, right = false): string {
  const wrap = (s: string): string => (node === target ? `${MARK_A}${s}${MARK_B}` : s);
  switch (node.type) {
    case 'num':
      return wrap(num(node.value));
    case 'str':
      return wrap(`"${node.value.replace(/"/g, '""')}"`);
    case 'bool':
      return wrap(node.value ? 'TRUE' : 'FALSE');
    case 'val':
      return wrap(valueText(node.value));
    case 'ref':
      return wrap(addrToRef(node.addr));
    case 'range':
      return wrap(`${addrToRef(node.from)}:${addrToRef(node.to)}`);
    case 'unary':
      return wrap(`${node.op}${render(node.arg, target, 6)}`);
    case 'percent':
      return wrap(`${render(node.arg, target, 6)}%`);
    case 'binary': {
      const p = PREC[node.op] ?? 1;
      const body = `${render(node.left, target, p)}${node.op}${render(node.right, target, p, true)}`;
      const needParens = p < parentPrec || (p === parentPrec && right);
      return wrap(needParens ? `(${body})` : body);
    }
    case 'call':
      return wrap(`${node.name}(${node.args.map((a) => render(a, target)).join(',')})`);
  }
}

function split(text: string): { pre: string; target: string; post: string } {
  const a = text.indexOf(MARK_A);
  const b = text.lastIndexOf(MARK_B);
  if (a < 0 || b < 0) return { pre: text, target: '', post: '' };
  // Penanda bersarang tidak mungkin (target adalah satu simpul), tetapi bersihkan bila ada.
  const clean = (s: string): string => s.split(MARK_A).join('').split(MARK_B).join('');
  return { pre: clean(text.slice(0, a)), target: clean(text.slice(a + 1, b)), post: clean(text.slice(b + 1)) };
}

/** Argumen yang harus tetap berupa referensi/rentang (tidak boleh diganti nilainya) agar fungsi bekerja benar. */
function keepsReference(name: string, i: number): boolean {
  switch (name) {
    case 'SUM':
    case 'AVERAGE':
    case 'MIN':
    case 'MAX':
    case 'COUNT':
    case 'COUNTA':
      return true;
    case 'COUNTIF':
      return i === 0;
    case 'COUNTIFS':
      return i % 2 === 0;
    case 'SUMIF':
      return i === 0 || i === 2;
    case 'SUMIFS':
      return i === 0 || i % 2 === 1;
    case 'MATCH':
      return i === 1;
    case 'INDEX':
      return i === 0;
    case 'VLOOKUP':
      return i === 1;
    case 'XLOOKUP':
      return i === 1 || i === 2;
    default:
      return false;
  }
}

interface Reduction {
  target: Node;
  replacement: Node;
  note: string;
}

function describe(target: Node, result: Value): string {
  const tail = isError(result) ? ` Hasilnya galat ${result.code}: ${result.message}` : '';
  switch (target.type) {
    case 'ref': {
      const ref = addrToRef(target.addr);
      return `Mengambil isi sel ${ref}.${tail}`;
    }
    case 'call':
      return `Menjalankan fungsi ${target.name}.${tail}`;
    case 'binary': {
      const what: Record<string, string> = {
        '+': 'Menjumlahkan',
        '-': 'Mengurangkan',
        '*': 'Mengalikan',
        '/': 'Membagi',
        '^': 'Memangkatkan',
        '&': 'Menggabungkan teks',
      };
      return `${what[target.op] ?? 'Membandingkan'}.${tail}`;
    }
    case 'percent':
      return `Mengubah persen menjadi angka desimal.${tail}`;
    case 'unary':
      return `Menerapkan tanda ${target.op}.${tail}`;
    default:
      return `Menghitung bagian ini.${tail}`;
  }
}

function find(node: Node, sheet: Sheet, keep: boolean): Reduction | null {
  switch (node.type) {
    case 'num':
    case 'str':
    case 'bool':
    case 'val':
    case 'range':
      return null;
    case 'ref': {
      if (keep) return null;
      const v = sheet.evaluateNode(node);
      return { target: node, replacement: val(v), note: describe(node, v) };
    }
    case 'unary':
    case 'percent': {
      const sub = find(node.arg, sheet, false);
      if (sub) return sub;
      const v = sheet.evaluateNode(node);
      return { target: node, replacement: val(v), note: describe(node, v) };
    }
    case 'binary': {
      const sub = find(node.left, sheet, false) ?? find(node.right, sheet, false);
      if (sub) return sub;
      const v = sheet.evaluateNode(node);
      return { target: node, replacement: val(v), note: describe(node, v) };
    }
    case 'call': {
      if (node.name === 'IF' || node.name === 'IFERROR') {
        const first = node.args[0]!;
        const sub = find(first, sheet, false);
        if (sub) return sub;
        if (node.name === 'IFERROR') {
          const v = sheet.evaluateNode(first);
          const pick = isError(v) && v.code !== '#LIMIT!' ? node.args[1]! : val(v);
          const why = isError(v) ? `Bagian pertama galat (${v.code}), jadi IFERROR memakai nilai penggantinya.` : 'Bagian pertama tidak galat, jadi IFERROR memakai hasilnya.';
          return { target: node, replacement: pick, note: why };
        }
        const probe = sheet.evaluateNode({ type: 'call', name: 'IF', args: [first, { type: 'num', value: 1 }, { type: 'num', value: 0 }] });
        if (isError(probe)) return { target: node, replacement: val(probe), note: describe(node, probe) };
        const yes = probe === 1;
        const chosen = yes ? node.args[1]! : (node.args[2] ?? { type: 'bool' as const, value: false });
        return {
          target: node,
          replacement: chosen,
          note: yes ? 'Syaratnya benar, jadi IF memakai nilai jika benar.' : 'Syaratnya salah, jadi IF memakai nilai jika salah.',
        };
      }
      for (let i = 0; i < node.args.length; i++) {
        const sub = find(node.args[i]!, sheet, keepsReference(node.name, i));
        if (sub) return sub;
      }
      const v = sheet.evaluateNode(node);
      return { target: node, replacement: val(v), note: describe(node, v) };
    }
  }
}

function replace(root: Node, target: Node, replacement: Node): Node {
  if (root === target) return replacement;
  switch (root.type) {
    case 'unary':
      return { ...root, arg: replace(root.arg, target, replacement) };
    case 'percent':
      return { ...root, arg: replace(root.arg, target, replacement) };
    case 'binary':
      return { ...root, left: replace(root.left, target, replacement), right: replace(root.right, target, replacement) };
    case 'call':
      return { ...root, args: root.args.map((a) => replace(a, target, replacement)) };
    default:
      return root;
  }
}

/**
 * Menelusuri sebuah rumus langkah demi langkah terhadap data di `sheet`, mirip "Evaluate Formula" di Excel.
 * Pemanggil memberi Sheet yang berisi data sel; rumus yang ditelusuri tidak perlu ada di dalam sheet.
 */
export function traceFormula(formula: string, sheet: Sheet): FormulaTrace {
  let root: Node;
  try {
    root = parseFormula(formula.trim());
  } catch (e) {
    const fe = e instanceof FormulaError ? e : new FormulaError('#ERROR!', 'Rumus tidak valid.');
    return { start: formula.trim(), steps: [], result: fe.toValue(), parseError: { code: fe.code, message: fe.message } };
  }
  const start = render(root, null);
  const steps: FormulaStep[] = [];
  let cur = root;
  while (cur.type !== 'val' && steps.length < MAX_STEPS) {
    const red = find(cur, sheet, false) ?? (() => {
      const v = sheet.evaluateNode(cur);
      return { target: cur, replacement: val(v), note: describe(cur, v) } satisfies Reduction;
    })();
    const rep = red.replacement;
    steps.push({
      before: split(render(cur, red.target)),
      value: rep.type === 'val' ? valueText(rep.value) : render(rep, null),
      note: red.note,
      isError: rep.type === 'val' && isError(rep.value),
    });
    cur = replace(cur, red.target, rep);
  }
  const result: Value = cur.type === 'val' ? cur.value : sheet.evaluateNode(cur);
  return { start, steps, result, parseError: null };
}
