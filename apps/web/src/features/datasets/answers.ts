import type ExcelJS from 'exceljs';

/** Harus sama dengan apps/api/src/datasets/workbook.ts. */
const ANSWER_SHEET = 'Jawaban';
const MARK_SHEET = '_mahirexcel';
const MARK_TAG = 'mahir-excel-data';
const FIRST_ANSWER_ROW = 2;
const TASKS = 3;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface GivenCell {
  value: string | number | null;
  formula: boolean;
}

async function loadExcelJS(): Promise<typeof ExcelJS> {
  const mod = (await import('exceljs')) as unknown as { default?: typeof ExcelJS } & typeof ExcelJS;
  return mod.default ?? mod;
}

const excelSerial = (d: Date): number => Math.round(((d.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000) * 1e6) / 1e6;

function plain(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return excelSerial(v);
  if (typeof v === 'object') {
    const o = v as { error?: string; richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.error) return o.error;
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if (o.text !== undefined) return o.text;
    if ('result' in o) return plain(o.result);
  }
  return null;
}

/** Nilai tersimpan di sel (hasil rumus bila ada) dan apakah selnya berisi rumus. */
export function readGiven(cell: ExcelJS.Cell): GivenCell {
  const v = cell.value;
  if (v !== null && typeof v === 'object' && !(v instanceof Date) && ('formula' in v || 'sharedFormula' in v)) {
    return { value: plain((v as { result?: unknown }).result), formula: true };
  }
  return { value: plain(v), formula: false };
}

const readBuffer = (file: Blob): Promise<ArrayBuffer> =>
  typeof file.arrayBuffer === 'function'
    ? file.arrayBuffer()
    : new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as ArrayBuffer);
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(file);
      });

async function open(file: File): Promise<ExcelJS.Workbook> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Berkas terlalu besar. Maksimal 5 MB.');
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  try {
    await wb.xlsx.load(await readBuffer(file));
  } catch {
    throw new Error('Berkas tidak bisa dibaca. Pastikan formatnya .xlsx dan simpan lagi dari Excel.');
  }
  return wb;
}

/** Membaca tiga jawaban dari sheet Jawaban pada berkas data latihan, beserta slug dari penanda tersembunyi. */
export async function readDatasetAnswers(file: File): Promise<{ slug: string; answers: GivenCell[] }> {
  const wb = await open(file);
  const mark = wb.getWorksheet(MARK_SHEET);
  const slug = mark?.getCell('A1').value === MARK_TAG ? String(mark.getCell('A2').value ?? '') : '';
  if (!slug)
    throw new Error('Berkas ini bukan unduhan dari halaman Data Latihan. Unduh dulu file datanya, kerjakan, lalu unggah file yang sama.');
  const ws = wb.getWorksheet(ANSWER_SHEET);
  if (!ws) throw new Error(`Sheet "${ANSWER_SHEET}" tidak ditemukan. Jangan menghapus atau mengganti namanya.`);
  const answers = Array.from({ length: TASKS }, (_, i) => readGiven(ws.getCell(FIRST_ANSWER_ROW + i, 3)));
  return { slug, answers };
}

/** Membaca sel-sel jawaban worksheet. Sheet atau sel yang tidak ada dianggap kosong. */
export async function readWorksheetCells(
  file: File,
  cells: { sheet: string; ref: string }[],
): Promise<{ sheet: string; ref: string; value: string | number | null; formula: boolean }[]> {
  const wb = await open(file);
  return cells.map(({ sheet, ref }) => {
    const ws = wb.getWorksheet(sheet);
    return { sheet, ref, ...(ws ? readGiven(ws.getCell(ref)) : { value: null, formula: false }) };
  });
}
