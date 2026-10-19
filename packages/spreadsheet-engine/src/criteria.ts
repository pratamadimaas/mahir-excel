import { type Scalar } from './types';

export type Matcher = (cell: Scalar) => boolean;

const NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

function wildcardToRegExp(pattern: string): RegExp {
  let re = '';
  for (const ch of pattern) {
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

/**
 * Membuat fungsi pencocok dari kriteria ala COUNTIF/SUMIF.
 * Contoh: ">=50", "<>Lunas", "Beras", "A*", 100.
 */
export function buildMatcher(criteria: Scalar): Matcher {
  if (typeof criteria === 'number') return (c) => typeof c === 'number' && c === criteria;
  if (typeof criteria === 'boolean') return (c) => typeof c === 'boolean' && c === criteria;
  if (criteria === null) return (c) => typeof c === 'number' && c === 0;

  const m = /^(>=|<=|<>|>|<|=)?(.*)$/s.exec(criteria)!;
  const op = m[1] ?? '=';
  const operand = m[2]!;

  if (NUM_RE.test(operand.trim())) {
    const n = Number(operand);
    switch (op) {
      case '>':
        return (c) => typeof c === 'number' && c > n;
      case '<':
        return (c) => typeof c === 'number' && c < n;
      case '>=':
        return (c) => typeof c === 'number' && c >= n;
      case '<=':
        return (c) => typeof c === 'number' && c <= n;
      case '<>':
        return (c) => !(typeof c === 'number' && c === n);
      default:
        return (c) => typeof c === 'number' && c === n;
    }
  }

  if (op === '=' || op === '<>') {
    const lower = operand.toLowerCase();
    const hasWildcard = /[*?]/.test(operand);
    const re = hasWildcard ? wildcardToRegExp(operand) : null;
    const eq = (c: Scalar): boolean => {
      if (operand === '') return c === null || c === '';
      if (typeof c !== 'string') return false;
      return re ? re.test(c) : c.toLowerCase() === lower;
    };
    return op === '=' ? eq : (c) => !eq(c);
  }

  // Perbandingan teks (">" "<" ...) hanya untuk sel teks, urutan alfabet tidak peka huruf besar/kecil.
  const lower = operand.toLowerCase();
  return (c) => {
    if (typeof c !== 'string') return false;
    const v = c.toLowerCase();
    if (op === '>') return v > lower;
    if (op === '<') return v < lower;
    if (op === '>=') return v >= lower;
    return v <= lower;
  };
}
