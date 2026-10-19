import { type CellAddress, FormulaError, LIMITS, type Node } from './types';
import { tokenize, type Token } from './tokenizer';
import { assertInBounds, parseCellRef } from './refs';
import { FUNCTION_NAMES } from './functions-meta';

/** Parser rekursif-turun untuk subset rumus yang didukung. Tidak memakai eval(). */
class Parser {
  private pos = 0;
  private depth = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    if (this.tokens.length === 0) {
      throw new FormulaError('#ERROR!', 'Rumus kosong. Tulis sesuatu setelah tanda "=".');
    }
    const node = this.comparison();
    if (this.pos < this.tokens.length) {
      throw new FormulaError('#ERROR!', 'Ada bagian rumus yang tidak dapat dipahami. Periksa tanda kurung dan pemisah argumen.');
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private enter(): void {
    if (++this.depth > LIMITS.maxParseDepth) {
      throw new FormulaError('#LIMIT!', 'Rumus terlalu bersarang (terlalu banyak tingkat tanda kurung/fungsi).');
    }
  }
  private leave(): void {
    this.depth--;
  }

  private isOp(...ops: string[]): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && ops.includes(t.v);
  }

  private takeOp(): string {
    return (this.tokens[this.pos++] as { v: string }).v;
  }

  private comparison(): Node {
    let left = this.concat();
    while (this.isOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = this.takeOp();
      left = { type: 'binary', op, left, right: this.concat() };
    }
    return left;
  }

  private concat(): Node {
    let left = this.additive();
    while (this.isOp('&')) {
      this.pos++;
      left = { type: 'binary', op: '&', left, right: this.additive() };
    }
    return left;
  }

  private additive(): Node {
    let left = this.term();
    while (this.isOp('+', '-')) {
      const op = this.takeOp();
      left = { type: 'binary', op, left, right: this.term() };
    }
    return left;
  }

  private term(): Node {
    let left = this.power();
    while (this.isOp('*', '/')) {
      const op = this.takeOp();
      left = { type: 'binary', op, left, right: this.power() };
    }
    return left;
  }

  private power(): Node {
    let left = this.unary();
    while (this.isOp('^')) {
      this.pos++;
      left = { type: 'binary', op: '^', left, right: this.unary() };
    }
    return left;
  }

  private unary(): Node {
    if (this.isOp('-', '+')) {
      const op = this.takeOp() as '-' | '+';
      this.enter();
      const arg = this.unary();
      this.leave();
      return { type: 'unary', op, arg };
    }
    return this.postfix();
  }

  private postfix(): Node {
    let node = this.primary();
    while (this.isOp('%')) {
      this.pos++;
      node = { type: 'percent', arg: node };
    }
    return node;
  }

  private primary(): Node {
    const t = this.tokens[this.pos++];
    if (!t) {
      throw new FormulaError('#ERROR!', 'Rumus berakhir terlalu cepat. Mungkin ada nilai atau tanda kurung penutup yang kurang.');
    }
    switch (t.t) {
      case 'num':
        return { type: 'num', value: t.v };
      case 'str':
        return { type: 'str', value: t.v };
      case 'lp': {
        this.enter();
        const inner = this.comparison();
        this.leave();
        const close = this.tokens[this.pos++];
        if (!close || close.t !== 'rp') {
          throw new FormulaError('#ERROR!', 'Tanda kurung buka "(" tidak memiliki pasangan ")".');
        }
        return inner;
      }
      case 'id':
        return this.identifier(t.v);
      default:
        throw new FormulaError('#ERROR!', 'Susunan rumus tidak valid di dekat simbol yang tidak diharapkan.');
    }
  }

  private identifier(name: string): Node {
    const next = this.peek();
    const upper = name.toUpperCase();
    if (next && next.t === 'lp') {
      if (!FUNCTION_NAMES.has(upper)) {
        throw new FormulaError('#NAME?', `Fungsi ${upper} tidak dikenal atau belum didukung di playground Mahir Excel.`);
      }
      this.pos++;
      this.enter();
      const args: Node[] = [];
      const after = this.peek();
      if (after && after.t === 'rp') {
        this.pos++;
      } else {
        for (;;) {
          const p = this.peek();
          if (!p || p.t === 'sep' || p.t === 'rp') {
            throw new FormulaError('#ERROR!', `Argumen kosong pada fungsi ${upper}. Isi setiap argumen atau hapus pemisah yang berlebih.`);
          }
          args.push(this.comparison());
          if (args.length > LIMITS.maxArgs) {
            throw new FormulaError('#LIMIT!', `Fungsi ${upper} memiliki terlalu banyak argumen.`);
          }
          const sep = this.tokens[this.pos++];
          if (!sep) {
            throw new FormulaError('#ERROR!', `Tanda kurung penutup ")" untuk fungsi ${upper} belum ada.`);
          }
          if (sep.t === 'rp') break;
          if (sep.t !== 'sep') {
            throw new FormulaError('#ERROR!', `Argumen fungsi ${upper} harus dipisahkan dengan koma (,) atau titik koma (;).`);
          }
        }
      }
      this.leave();
      return { type: 'call', name: upper, args };
    }
    if (upper === 'TRUE') return { type: 'bool', value: true };
    if (upper === 'FALSE') return { type: 'bool', value: false };
    const addr = parseCellRef(name);
    if (!addr) {
      throw new FormulaError(
        '#NAME?',
        `"${name}" bukan referensi sel, angka, atau fungsi yang dikenal. Teks harus diapit tanda kutip, misalnya "${name}".`,
      );
    }
    assertInBounds(addr, name);
    const colon = this.peek();
    if (colon && colon.t === 'colon') {
      this.pos++;
      const second = this.tokens[this.pos++];
      if (!second || second.t !== 'id') {
        throw new FormulaError('#ERROR!', 'Rentang harus berbentuk A1:B5.');
      }
      const to = parseCellRef(second.v);
      if (!to) throw new FormulaError('#REF!', `"${second.v}" bukan referensi sel yang valid untuk ujung rentang.`);
      assertInBounds(to, second.v);
      const from: CellAddress = { col: Math.min(addr.col, to.col), row: Math.min(addr.row, to.row) };
      const end: CellAddress = { col: Math.max(addr.col, to.col), row: Math.max(addr.row, to.row) };
      const cells = (end.col - from.col + 1) * (end.row - from.row + 1);
      if (cells > LIMITS.maxRangeCells) {
        throw new FormulaError('#LIMIT!', `Rentang ${name}:${second.v} terlalu besar (maksimal ${LIMITS.maxRangeCells} sel).`);
      }
      return { type: 'range', from, to: end, text: `${name}:${second.v}` };
    }
    return { type: 'ref', addr, text: name };
  }
}

export function parseFormula(formula: string): Node {
  const src = formula.startsWith('=') ? formula.slice(1) : formula;
  if (src.length > LIMITS.maxFormulaLength) {
    throw new FormulaError('#LIMIT!', `Rumus terlalu panjang (maksimal ${LIMITS.maxFormulaLength} karakter).`);
  }
  return new Parser(tokenize(src)).parse();
}
