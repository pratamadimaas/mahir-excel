import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { datasetCatalog, getDataset, gradeValue, DATASET_COUNT } from './datasets';
import { specs } from './datasets/specs';
import { ANSWER_SHEET, DATA_SHEET, MARK_SHEET, buildCsv, buildDatasetWorkbook } from './datasets/workbook';

const sheetOf = (slug: string) => getDataset(slug)!.data;
const norm = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
const dedupe = <T extends unknown[]>(rows: T[], keyCol: number): T[] => {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(String(r[keyCol])) ? false : (seen.add(String(r[keyCol])), true)));
};

describe('data latihan: katalog', () => {
  it('ada 50 data, slug unik, dan tersebar di empat bidang', () => {
    expect(DATASET_COUNT).toBe(50);
    expect(new Set(specs.map((s) => s.slug)).size).toBe(50);
    const by = (f: string) => specs.filter((s) => s.field === f).length;
    expect([by('admin'), by('hrd'), by('jualan'), by('keuangan')]).toEqual([12, 13, 13, 12]);
  });

  it.each(specs.map((s) => [s.slug] as const))('%s: minimal 100 baris, tiga tugas, jawaban terdefinisi', (slug) => {
    const d = sheetOf(slug);
    expect(d.rows.length).toBeGreaterThanOrEqual(100);
    for (const row of d.rows) expect(row).toHaveLength(d.headers.length);
    expect(d.tasks).toHaveLength(3);
    for (const t of d.tasks) {
      expect(t.ask.length).toBeGreaterThan(20);
      expect(t.hint.length).toBeGreaterThan(10);
      if (typeof t.expected === 'number') expect(Number.isFinite(t.expected)).toBe(true);
      else expect(t.expected.trim()).not.toBe('');
    }
    expect(new Set(d.tasks.map((t) => t.ask)).size).toBe(3);
  });

  it('data selalu sama untuk slug yang sama dan berbeda antar slug', () => {
    expect(JSON.stringify(getDataset('kas-kecil')!.data.rows)).toBe(JSON.stringify(getDataset('kas-kecil')!.data.rows));
    expect(JSON.stringify(sheetOf('kas-harian-warung').rows)).not.toBe(JSON.stringify(sheetOf('iuran-kas-rt').rows));
  });

  it('ringkasan katalog memuat jumlah baris dan kolom', () => {
    const c = datasetCatalog();
    expect(c).toHaveLength(50);
    expect(c[0]!.rows).toBe(sheetOf(c[0]!.slug).rows.length);
    expect(c.every((x) => x.tasks.length === 3 && x.blurb && x.mess)).toBe(true);
  });
});

describe('data latihan: kunci cocok dengan data yang tampil', () => {
  it('transaksi toko: omzet, nota unik, dan produk teratas dihitung ulang dari baris mentah', () => {
    const d = sheetOf('transaksi-toko-kelontong');
    const rows = dedupe(d.rows, 1);
    expect(rows.length).toBe(d.tasks[1]!.expected);
    expect(rows.reduce((s, r) => s + num(r[3]) * num(r[4]), 0)).toBe(d.tasks[0]!.expected);
    const m = /"(.+?)"/.exec(d.tasks[2]!.ask)!;
    const qty = rows.filter((r) => norm(r[2]) === norm(m[1])).reduce((s, r) => s + num(r[3]), 0);
    expect(qty).toBe(d.tasks[2]!.expected);
  });

  it('piutang: total belum lunas dan yang lewat jatuh tempo dihitung ulang', () => {
    const d = sheetOf('piutang-pelanggan');
    const rows = dedupe(d.rows, 0).filter((r) => norm(r[5]) === 'belum lunas');
    expect(rows.reduce((s, r) => s + num(r[4]), 0)).toBe(d.tasks[0]!.expected);
    const asOf = Date.UTC(2026, 9, 31);
    const late = rows.filter((r) => (r[3] instanceof Date ? r[3].getTime() : Date.parse(String(r[3]))) < asOf).length;
    expect(late).toBe(d.tasks[1]!.expected);
  });

  it('surat: jumlah masuk, belum disposisi, dan rata-rata lama proses', () => {
    const d = sheetOf('surat-masuk-keluar');
    const masuk = d.rows.filter((r) => norm(r[2]) === 'masuk');
    expect(masuk.length).toBe(d.tasks[0]!.expected);
    expect(masuk.filter((r) => norm(r[5]) === 'belum').length).toBe(d.tasks[1]!.expected);
    const days = d.rows.filter((r) => r[6] !== null).map((r) => num(r[6]));
    expect(Math.round((days.reduce((s, x) => s + x, 0) / days.length) * 10) / 10).toBe(d.tasks[2]!.expected);
  });

  it('absensi: terlambat dan lupa absen pulang dihitung ulang dari jam', () => {
    const d = sheetOf('absensi-karyawan-bulanan');
    expect(d.rows).toHaveLength(24 * 22);
    const mins = (v: unknown): number => (v instanceof Date ? v.getUTCHours() * 60 + v.getUTCMinutes() : -1);
    expect(d.rows.filter((r) => r[3] !== null && mins(r[3]) > 480).length).toBe(d.tasks[0]!.expected);
    expect(d.rows.filter((r) => r[3] !== null && r[4] === null).length).toBe(d.tasks[1]!.expected);
  });

  it('nilai pelamar: skala 0 sampai 10 disamakan sebelum dihitung', () => {
    const d = sheetOf('hasil-tes-pelamar');
    const pass = d.rows
      .filter((r) => r[3] !== null)
      .filter((r) => {
        const b = num(r[4]) <= 10 ? num(r[4]) * 10 : num(r[4]);
        return 0.3 * num(r[3]) + 0.3 * b + 0.4 * num(r[5]) >= 70 - 1e-9;
      }).length;
    expect(pass).toBe(d.tasks[0]!.expected);
  });
});

describe('data latihan: penilaian jawaban', () => {
  it('angka: dalam toleransi benar, di luar salah, kosong dikenali', () => {
    expect(gradeValue(100, undefined, { value: 100, formula: true })).toBe('benar');
    expect(gradeValue(100, undefined, { value: 100.005, formula: true })).toBe('benar');
    expect(gradeValue(100, undefined, { value: 101, formula: true })).toBe('salah');
    expect(gradeValue(12.3, 0.06, { value: 12.34, formula: true })).toBe('benar');
    expect(gradeValue(100, undefined, { value: null, formula: true })).toBe('kosong');
    expect(gradeValue(100, undefined, { value: '  ', formula: true })).toBe('kosong');
    expect(gradeValue(100, undefined, undefined)).toBe('kosong');
  });

  it('angka yang ditulis sebagai teks dengan koma desimal tetap dibaca', () => {
    expect(gradeValue(12.5, undefined, { value: '12,5', formula: true })).toBe('benar');
    expect(gradeValue(12.5, undefined, { value: '#N/A', formula: true })).toBe('salah');
  });

  it('teks: spasi dan huruf besar kecil diabaikan', () => {
    expect(gradeValue('Rina Pratama', undefined, { value: '  rina   PRATAMA ', formula: true })).toBe('benar');
    expect(gradeValue('Rina Pratama', undefined, { value: 'Rini Pratama', formula: true })).toBe('salah');
  });

  it('jawaban benar tetapi diketik langsung tidak dihitung benar', () => {
    expect(gradeValue(100, undefined, { value: 100, formula: false })).toBe('tanpa-rumus');
    expect(gradeValue(100, undefined, { value: 99, formula: false })).toBe('salah');
    expect(gradeValue(100, undefined, { value: 100, formula: false }, false)).toBe('benar');
  });
});

describe('data latihan: berkas', () => {
  it('xlsx memuat sheet Petunjuk, Data, Jawaban, penanda tersembunyi, dan jumlah baris yang benar', async () => {
    const { spec, data } = getDataset('transaksi-toko-kelontong')!;
    const buf = await buildDatasetWorkbook(spec, data).xlsx.writeBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Petunjuk', DATA_SHEET, ANSWER_SHEET, MARK_SHEET]);
    expect(wb.getWorksheet(DATA_SHEET)!.rowCount).toBe(data.rows.length + 1);
    expect(wb.getWorksheet(ANSWER_SHEET)!.getCell('B2').value).toBe(data.tasks[0]!.ask);
    expect(wb.getWorksheet(MARK_SHEET)!.getCell('A2').value).toBe('transaksi-toko-kelontong');
    expect(wb.getWorksheet(MARK_SHEET)!.state).toBe('veryHidden');
  });

  it('tanggal asli tetap tanggal dan angka teks tetap teks setelah dibaca ulang', async () => {
    const { spec, data } = getDataset('transaksi-toko-kelontong')!;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildDatasetWorkbook(spec, data).xlsx.writeBuffer()) as ArrayBuffer);
    const ws = wb.getWorksheet(DATA_SHEET)!;
    data.rows.forEach((row, i) => {
      const v = ws.getCell(i + 2, 1).value;
      if (row[0] instanceof Date) expect(v instanceof Date).toBe(true);
      else expect(typeof v).toBe('string');
    });
  });

  it('csv memakai BOM, koma, dan tanggal hari-bulan-tahun', () => {
    const csv = buildCsv(sheetOf('kas-kecil'));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(sheetOf('kas-kecil').rows.length + 1);
    expect(lines[0]).toContain('Tanggal,Keterangan');
    expect(lines[1]).toMatch(/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}),/);
  });
});
