import { FormulaError } from './types';

export type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'sep' }
  | { t: 'colon' };

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';

/**
 * Tokenizer rumus. Pemisah argumen "," dan ";" sama-sama diterima
 * (Excel berbahasa Indonesia memakai ";" pada banyak pengaturan regional).
 * Desimal di dalam rumus selalu memakai titik (3.5).
 */
export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
    } else if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1]))) {
      let j = i;
      while (isDigit(src[j])) j++;
      if (src[j] === '.') {
        j++;
        while (isDigit(src[j])) j++;
      }
      const num = Number(src.slice(i, j));
      if (!Number.isFinite(num)) {
        throw new FormulaError('#ERROR!', `Angka "${src.slice(i, j)}" tidak valid.`);
      }
      out.push({ t: 'num', v: num });
      i = j;
    } else if (ch === '"') {
      let j = i + 1;
      let s = '';
      let closed = false;
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        s += src[j];
        j++;
      }
      if (!closed) throw new FormulaError('#ERROR!', 'Teks diawali tanda kutip (") tetapi tidak ditutup.');
      out.push({ t: 'str', v: s });
      i = j;
    } else if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$.]/.test(src[j]!)) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
    } else if (ch === '(') {
      out.push({ t: 'lp' });
      i++;
    } else if (ch === ')') {
      out.push({ t: 'rp' });
      i++;
    } else if (ch === ',' || ch === ';') {
      out.push({ t: 'sep' });
      i++;
    } else if (ch === ':') {
      out.push({ t: 'colon' });
      i++;
    } else if (ch === '<' || ch === '>') {
      const two = src.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '<>') {
        out.push({ t: 'op', v: two });
        i += 2;
      } else {
        out.push({ t: 'op', v: ch });
        i++;
      }
    } else if ('+-*/^&=%'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else {
      throw new FormulaError('#ERROR!', `Karakter "${ch}" tidak dikenali dalam rumus.`);
    }
  }
  return out;
}
