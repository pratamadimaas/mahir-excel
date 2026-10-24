import ExcelJS from 'exceljs';
import { Sheet, colToIndex, expandRef, indexToCol, isError, type Value } from '@excellab/spreadsheet-engine';

/** Isi sel: teks, angka, rumus (tanpa "="), atau tanggal "YYYY-MM-DD". */
export type TCell = string | number | { f: string } | { d: string };

export interface TSheet {
  name: string;
  widths: number[];
  cells: Record<string, TCell>;
  /** Sel/rentang judul besar. */
  title?: string[];
  /** Sel/rentang judul kolom. */
  head?: string[];
  /** Sel/rentang yang diisi pengguna (latar kuning muda). */
  input?: string[];
  /** Sel/rentang total (tebal, garis atas). */
  total?: string[];
  /** Catatan kecil (abu-abu, miring). */
  note?: string[];
  /** Format angka per sel atau rentang. */
  fmt?: Record<string, string>;
  /** Daftar pilihan (dropdown) per rentang: rumus rentang atau daftar bertanda kutip. */
  lists?: Record<string, string>;
  /** Pewarnaan bersyarat: rumus ditulis untuk sel kiri atas rentang. */
  cf?: { range: string; formula: string; fill: string; font: string }[];
  /** Jumlah baris yang dibekukan. */
  freeze?: number;
  /** Teks panjang diberi pembungkus. */
  wrap?: string[];
}

export const RP = '"Rp" #,##0';
export const DATE = 'dd/mm/yyyy';
export const PCT = '0%';

const GREEN = 'FF217346';
const GREEN_DARK = 'FF185C37';
const GREEN_LIGHT = 'FFE6F2EA';
const INPUT_FILL = 'FFFFF8DC';
const BORDER = { style: 'thin' as const, color: { argb: 'FFD9DED9' } };

const toSerial = (d: string): number => (Date.parse(`${d}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
const toDate = (d: string): Date => new Date(`${d}T00:00:00Z`);

const isFormulaCell = (c: TCell): c is { f: string } => typeof c === 'object' && 'f' in c;
const isDateCell = (c: TCell): c is { d: string } => typeof c === 'object' && 'd' in c;

/**
 * Mesin Mahir Excel satu lembar. Untuk menghitung rumus antar sheet, semua sheet diletakkan berdampingan
 * dalam satu grid (sheet ke-k digeser 30 kolom) dan acuan "Sheet!A1" ditulis ulang ke posisi geser itu.
 * Hanya dipakai untuk menghitung hasil (nilai awal di berkas dan tes); berkas .xlsx tetap berisi rumus asli.
 */
const OFFSET = 30;
const REF_RE = /"(?:[^"]|"")*"|(?:(?:'[^']+'|[A-Za-z][A-Za-z0-9_]*)!)?\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?(?![A-Za-z0-9_(])/g;

function shiftRef(ref: string, by: number): string {
  return ref.replace(/(\$?)([A-Z]{1,3})(\$?\d+)/, (_m, d1: string, col: string, rest: string) => `${d1}${indexToCol(colToIndex(col) + by)}${rest}`);
}

export function rewriteFormula(formula: string, own: number, indexOf: (name: string) => number): string {
  return formula.replace(REF_RE, (m) => {
    if (m.startsWith('"')) return m;
    const bang = m.lastIndexOf('!');
    let idx = own;
    let body = m;
    if (bang >= 0) {
      const raw = m.slice(0, bang);
      const name = raw.startsWith("'") ? raw.slice(1, -1) : raw;
      idx = indexOf(name);
      if (idx < 0) throw new Error(`Sheet tidak dikenal di rumus: ${name}`);
      body = m.slice(bang + 1);
    }
    return body
      .split(':')
      .map((p) => shiftRef(p, idx * OFFSET))
      .join(':');
  });
}

export function computeValues(sheets: TSheet[], now: Date = new Date()): Record<string, Record<string, Value>> {
  const indexOf = (name: string): number => sheets.findIndex((s) => s.name === name);
  const grid: Record<string, string> = {};
  sheets.forEach((s, k) => {
    for (const [ref, c] of Object.entries(s.cells)) {
      const key = shiftRef(ref, k * OFFSET);
      if (isFormulaCell(c)) grid[key] = `=${rewriteFormula(c.f, k, indexOf)}`;
      else if (isDateCell(c)) grid[key] = String(toSerial(c.d));
      else grid[key] = String(c);
    }
  });
  const engine = new Sheet(grid, { now });
  const out: Record<string, Record<string, Value>> = {};
  sheets.forEach((s, k) => {
    const vals: Record<string, Value> = {};
    for (const ref of Object.keys(s.cells)) vals[ref] = engine.getValue(shiftRef(ref, k * OFFSET));
    out[s.name] = vals;
  });
  return out;
}

function eachRef(refs: string[] | undefined, fn: (ref: string) => void): void {
  for (const r of refs ?? []) for (const ref of expandRef(r)) fn(ref);
}

export function writeWorkbook(title: string, sheets: TSheet[], now: Date = new Date()): ExcelJS.Workbook {
  const values = computeValues(sheets, now);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mahir Excel';
  wb.title = title;
  wb.created = now;
  wb.calcProperties = { fullCalcOnLoad: true };

  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name, { views: spec.freeze ? [{ state: 'frozen', ySplit: spec.freeze }] : [] });
    spec.widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const vals = values[spec.name]!;
    for (const [ref, c] of Object.entries(spec.cells)) {
      const cell = ws.getCell(ref);
      if (isFormulaCell(c)) {
        const v = vals[ref];
        if (isError(v)) throw new Error(`Rumus ${spec.name}!${ref} menghasilkan galat ${v.code}: ${c.f}`);
        cell.value = { formula: c.f, result: (v ?? undefined) as string | number | boolean | undefined };
      } else if (isDateCell(c)) {
        cell.value = toDate(c.d);
        cell.numFmt = DATE;
      } else cell.value = c;
      cell.alignment = { vertical: 'middle' };
    }
    eachRef(spec.input, (ref) => {
      const cell = ws.getCell(ref);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    });
    eachRef(spec.head, (ref) => {
      const cell = ws.getCell(ref);
      cell.font = { bold: true, color: { argb: GREEN_DARK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } };
      cell.border = { bottom: { style: 'thin', color: { argb: GREEN } } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    eachRef(spec.title, (ref) => (ws.getCell(ref).font = { bold: true, size: 16, color: { argb: GREEN_DARK } }));
    eachRef(spec.total, (ref) => {
      const cell = ws.getCell(ref);
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin', color: { argb: GREEN } } };
    });
    eachRef(spec.note, (ref) => (ws.getCell(ref).font = { italic: true, size: 9, color: { argb: 'FF6B7280' } }));
    for (const [rng, fmt] of Object.entries(spec.fmt ?? {})) eachRef([rng], (ref) => (ws.getCell(ref).numFmt = fmt));
    for (const [rng, list] of Object.entries(spec.lists ?? {})) {
      eachRef([rng], (ref) => {
        ws.getCell(ref).dataValidation = { type: 'list', allowBlank: true, formulae: [list], showErrorMessage: false };
      });
    }
    eachRef(spec.wrap, (ref) => {
      const cell = ws.getCell(ref);
      cell.alignment = { vertical: 'top', wrapText: true };
    });
    for (const rule of spec.cf ?? []) {
      ws.addConditionalFormatting({
        ref: rule.range,
        rules: [
          {
            type: 'expression',
            formulae: [rule.formula],
            priority: 1,
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: rule.fill } },
              font: { color: { argb: rule.font }, bold: true },
            },
          },
        ],
      });
    }
  }
  return wb;
}

export const col = (n: number): string => indexToCol(n);
