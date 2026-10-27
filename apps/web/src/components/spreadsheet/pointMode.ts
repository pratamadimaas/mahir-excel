import { addrToRef, parseCellRef } from '@excellab/spreadsheet-engine';

/** Teks alamat sel yang baru disisipkan lewat klik, supaya klik berikutnya menggantinya (seperti Excel). */
export interface PointSpan {
  start: number;
  end: number;
  text: string;
}

const OPENERS = new Set(['=', '(', ',', ';', '+', '-', '*', '/', '^', '&', '<', '>']);

const inQuotes = (text: string, caret: number): boolean => ((text.slice(0, caret).match(/"/g) ?? []).length & 1) === 1;

export function spanValid(text: string, caret: number, span: PointSpan | null): span is PointSpan {
  return !!span && span.end === caret && text.slice(span.start, span.end) === span.text;
}

/** Benar bila klik sel sekarang harus menyisipkan alamatnya, bukan memindahkan sel terpilih. */
export function canPoint(text: string, caret: number, span: PointSpan | null): boolean {
  if (!text.startsWith('=') || inQuotes(text, caret)) return false;
  if (spanValid(text, caret, span)) return true;
  let i = caret - 1;
  while (i >= 0 && text[i] === ' ') i--;
  return i >= 0 && OPENERS.has(text[i]!);
}

/** Menyisipkan `ref` di posisi kursor, atau mengganti alamat yang baru saja disisipkan. */
export function pointAt(text: string, caret: number, ref: string, span: PointSpan | null): { text: string; caret: number; span: PointSpan } {
  const replace = spanValid(text, caret, span);
  const start = replace ? span.start : caret;
  const end = replace ? span.end : caret;
  const next = text.slice(0, start) + ref + text.slice(end);
  const at = start + ref.length;
  return { text: next, caret: at, span: { start, end: at, text: ref } };
}

/** Alamat rentang dari dua sel (urutan bebas), mis. B6 dan B2 menjadi B2:B6. */
export function rangeText(a: string, b: string): string {
  const p = parseCellRef(a);
  const q = parseCellRef(b);
  if (!p || !q) return a;
  const from = addrToRef({ col: Math.min(p.col, q.col), row: Math.min(p.row, q.row) });
  const to = addrToRef({ col: Math.max(p.col, q.col), row: Math.max(p.row, q.row) });
  return from === to ? from : `${from}:${to}`;
}

const REF_RE = /\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?/g;

/** F4: mengganti referensi di kursor antara B2, $B$2, B$2, dan $B2. Mengembalikan null bila kursor tidak di referensi. */
export function cycleAbsolute(text: string, caret: number): { text: string; caret: number } | null {
  if (!text.startsWith('=')) return null;
  for (const m of text.matchAll(REF_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (caret < start || caret > end || inQuotes(text, start)) continue;
    if (/[A-Za-z0-9_.]/.test(text[start - 1] ?? '') || /[A-Za-z0-9_(]/.test(text[end] ?? '')) continue; // bagian dari nama lain
    const parts = m[0].split(':').map((p) => /^(\$?)([A-Z]+)(\$?)(\d+)$/.exec(p)!);
    const first = parts[0]!;
    const col = first[1] === '$';
    const row = first[3] === '$';
    // B2 -> $B$2 -> B$2 -> $B2 -> B2
    const [nc, nr] = !col && !row ? [true, true] : col && row ? [false, true] : !col && row ? [true, false] : [false, false];
    const out = parts.map((p) => `${nc ? '$' : ''}${p[2]}${nr ? '$' : ''}${p[4]}`).join(':');
    return { text: text.slice(0, start) + out + text.slice(end), caret: start + out.length };
  }
  return null;
}
