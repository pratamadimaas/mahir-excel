import type ExcelJS from 'exceljs';
import { expandRef, indexToCol } from '@excellab/spreadsheet-engine';
import type { PublicExercise } from '@excellab/shared';

/** Nama sheet soal; posisi sel di sheet ini sama persis dengan di playground (A1, B2, dst.). */
export const SHEET_NAME = 'Latihan';
const NOTES_SHEET = 'Petunjuk';
/** Sheet tersembunyi berisi penanda latihan. Hanya dipakai untuk memperingatkan bila file salah latihan. */
const MARK_SHEET = '_mahirexcel';
const MARK_TAG = 'mahir-excel-latihan';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

const GREEN = 'FFE3F4EA';
const GREEN_LINE = 'FF8CC9A4';

async function loadExcelJS(): Promise<typeof ExcelJS> {
  const mod = (await import('exceljs')) as unknown as { default?: typeof ExcelJS } & typeof ExcelJS;
  return mod.default ?? mod;
}

/** Rumus playground boleh memakai `;`; berkas Excel selalu menyimpan rumus dengan koma. */
export function excelFormula(raw: string): string {
  let out = '';
  let quoted = false;
  for (const ch of raw.slice(1)) {
    if (ch === '"') quoted = !quoted;
    out += ch === ';' && !quoted ? ',' : ch;
  }
  return out;
}

const PLAIN_NUMBER = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/;

/** Isi mentah sel playground menjadi nilai berkas Excel: angka asli, rumus, atau teks. */
export function toCellValue(raw: string): string | number | { formula: string } | null {
  if (raw === '') return null;
  if (raw.startsWith('=')) return { formula: excelFormula(raw) };
  if (PLAIN_NUMBER.test(raw)) return Number(raw); // "007" atau angka sangat panjang tetap teks
  return raw;
}

const excelSerial = (d: Date): number => Math.round(((d.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000) * 1e6) / 1e6;

/** Kebalikan toCellValue: isi sel berkas Excel menjadi teks mentah yang dimengerti penilai. */
export function fromCell(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return String(excelSerial(v));
  if ('formula' in v || 'sharedFormula' in v) {
    // Mengisi ke bawah di Excel membuat rumus bersama; cell.formula sudah menerjemahkannya per sel.
    const f = cell.formula;
    return f ? `=${f}` : '';
  }
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('error' in v) return String(v.error);
  if ('text' in v) return String(v.text);
  return '';
}

const normalize = (s: string): string => {
  const t = s.trim();
  if (t.startsWith('=')) return `=${excelFormula(t).replace(/\s+/g, '').toUpperCase()}`;
  if (PLAIN_NUMBER.test(t)) return String(Number(t));
  return t.replace(/\s+/g, ' ');
};

/** Sama menurut Excel: spasi dan huruf besar/kecil dalam rumus, serta 5 dan 5.0, tidak dianggap perubahan. */
export const sameCell = (a: string, b: string): boolean => normalize(a) === normalize(b);

const refsOf = (ex: Pick<PublicExercise, 'editable'>): string[] => ex.editable.flatMap((e) => expandRef(e));

function instructions(wb: ExcelJS.Workbook, ex: PublicExercise): void {
  const ws = wb.addWorksheet(NOTES_SHEET);
  ws.getColumn(1).width = 96;
  const lines: Array<[string, boolean]> = [
    [ex.title, true],
    ['', false],
    ['Tugas', true],
    [ex.task, false],
    ['', false],
    ['Cara mengerjakan', true],
    ['1. Kalau Excel membuka file ini dalam mode baca saja (Protected View), klik Enable Editing.', false],
    [`2. Isi sel berwarna hijau di sheet "${SHEET_NAME}". Sel lain dikunci karena itu data soal.`, false],
    ['3. Kalau tugas meminta rumus, tulis rumusnya (diawali tanda =), jangan mengetik hasilnya.', false],
    ['4. Simpan dengan Ctrl+S tetap sebagai .xlsx, lalu unggah file ini di halaman latihan.', false],
    ['', false],
    ['Catatan', true],
    [`Jangan mengganti nama sheet "${SHEET_NAME}" dan jangan menyisipkan atau menghapus baris dan kolom, supaya posisi sel tetap sama.`, false],
    ['Kalau data soal sempat terubah, jawabanmu tetap dinilai dengan data aslinya.', false],
    ['mahirexcel.online', false],
  ];
  lines.forEach(([text, bold], i) => {
    const cell = ws.getCell(i + 1, 1);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (bold) cell.font = { bold: true, size: i === 0 ? 14 : 11, color: { argb: 'FF14573A' } };
  });
}

/** Membuat berkas .xlsx latihan: soal terkunci, sel jawaban hijau dan terbuka, penanda latihan tersembunyi. */
export async function buildExerciseWorkbook(ex: PublicExercise): Promise<ExcelJS.Workbook> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Mahir Excel';
  wb.title = ex.title;
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET_NAME);
  const answerCells = new Set(refsOf(ex));
  for (let c = 1; c <= ex.cols; c++) ws.getColumn(c).width = 16;
  for (let r = 1; r <= ex.rows; r++) {
    for (let c = 1; c <= ex.cols; c++) {
      const ref = `${indexToCol(c - 1)}${r}`;
      const cell = ws.getCell(ref);
      const value = toCellValue(ex.cells[ref] ?? '');
      if (value !== null) cell.value = value;
      const open = answerCells.has(ref);
      cell.protection = { locked: !open };
      if (open) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
        const edge = { style: 'thin' as const, color: { argb: GREEN_LINE } };
        cell.border = { top: edge, left: edge, bottom: edge, right: edge };
      }
    }
  }
  // Tanpa sandi: hanya pengaman supaya data soal tidak terhapus tak sengaja. Perubahan tetap dideteksi saat diunggah.
  await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true });

  instructions(wb, ex);
  const mark = wb.addWorksheet(MARK_SHEET);
  mark.state = 'veryHidden';
  mark.getCell('A1').value = MARK_TAG;
  mark.getCell('A2').value = ex.slug;
  wb.views = [{ x: 0, y: 0, width: 12000, height: 8000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  return wb;
}

export async function buildExerciseFile(ex: PublicExercise): Promise<Uint8Array> {
  const wb = await buildExerciseWorkbook(ex);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export interface AnswerFile {
  /** Isi sel jawaban (semua sel yang boleh diisi; kosong berarti belum diisi). */
  answers: Record<string, string>;
  /** Sel data soal yang isinya berbeda dari aslinya. Penilaian tetap memakai data asli. */
  changed: string[];
  /** File ini dibuat untuk latihan lain. */
  otherExercise: string | null;
}

export class AnswerFileError extends Error {}

async function readBytes(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });
}

/** Membaca berkas jawaban. Hanya isi sel yang diambil; hasil hitung tersimpan di berkas tidak dipakai. */
export async function readAnswerFile(file: Blob & { name?: string }, ex: PublicExercise): Promise<AnswerFile> {
  if (file.size > MAX_FILE_BYTES) throw new AnswerFileError('Berkas terlalu besar. Batasnya 2 MB; pakai berkas yang diunduh dari halaman ini.');
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  try {
    await wb.xlsx.load(await readBytes(file));
  } catch {
    throw new AnswerFileError('Berkas tidak bisa dibaca. Pastikan formatnya .xlsx (bukan .xls atau .csv) dan simpan ulang dari Excel.');
  }
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets.find((w) => w.state === 'visible' && w.name !== NOTES_SHEET);
  if (!ws) throw new AnswerFileError(`Sheet "${SHEET_NAME}" tidak ditemukan. Jangan mengganti nama sheet soal.`);

  const mark = wb.getWorksheet(MARK_SHEET);
  const slug = mark && mark.getCell('A1').value === MARK_TAG ? String(mark.getCell('A2').value ?? '') : '';
  const otherExercise = slug && slug !== ex.slug ? slug : null;

  const open = new Set(refsOf(ex));
  const answers: Record<string, string> = {};
  for (const ref of open) answers[ref] = fromCell(ws.getCell(ref));

  const changed: string[] = [];
  for (let r = 1; r <= ex.rows; r++) {
    for (let c = 1; c <= ex.cols; c++) {
      const ref = `${indexToCol(c - 1)}${r}`;
      if (open.has(ref)) continue;
      if (!sameCell(ex.cells[ref] ?? '', fromCell(ws.getCell(ref)))) changed.push(ref);
    }
  }
  return { answers, changed, otherExercise };
}
