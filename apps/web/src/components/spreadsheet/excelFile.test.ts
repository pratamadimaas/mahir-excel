import { describe, expect, it } from 'vitest';
import { exercises, toPublicExercise, validateSubmission, type PublicExercise } from '@excellab/shared';
import {
  AnswerFileError,
  MAX_FILE_BYTES,
  SHEET_NAME,
  buildExerciseWorkbook,
  excelFormula,
  readAnswerFile,
  sameCell,
  toCellValue,
} from './excelFile';

const FAST = exercises.find((e) => e.slug === 'total-harga-barang')!;
const pub = (slug = 'total-harga-barang'): PublicExercise => toPublicExercise(exercises.find((e) => e.slug === slug)!);

const asFile = (bytes: ArrayBuffer | Uint8Array, name = 'jawaban.xlsx'): File => new File([bytes as BlobPart], name);

/** Menulis berkas dari workbook dan membacanya lagi seperti pengguna yang mengunggah. */
async function roundTrip(wb: Awaited<ReturnType<typeof buildExerciseWorkbook>>): Promise<File> {
  return asFile(await wb.xlsx.writeBuffer());
}

describe('konversi isi sel', () => {
  it('toCellValue: angka asli, rumus tanpa =, teks tetap teks', () => {
    expect(toCellValue('')).toBeNull();
    expect(toCellValue('15000')).toBe(15000);
    expect(toCellValue('-3.5')).toBe(-3.5);
    expect(toCellValue('007')).toBe('007');
    expect(toCellValue('12345678901234567890')).toBe('12345678901234567890');
    expect(toCellValue('Beras')).toBe('Beras');
    expect(toCellValue('=SUM(B2:B4)')).toEqual({ formula: 'SUM(B2:B4)' });
  });

  it('excelFormula mengganti ; menjadi , kecuali di dalam tanda kutip', () => {
    expect(excelFormula('=IF(A1>1;"a;b";"c")')).toBe('IF(A1>1,"a;b","c")');
  });

  it('sameCell mengabaikan spasi, huruf besar-kecil rumus, dan 5 vs 5.0', () => {
    expect(sameCell('=sum(A1:A3)', '=SUM( A1:A3 )')).toBe(true);
    expect(sameCell('5', '5.0')).toBe(true);
    expect(sameCell('Beras', ' Beras ')).toBe(true);
    expect(sameCell('Beras', 'Gula')).toBe(false);
    expect(sameCell('15000', '16000')).toBe(false);
  });
});

describe('berkas latihan', () => {
  it('soal terkunci, sel jawaban hijau dan terbuka, sheet petunjuk dan penanda ada', async () => {
    const ex = pub();
    const wb = await buildExerciseWorkbook(ex);
    expect(wb.worksheets.map((w) => w.name)).toEqual([SHEET_NAME, 'Petunjuk', '_mahirexcel']);
    expect(wb.getWorksheet('_mahirexcel')!.state).toBe('veryHidden');
    const ws = wb.getWorksheet(SHEET_NAME)!;
    expect((ws as unknown as { sheetProtection?: { sheet?: boolean } }).sheetProtection?.sheet).toBe(true);
    expect(ws.getCell('B2').value).toBe(15000);
    expect(ws.getCell('B2').protection?.locked).toBe(true);
    expect(ws.getCell('D2').protection?.locked).toBe(false);
    expect((ws.getCell('D2').fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe('FFE3F4EA');
    expect(wb.getWorksheet('Petunjuk')!.getCell('A4').value).toBe(ex.task);
  });

  it('jawaban benar di Excel dibaca dan dinilai benar oleh penilai yang sama', async () => {
    const ex = pub();
    const wb = await buildExerciseWorkbook(ex);
    const ws = wb.getWorksheet(SHEET_NAME)!;
    ws.getCell('D2').value = { formula: 'B2*C2' };
    ws.getCell('D3').value = { formula: 'B3*C3' };
    ws.getCell('D4').value = { formula: 'B4*C4' };
    const out = await readAnswerFile(await roundTrip(wb), ex);
    expect(out.changed).toEqual([]);
    expect(out.otherExercise).toBeNull();
    expect(out.answers).toEqual({ D2: '=B2*C2', D3: '=B3*C3', D4: '=B4*C4' });
    expect(validateSubmission(FAST, out.answers).correct).toBe(true);
  });

  it('rumus bersama hasil mengisi ke bawah di Excel dibaca per sel', async () => {
    const ex = pub();
    const wb = await buildExerciseWorkbook(ex);
    const ws = wb.getWorksheet(SHEET_NAME)!;
    ws.getCell('D2').value = { formula: 'B2*C2', shareType: 'shared', ref: 'D2:D4', result: 30000 } as never;
    ws.getCell('D3').value = { sharedFormula: 'D2', result: 42000 } as never;
    ws.getCell('D4').value = { sharedFormula: 'D2', result: 18000 } as never;
    const out = await readAnswerFile(await roundTrip(wb), ex);
    expect(out.answers).toEqual({ D2: '=B2*C2', D3: '=B3*C3', D4: '=B4*C4' });
  });

  it('angka yang diketik langsung terbaca sebagai angka sehingga penilai menolak (harus rumus)', async () => {
    const ex = pub();
    const wb = await buildExerciseWorkbook(ex);
    const ws = wb.getWorksheet(SHEET_NAME)!;
    ws.getCell('D2').value = 30000;
    ws.getCell('D3').value = 42000;
    ws.getCell('D4').value = 18000;
    const out = await readAnswerFile(await roundTrip(wb), ex);
    expect(out.answers.D2).toBe('30000');
    expect(validateSubmission(FAST, out.answers).correct).toBe(false);
  });

  it('data soal yang diubah terdeteksi, dan penilaian tetap memakai data asli', async () => {
    const ex = pub();
    const wb = await buildExerciseWorkbook(ex);
    const ws = wb.getWorksheet(SHEET_NAME)!;
    ws.getCell('B2').value = 99999; // mengubah harga beras
    ws.getCell('A1').value = 'Judul lain';
    ws.getCell('D2').value = { formula: 'B2*C2' };
    ws.getCell('D3').value = { formula: 'B3*C3' };
    ws.getCell('D4').value = { formula: 'B4*C4' };
    const out = await readAnswerFile(await roundTrip(wb), ex);
    expect(out.changed.sort()).toEqual(['A1', 'B2']);
    expect(validateSubmission(FAST, out.answers).correct).toBe(true); // B2 asli dipakai, bukan 99999
  });

  it('file dari latihan lain ditandai', async () => {
    const other = pub('total-harga-barang');
    const wb = await buildExerciseWorkbook({ ...other, slug: 'latihan-lain' });
    const out = await readAnswerFile(await roundTrip(wb), other);
    expect(out.otherExercise).toBe('latihan-lain');
  });

  it('berkas rusak atau terlalu besar ditolak dengan pesan yang jelas', async () => {
    const ex = pub();
    await expect(readAnswerFile(asFile(new TextEncoder().encode('bukan excel'), 'x.xlsx'), ex)).rejects.toThrow(AnswerFileError);
    await expect(readAnswerFile(asFile(new Uint8Array(MAX_FILE_BYTES + 1)), ex)).rejects.toThrow(/terlalu besar/);
  });
});

describe('semua latihan', () => {
  it('jawaban acuan yang dikerjakan di Excel lolos penilai untuk setiap latihan', { timeout: 180_000 }, async () => {
    const failures: string[] = [];
    for (const def of exercises) {
      const ex = toPublicExercise(def);
      const wb = await buildExerciseWorkbook(ex);
      const ws = wb.getWorksheet(SHEET_NAME)!;
      for (const t of def.validation.targets) {
        const v = toCellValue(t.solution);
        if (v !== null) ws.getCell(t.cell).value = v;
      }
      const out = await readAnswerFile(await roundTrip(wb), ex);
      if (out.changed.length) failures.push(`${def.slug}: data soal berubah di ${out.changed.join(',')}`);
      const res = validateSubmission(def, out.answers);
      if (!res.correct) failures.push(`${def.slug}: ${res.message}`);
    }
    expect(failures).toEqual([]);
  });
});
