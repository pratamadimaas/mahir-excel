import ExcelJS from 'exceljs';
import type { Built, Cell, DatasetSpec, Fmt } from './kit';

export const DATA_SHEET = 'Data';
export const ANSWER_SHEET = 'Jawaban';
export const MARK_SHEET = '_mahirexcel';
export const MARK_TAG = 'mahir-excel-data';
/** Baris pertama tugas di sheet Jawaban dan kolom isian (C). */
export const FIRST_ANSWER_ROW = 2;

const NUM_FMT: Record<NonNullable<Fmt>, string> = {
  date: 'dd/mm/yyyy',
  time: 'hh:mm',
  rp: '#,##0',
  int: '0',
  dec: '0.0',
};

const GREEN = 'FFE2F0E8';
const YELLOW = 'FFFFF2CC';

const pad2 = (n: number): string => String(n).padStart(2, '0');

function csvCell(v: Cell, fmt: Fmt): string {
  if (v === null) return '';
  if (v instanceof Date) {
    return fmt === 'time'
      ? `${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}`
      : `${pad2(v.getUTCDate())}/${pad2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = String.fromCharCode(0xfeff);

/** CSV dengan BOM supaya Excel membaca huruf Indonesia dengan benar. */
export function buildCsv(data: Built): string {
  const lines = [data.headers.map((h) => csvCell(h, undefined)).join(',')];
  for (const row of data.rows) lines.push(row.map((v, i) => csvCell(v, data.fmt?.[i])).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/** Teks sel seperti yang tampil di Excel, untuk pratinjau di katalog. */
function previewCell(v: Cell, fmt: Fmt): string {
  if (v === null) return '';
  if (v instanceof Date) return csvCell(v, fmt);
  return String(v);
}

/** Judul kolom dan baris pertama saja, supaya pengunjung bisa melihat isi sebelum mendaftar. */
export function buildPreview(data: Built, limit = 10): { headers: string[]; rows: string[][]; total: number } {
  return {
    headers: data.headers,
    rows: data.rows.slice(0, limit).map((row) => row.map((v, i) => previewCell(v, data.fmt?.[i]))),
    total: data.rows.length,
  };
}

export function buildDatasetWorkbook(spec: DatasetSpec, data: Built): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mahir Excel';
  wb.title = spec.title;
  wb.created = new Date(Date.UTC(2026, 0, 1));

  const notes = wb.addWorksheet('Petunjuk');
  notes.getColumn(1).width = 96;
  const lines: [string, boolean][] = [
    [spec.title, true],
    ['', false],
    [spec.blurb, false],
    ['', false],
    ['Kondisi data', true],
    [spec.mess, false],
    ['', false],
    ['Cara mengerjakan', true],
    [
      `1. Sheet "${DATA_SHEET}" berisi datanya (${data.rows.length} baris). Jangan diubah urutan atau posisinya, supaya jawabanmu bisa diperiksa.`,
      false,
    ],
    [`2. Baca tiga tugas di sheet "${ANSWER_SHEET}", lalu tulis jawabanmu di sel kuning pada kolom C.`, false],
    [
      '3. Jawaban harus berupa rumus yang merujuk ke sheet Data, bukan angka yang kamu ketik. Rumus boleh memakai kolom bantu di sheet lain.',
      false,
    ],
    ['4. Simpan sebagai .xlsx dan unggah di halaman Data Latihan (pemeriksaan khusus anggota Premium).', false],
    ['', false],
    ['Semua data di sini fiktif. Tidak ada data orang atau perusahaan sungguhan.', false],
    ['mahirexcel.online', false],
  ];
  lines.forEach(([text, bold], i) => {
    const c = notes.getCell(i + 1, 1);
    c.value = text;
    c.alignment = { wrapText: true, vertical: 'top' };
    if (bold) c.font = { bold: true, size: i === 0 ? 14 : 11, color: { argb: 'FF14573A' } };
  });

  const ws = wb.addWorksheet(DATA_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  data.headers.forEach((h, c) => {
    const cell = ws.getCell(1, c + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF8CC9A4' } } };
  });
  const widths = data.headers.map((h) => h.length + 4);
  data.rows.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === null) return;
      const cell = ws.getCell(r + 2, c + 1);
      cell.value = v;
      const f = data.fmt?.[c];
      if (f && !(typeof v === 'string')) cell.numFmt = NUM_FMT[f];
      const len = v instanceof Date ? 11 : String(v).length + 2;
      if (len > widths[c]!) widths[c] = Math.min(len, 40);
    });
  });
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const ans = wb.addWorksheet(ANSWER_SHEET);
  ans.getColumn(1).width = 6;
  ans.getColumn(2).width = 80;
  ans.getColumn(3).width = 24;
  ans.getColumn(4).width = 52;
  ['No', 'Tugas', 'Jawabanmu', 'Catatan'].forEach((h, i) => {
    const cell = ans.getCell(1, i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
  });
  data.tasks.forEach((t, i) => {
    const row = FIRST_ANSWER_ROW + i;
    ans.getCell(row, 1).value = i + 1;
    const ask = ans.getCell(row, 2);
    ask.value = t.ask;
    ask.alignment = { wrapText: true, vertical: 'top' };
    const answer = ans.getCell(row, 3);
    answer.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
    answer.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    answer.alignment = { vertical: 'top' };
    const note = ans.getCell(row, 4);
    note.value = 'Tulis dengan rumus, jangan diketik langsung.';
    note.alignment = { wrapText: true, vertical: 'top' };
    ans.getRow(row).height = Math.max(48, Math.ceil(t.ask.length / 70) * 18);
  });

  const mark = wb.addWorksheet(MARK_SHEET, { state: 'veryHidden' });
  mark.getCell('A1').value = MARK_TAG;
  mark.getCell('A2').value = spec.slug;
  return wb;
}
