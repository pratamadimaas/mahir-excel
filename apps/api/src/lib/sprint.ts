import { Sheet, formatValue, isError, indexToCol } from '@excellab/spreadsheet-engine';

/**
 * Pembuat soal Sprint: tak terbatas, dibuat server, dan kuncinya dihitung oleh mesin rumus sungguhan
 * (bukan ditulis tangan), jadi kunci tidak mungkin melenceng dari perilaku playground.
 * Semua fungsi menerima `rng` agar bisa diuji dengan benih tetap.
 */
export type Rng = () => number;
export type Cell = string | number;

export interface SprintQuestion {
  kind: 'hasil' | 'galat' | 'shortcut';
  prompt: string;
  /** Tabel data (baris demi baris) tempat rumus dihitung; kosong untuk soal shortcut. */
  table: Cell[][];
  formula: string | null;
  options: string[];
  /** Indeks jawaban benar di `options`. Tidak pernah dikirim ke klien sebelum dijawab. */
  answerIndex: number;
}

export const OPTION_COUNT = 4;

const int = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[int(rng, 0, arr.length - 1)]!;
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(rng, 0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function toCells(table: Cell[][]): Record<string, string> {
  const out: Record<string, string> = {};
  table.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== '') out[`${indexToCol(c)}${r + 1}`] = String(v);
    }),
  );
  return out;
}

/** Hasil rumus pada tabel, sebagai teks tampilan; galat dikembalikan sebagai kodenya. */
function evalShown(table: Cell[][], formula: string): string {
  const sheet = new Sheet({ ...toCells(table), Z99: formula });
  const v = sheet.getValue('Z99');
  if (isError(v)) return v.code;
  if (typeof v === 'number') return formatValue(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v ?? '');
}

/** Menyusun pilihan: kunci + pengecoh unik (dari rumus salah yang "masuk akal"), lalu diacak. */
function buildOptions(rng: Rng, correct: string, plausible: string[], filler: () => string): { options: string[]; answerIndex: number } {
  const set: string[] = [];
  for (const d of shuffle(rng, plausible)) {
    if (d !== correct && !set.includes(d) && d !== '') set.push(d);
    if (set.length === OPTION_COUNT - 1) break;
  }
  let guard = 0;
  while (set.length < OPTION_COUNT - 1 && guard++ < 50) {
    const f = filler();
    if (f !== correct && !set.includes(f)) set.push(f);
  }
  const options = shuffle(rng, [correct, ...set]);
  return { options, answerIndex: options.indexOf(correct) };
}

const numbers = (rng: Rng, n: number, lo: number, hi: number): number[] => Array.from({ length: n }, () => int(rng, lo, hi));
const column = (values: Cell[]): Cell[][] => values.map((v) => [v]);
const range = (n: number): string => `A1:A${n}`;

type Gen = (rng: Rng) => { table: Cell[][]; formula: string; plausible: string[]; filler?: () => string };

/* ---------- Soal hasil rumus ---------- */
const LEVEL0: Gen[] = [
  (rng) => {
    const v = numbers(rng, 5, 2, 40);
    const t = column(v);
    return {
      table: t,
      formula: `=SUM(${range(5)})`,
      plausible: [`=SUM(A1:A4)`, `=SUM(A2:A5)`, `=AVERAGE(${range(5)})`, `=MAX(${range(5)})`, `=COUNT(${range(5)})`].map((f) =>
        evalShown(t, f),
      ),
    };
  },
  (rng) => {
    const v = numbers(rng, 5, 3, 90);
    const t = column(v);
    return {
      table: t,
      formula: `=MAX(${range(5)})`,
      plausible: [`=MIN(${range(5)})`, `=SUM(${range(5)})`, `=AVERAGE(${range(5)})`, `=MAX(A1:A4)`].map((f) => evalShown(t, f)),
    };
  },
  (rng) => {
    const v = numbers(rng, 5, 3, 90);
    const t = column(v);
    return {
      table: t,
      formula: `=MIN(${range(5)})`,
      plausible: [`=MAX(${range(5)})`, `=SUM(${range(5)})`, `=AVERAGE(${range(5)})`, `=MIN(A2:A5)`].map((f) => evalShown(t, f)),
    };
  },
  (rng) => {
    // Rata-rata bulat: empat angka bebas, angka kelima menggenapkan jumlah ke kelipatan lima.
    const four = numbers(rng, 4, 4, 30);
    const fifth = 5 - (four.reduce((a, b) => a + b, 0) % 5) + 5 * int(rng, 0, 3);
    const t = column([...four, fifth]);
    return {
      table: t,
      formula: `=AVERAGE(${range(5)})`,
      plausible: [`=SUM(${range(5)})`, `=MAX(${range(5)})`, `=MIN(${range(5)})`]
        .map((f) => evalShown(t, f))
        .concat([String(int(rng, 2, 60))]),
    };
  },
  (rng) => {
    // COUNT mengabaikan teks, COUNTA tidak.
    const v: Cell[] = numbers(rng, 5, 1, 50);
    const textAt = int(rng, 0, 4);
    v[textAt] = pick(rng, ['n/a', 'kosong', 'belum', 'tunda']);
    const t = column(v);
    return {
      table: t,
      formula: `=COUNT(${range(5)})`,
      plausible: [`=COUNTA(${range(5)})`, `=SUM(${range(5)})`, `=COUNT(A1:A4)`, `=MAX(${range(5)})`].map((f) => evalShown(t, f)),
    };
  },
];

const LEVEL1: Gen[] = [
  (rng) => {
    const v = numbers(rng, 6, 10, 90);
    const k = int(rng, 3, 7) * 10;
    const t = column(v);
    return {
      table: t,
      formula: `=COUNTIF(${range(6)};">${k}")`,
      plausible: [
        `=COUNTIF(${range(6)};">=${k}")`,
        `=COUNTIF(${range(6)};"<${k}")`,
        `=COUNT(${range(6)})`,
        `=COUNTIF(${range(6)};"${k}")`,
      ].map((f) => evalShown(t, f)),
    };
  },
  (rng) => {
    const v = numbers(rng, 6, 10, 90);
    const k = int(rng, 3, 7) * 10;
    const t = column(v);
    return {
      table: t,
      formula: `=SUMIF(${range(6)};">${k}")`,
      plausible: [`=SUMIF(${range(6)};"<${k}")`, `=SUM(${range(6)})`, `=COUNTIF(${range(6)};">${k}")`, `=SUMIF(${range(6)};">=${k}")`].map(
        (f) => evalShown(t, f),
      ),
    };
  },
  (rng) => {
    const nilai = int(rng, 55, 85);
    const batas = int(rng, 60, 80);
    const t: Cell[][] = [[nilai]];
    return {
      table: t,
      formula: `=IF(A1>=${batas};"Lulus";"Remedial")`,
      plausible: ['Lulus', 'Remedial', 'TRUE', 'FALSE'],
    };
  },
  (rng) => {
    const x = int(rng, 1000, 9999) / 1000; // 1,234
    const t: Cell[][] = [[x]];
    const digits = pick(rng, [0, 1, 2]);
    return {
      table: t,
      formula: `=ROUND(A1;${digits})`,
      plausible: [0, 1, 2, 3].map((d) => evalShown(t, `=ROUND(A1;${d})`)).concat([String(Math.floor(x))]),
    };
  },
  (rng) => {
    const prefix = pick(rng, ['BRS', 'KAS', 'INV', 'PRJ', 'ABC']);
    const num = int(rng, 2020, 2029);
    const n = int(rng, 2, 3);
    const code = `${prefix}-${num}`;
    const t: Cell[][] = [[code]];
    const kind = pick(rng, ['LEFT', 'RIGHT', 'LEN'] as const);
    const formula = kind === 'LEN' ? '=LEN(A1)' : `=${kind}(A1;${n})`;
    return {
      table: t,
      formula,
      plausible: [`=LEFT(A1;${n})`, `=RIGHT(A1;${n})`, `=LEN(A1)`, `=MID(A1;2;${n})`, `=LEFT(A1;${n + 1})`].map((f) => evalShown(t, f)),
    };
  },
];

const LEVEL2: Gen[] = [
  (rng) => {
    const cats = ['Makan', 'Transport', 'Pulsa'];
    const rows: Cell[][] = Array.from({ length: 6 }, () => [pick(rng, cats), int(rng, 5, 60) * 1000]);
    const target = pick(rng, cats);
    const other = cats.find((c) => c !== target)!;
    return {
      table: rows,
      formula: `=SUMIF(A1:A6;"${target}";B1:B6)`,
      plausible: [`=COUNTIF(A1:A6;"${target}")`, `=SUM(B1:B6)`, `=SUMIF(A1:A6;"${other}";B1:B6)`, `=MAX(B1:B6)`].map((f) =>
        evalShown(rows, f),
      ),
    };
  },
  (rng) => {
    const names = shuffle(rng, ['Budi', 'Sari', 'Dewi', 'Andi', 'Rina']).slice(0, 4);
    const rows: Cell[][] = names.map((n) => [n, int(rng, 60, 99)]);
    const key = pick(rng, names);
    return {
      table: rows,
      formula: `=VLOOKUP("${key}";A1:B4;2;FALSE)`,
      plausible: [
        `=VLOOKUP("${key}";A1:B4;1;FALSE)`,
        `=MAX(B1:B4)`,
        `=MIN(B1:B4)`,
        `=VLOOKUP("${pick(
          rng,
          names.filter((n) => n !== key),
        )}";A1:B4;2;FALSE)`,
      ].map((f) => evalShown(rows, f)),
    };
  },
  (rng) => {
    const names = shuffle(rng, ['Budi', 'Sari', 'Dewi', 'Andi', 'Rina']).slice(0, 4);
    const rows: Cell[][] = names.map((n) => [n, int(rng, 60, 99)]);
    const key = pick(rng, names);
    return {
      table: rows,
      formula: `=MATCH("${key}";A1:A4;0)`,
      plausible: ['1', '2', '3', '4', '0'],
    };
  },
  (rng) => {
    const a = int(rng, 40, 90);
    const b = int(rng, 40, 90);
    const k = int(rng, 55, 75);
    const t: Cell[][] = [[a, b]];
    return {
      table: t,
      formula: `=IF(AND(A1>=${k};B1>=${k});"Lulus";"Remedial")`,
      plausible: ['Lulus', 'Remedial', 'TRUE', 'FALSE'],
    };
  },
];

function hasil(rng: Rng, level: number): SprintQuestion {
  const pool = level >= 2 ? [...LEVEL1, ...LEVEL2] : level === 1 ? [...LEVEL0, ...LEVEL1] : LEVEL0;
  const g = pick(rng, pool)(rng);
  const correct = evalShown(g.table, g.formula);
  const filler = g.filler ?? ((): string => String(int(rng, 1, 200)));
  const { options, answerIndex } = buildOptions(rng, correct, g.plausible, filler);
  return { kind: 'hasil', prompt: 'Berapa hasil rumus ini?', table: g.table, formula: g.formula, options, answerIndex };
}

/* ---------- Soal nama galat ---------- */
const ERROR_CODES = ['#DIV/0!', '#NAME?', '#VALUE!', '#REF!', '#N/A'] as const;

function galat(rng: Rng): SprintQuestion {
  const names = ['Budi', 'Sari', 'Dewi'];
  const base: Cell[][] = names.map((n) => [n, int(rng, 60, 99)]);
  const kinds: { formula: string; table: Cell[][] }[] = [
    { formula: `=${int(rng, 2, 99)}/0`, table: [] },
    { formula: `=A1/(B1-B1)`, table: [[int(rng, 5, 90), int(rng, 5, 90)]] },
    { formula: `=${pick(rng, ['TOTALIN', 'JUMLAHKAN', 'HITUNGSEMUA', 'RATA'])}(A1:A3)`, table: column(numbers(rng, 3, 1, 50)) },
    { formula: `="${pick(rng, ['abc', 'total', 'lunas'])}"+${int(rng, 1, 9)}`, table: [] },
    { formula: `=A1:A3+1`, table: column(numbers(rng, 3, 1, 50)) },
    { formula: `=VLOOKUP("Zaki";A1:B3;2;FALSE)`, table: base },
    { formula: `=VLOOKUP("${pick(rng, names)}";A1:B3;3;FALSE)`, table: base },
    { formula: `=MATCH("Zaki";A1:A3;0)`, table: base },
  ];
  const q = pick(rng, kinds);
  const correct = evalShown(q.table, q.formula);
  if (!(ERROR_CODES as readonly string[]).includes(correct))
    throw new Error(`soal galat tidak menghasilkan galat: ${q.formula} -> ${correct}`);
  const { options, answerIndex } = buildOptions(rng, correct, [...ERROR_CODES], () => pick(rng, ERROR_CODES));
  return { kind: 'galat', prompt: 'Galat apa yang muncul?', table: q.table, formula: q.formula, options, answerIndex };
}

/* ---------- Soal shortcut ---------- */
export interface ShortcutItem {
  action: string;
  keysWindows: string;
}

/** Hanya kombinasi tunggal yang jelas (tanpa "atau", garis miring, atau tanda kurung) yang dipakai sebagai soal. */
export function usableShortcuts(list: { action: string; keysWindows: string | null }[]): ShortcutItem[] {
  return list
    .filter((s): s is ShortcutItem => !!s.keysWindows && !/[/(),]|\batau\b|\bdan\b/i.test(s.keysWindows) && s.keysWindows.length <= 24)
    .map((s) => ({ action: s.action, keysWindows: s.keysWindows }));
}

function shortcut(rng: Rng, pool: ShortcutItem[]): SprintQuestion {
  const target = pick(rng, pool);
  const others = pool.filter((s) => s.keysWindows !== target.keysWindows).map((s) => s.keysWindows);
  const { options, answerIndex } = buildOptions(rng, target.keysWindows, shuffle(rng, others).slice(0, 12), () => pick(rng, others));
  return { kind: 'shortcut', prompt: `Shortcut Windows untuk: ${target.action}`, table: [], formula: null, options, answerIndex };
}

/** Membuat soal berikutnya. Makin panjang rentetan benar, makin sulit; soal galat dan shortcut diselipkan. */
export function nextQuestion(rng: Rng, streak: number, shortcuts: ShortcutItem[]): SprintQuestion {
  const level = streak >= 8 ? 2 : streak >= 4 ? 1 : 0;
  const r = rng();
  if (r < 0.16) return galat(rng);
  if (r < 0.3 && shortcuts.length >= 8) return shortcut(rng, shortcuts);
  return hasil(rng, level);
}

/* ---------- Skor ---------- */
export const POINTS_CORRECT = 10;
export const STREAK_BONUS = 2;
export const STREAK_BONUS_CAP = 5;
export const PENALTY_WRONG = 5;

/** Benar: 10 poin + 2 per rentetan benar sebelumnya (maks. 5 rentetan). Salah: -5 dan rentetan putus. Skor tidak turun di bawah 0. */
export function applyAnswer(state: { score: number; streak: number }, correct: boolean): { score: number; streak: number; delta: number } {
  if (correct) {
    const delta = POINTS_CORRECT + STREAK_BONUS * Math.min(state.streak, STREAK_BONUS_CAP);
    return { score: state.score + delta, streak: state.streak + 1, delta };
  }
  const score = Math.max(0, state.score - PENALTY_WRONG);
  return { score, streak: 0, delta: score - state.score };
}

/* ---------- Nama pemain ---------- */
export function cleanName(raw: string): string | null {
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 20) return null;
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(name)) return null;
  if (/https?|www|\.(com|id|net|org|co|io|me|xyz)\b|@/i.test(name)) return null;
  return name;
}
