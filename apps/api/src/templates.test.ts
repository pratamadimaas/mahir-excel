import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { FUNCTION_NAMES, extractFunctions, isError } from '@excellab/spreadsheet-engine';
import { templates } from '@excellab/shared';
import { buildTemplate, templateSheets } from './templates';
import { computeValues, rewriteFormula } from './templates/model';

const NOW = new Date('2026-10-24T05:00:00Z');
const cache = new Map<string, ReturnType<typeof computeValues>>();
const values = (slug: string) => {
  if (!cache.has(slug)) cache.set(slug, computeValues(templateSheets(slug), NOW));
  return cache.get(slug)!;
};
const num = (slug: string, sheet: string, ref: string): number => values(slug)[sheet]![ref] as number;

describe('template .xlsx', () => {
  it('katalog sama dengan isi berkas dan semua slug ada pembuatnya', () => {
    expect(new Set(templates.map((t) => t.slug)).size).toBe(templates.length);
    expect(templates.filter((t) => t.free)).toHaveLength(2);
    for (const t of templates) expect(templateSheets(t.slug).map((s) => s.name)).toEqual(t.sheets);
  });

  it.each(templates.map((t) => [t.slug] as const))('%s: tanpa galat, hanya fungsi yang dikenal, dan sesuai daftar fungsi di katalog', (slug) => {
    const def = templates.find((t) => t.slug === slug)!;
    const used = new Set<string>();
    for (const sheet of templateSheets(slug)) {
      for (const [ref, c] of Object.entries(sheet.cells)) {
        if (typeof c !== 'object' || !('f' in c)) continue;
        for (const fn of extractFunctions(c.f.replace(/'?[A-Za-z ]+'?!/g, ''))) used.add(fn);
        const v = values(slug)[sheet.name]![ref];
        expect(isError(v), `${sheet.name}!${ref}: ${c.f}`).toBe(false);
      }
    }
    for (const fn of used) expect(FUNCTION_NAMES.has(fn), fn).toBe(true);
    for (const fn of def.formulas) expect(used.has(fn), `katalog menyebut ${fn} tetapi tidak dipakai`).toBe(true);
  });

  it.each(templates.map((t) => [t.slug] as const))('%s: berkas ditulis dan terbaca ulang dengan sheet yang sama', async (slug) => {
    const buf = await buildTemplate(slug, NOW).xlsx.writeBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as ArrayBuffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual(templates.find((t) => t.slug === slug)!.sheets);
    expect(String(wb.worksheets[0]!.getCell('A1').value).length).toBeGreaterThan(5);
  });

  it('acuan antar sheet ditulis ulang ke posisi geser', () => {
    const idx = (n: string): number => ['A', 'Harga satuan', 'C'].indexOf(n);
    expect(rewriteFormula("SUM('Harga satuan'!$A$5:$A$9)+B2", 0, idx)).toBe('SUM($AE$5:$AE$9)+B2');
    expect(rewriteFormula('IF(B2="A1","x",C!A1)', 0, idx)).toBe('IF(B2="A1","x",BI1)');
  });

  it('laporan penjualan: rekap bulanan cocok dengan hitungan manual', () => {
    const sheets = templateSheets('laporan-penjualan');
    const sales = sheets.find((s) => s.name === 'Penjualan')!;
    const price: Record<string, number> = { 'Kopi susu': 18000, 'Teh manis': 8000, 'Roti bakar': 15000, 'Nasi goreng': 25000, 'Mie goreng': 22000, 'Es jeruk': 9000 };
    const perMonth = new Array<number>(13).fill(0);
    const count = new Array<number>(13).fill(0);
    for (let r = 5; r < 100; r++) {
      const d = sales.cells[`A${r}`];
      if (!d || typeof d !== 'object' || !('d' in d)) continue;
      const month = Number(d.d.slice(5, 7));
      perMonth[month]! += price[sales.cells[`B${r}`] as string]! * (sales.cells[`D${r}`] as number);
      count[month]!++;
    }
    for (let m = 1; m <= 3; m++) {
      expect(num('laporan-penjualan', 'Rekap', `E${4 + m}`)).toBe(perMonth[m]);
      expect(num('laporan-penjualan', 'Rekap', `C${4 + m}`)).toBe(count[m]);
    }
    expect(num('laporan-penjualan', 'Rekap', 'C8')).toBe(0);
    const total = perMonth.reduce((a, b) => a + b, 0);
    expect(num('laporan-penjualan', 'Rekap', 'E17')).toBe(total);
    expect(num('laporan-penjualan', 'Rekap', 'C17')).toBe(30);
    // Rekap per produk menjumlah ke total yang sama.
    let byProduct = 0;
    for (let r = 21; r <= 26; r++) byProduct += num('laporan-penjualan', 'Rekap', `C${r}`);
    expect(byProduct).toBe(total);
  });

  it('keuangan pribadi: total masuk, keluar, dan sisa', () => {
    expect(num('keuangan-pribadi', 'Ringkasan', 'B4')).toBe(6000000 + 1200000);
    const keluar = 1500000 + 350000 + 100000 + 150000 + 400000 + 120000 + 400000 + 150000 + 1000000 + 180000 + 250000 + 350000;
    expect(num('keuangan-pribadi', 'Ringkasan', 'B5')).toBe(keluar);
    expect(num('keuangan-pribadi', 'Ringkasan', 'B6')).toBe(7200000 - keluar);
    expect(num('keuangan-pribadi', 'Ringkasan', 'C26')).toBe(keluar);
    // Makan: 350+150+400+250 ribu terhadap anggaran 1,8 juta.
    expect(num('keuangan-pribadi', 'Ringkasan', 'C11')).toBe(1150000);
    expect(values('keuangan-pribadi').Ringkasan!.E11).toBe('Aman');
    expect(values('keuangan-pribadi').Ringkasan!.E15).toBe('Aman'); // Hiburan: terpakai tepat 300 ribu dari anggaran 300 ribu
    expect(values('keuangan-pribadi').Ringkasan!.E17).toBe('Lewat anggaran'); // Lainnya: 350 ribu dari 300 ribu
  });

  it('stok barang: stok sekarang = awal + masuk - keluar dan penanda pesan lagi', () => {
    const v = values('stok-barang');
    expect(v.Barang!.G5).toBe(40 + 20 - 35); // Beras
    expect(v.Barang!.I5).toBe('Aman');
    expect(v.Barang!.G6).toBe(30 + 5 - 28); // Minyak: 7 <= 10
    expect(v.Barang!.I6).toBe('Pesan lagi');
    expect(v.Barang!.G7).toBe(50 + 30 - 60); // Gula: 20 <= 20
    expect(v.Barang!.I7).toBe('Pesan lagi');
    expect(v.Masuk!.E5).toBe('Beras 5 kg');
    expect(v.Barang!.L5).toBe(8);
    expect(v.Barang!.L6).toBe(
      ['I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12'].filter((r) => v.Barang![r] === 'Pesan lagi').length,
    );
  });

  it('invoice: total, sisa, dan status dihitung terhadap tanggal hari ini', () => {
    const v = values('invoice-piutang');
    expect(v.Invoice!.E20).toBe(1500000 + 2 * 85000 + 25000);
    expect(v.Invoice!.E22).toBeCloseTo(v.Invoice!.E20 as number * 0.11, 5);
    expect(v.Daftar!.G5).toBe(2500000);
    expect(v.Daftar!.I5).toBe('Lunas');
    expect(v.Daftar!.H6).toBe(4800000 - 2000000);
    expect(v.Daftar!.I6).toBe('Terlambat');
    expect(v.Daftar!.M7).toBe(2500000 + 4800000 + 1200000 + 3100000 + 7500000 + 950000 - (2500000 + 2000000 + 1200000 + 3000000));
    expect(v.Daftar!.M9).toBe(4);
  });

  it('anggaran pernikahan: sisa tagihan, status, dan ringkasan', () => {
    const v = values('anggaran-pernikahan');
    expect(v.Anggaran!.E5).toBe(18000000); // DP + cicilan gedung
    expect(v.Anggaran!.F5).toBe(10000000);
    expect(v.Anggaran!.G5).toBe(3000000);
    expect(v.Anggaran!.H5).toBe('Sudah DP');
    expect(v.Anggaran!.H11).toBe('Lunas');
    expect(v.Anggaran!.H10).toBe('Belum deal');
    expect(v.Ringkasan!.B6).toBe(28000000 + 38000000 + 12500000 + 9000000 + 8500000 + 4200000);
    expect(v.Ringkasan!.B7).toBe((v.Ringkasan!.B6 as number) + 4000000 + 10000000 + 2000000);
    expect(v.Ringkasan!.B10).toBe(150000000 - (v.Ringkasan!.B7 as number));
    expect(v.Ringkasan!.B8).toBe(18000000 + 15000000 + 5000000 + 3000000 + 3000000 + 4200000);
  });

  it('RAB: jumlah, subtotal, overhead, PPN, dan pembulatan', () => {
    const v = values('rab-sederhana');
    expect(v.RAB!.D7).toBe('m2');
    expect(v.RAB!.F7).toBe(135000);
    expect(v.RAB!.G7).toBe(135000 * 30);
    const sub =
      40 * 15000 + 30 * 45000 + 30 * 135000 + 12 * 150000 + 25 * 60000 + 80 * 38000 + 30 * 125000 + 30 * 35000 + 6 * 150000 + 5 * 130000 + 2 * 1800000 + 3 * 350000;
    expect(v.Rekap!.B13).toBe(sub);
    expect(v.Rekap!.B14).toBe(0); // semua kelompok ada di daftar
    expect(v.Rekap!.B17).toBeCloseTo(sub * 0.1, 5);
    expect(v.Rekap!.B19).toBeCloseTo((sub + sub * 0.1) * 0.11, 5);
    expect(v.Rekap!.B20).toBeCloseTo(sub * 1.1 * 1.11, 5);
    expect(v.Rekap!.B21).toBe(Math.round((sub * 1.1 * 1.11) / 1000) * 1000);
  });
});
