import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { worksheets } from '@excellab/shared';
import { generateWorksheets } from './worksheets/generate';
import { RP } from './worksheets/builders';

const dir = path.join(os.tmpdir(), `excellab-ws-${process.pid}`);

beforeAll(async () => {
  fs.rmSync(dir, { recursive: true, force: true });
  await generateWorksheets(dir);
});

const load = async (file: string): Promise<ExcelJS.Workbook> => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(dir, file));
  return wb;
};

describe('workbook worksheet', () => {
  it('membuat 10 file latihan + 10 file kunci', () => {
    const files = fs.readdirSync(dir);
    expect(files.filter((f) => f.endsWith('-kunci.xlsx'))).toHaveLength(10);
    expect(files.filter((f) => f.endsWith('.xlsx') && !f.endsWith('-kunci.xlsx'))).toHaveLength(10);
    for (const w of worksheets) {
      expect(files).toContain(`${w.slug}.xlsx`);
      expect(files).toContain(`${w.slug}-kunci.xlsx`);
    }
  });

  it.each(worksheets.map((w) => [w.slug, w] as const))('%s: berkas valid dengan sheet Petunjuk dan Latihan', async (_slug, def) => {
    const wb = await load(`${def.slug}.xlsx`);
    const names = wb.worksheets.map((s) => s.name);
    expect(names[0]).toBe('Petunjuk');
    expect(names).toContain('Latihan');
    const info = wb.getWorksheet('Petunjuk')!;
    expect(String(info.getCell('A1').value)).toBe(def.title);
    expect(info.getCell('A4').value).toBe(def.objective);
    const practice = wb.getWorksheet('Latihan')!;
    expect(practice.getCell('A1').value).toBeTruthy();
    expect(practice.rowCount).toBeGreaterThan(3);
  });

  it.each(worksheets.map((w) => [w.slug, w] as const))('%s: kunci terpisah dan sel jawaban kosong di file latihan', async (_slug, def) => {
    const practice = await load(`${def.slug}.xlsx`);
    const key = await load(`${def.slug}-kunci.xlsx`);
    expect(String(key.getWorksheet('Petunjuk')!.getCell('A1').value)).toContain('KUNCI');
    const filled = (ws: ExcelJS.Worksheet): number => {
      let n = 0;
      ws.eachRow((r) =>
        r.eachCell((c) => {
          if (c.value !== null && c.value !== '') n++;
        }),
      );
      return n;
    };
    const sheet = def.slug === 'latihan-merapikan-data' ? 'Hasil' : 'Latihan';
    const practiceSheet = practice.getWorksheet('Latihan')!;
    const keySheet = key.getWorksheet(sheet)!;
    if (def.slug === 'latihan-merapikan-data') expect(filled(keySheet)).toBeGreaterThan(0);
    else expect(filled(keySheet)).toBeGreaterThan(filled(practiceSheet)); // jawaban terisi hanya di kunci
  });

  it('anggaran bulanan: judul kolom, data, format Rupiah, rumus pada kunci', async () => {
    const p = (await load('anggaran-bulanan.xlsx')).getWorksheet('Latihan')!;
    expect(p.getCell('A1').value).toBe('Pemasukan');
    expect(p.getCell('B1').value).toBe('Jumlah (Rp)');
    expect(p.getCell('A2').value).toBe('Gaji');
    expect(p.getCell('B2').value).toBe(6000000);
    expect(p.getCell('B2').numFmt).toBe(RP);
    expect(p.getCell('B4').value).toBeNull(); // sel jawaban kosong

    const k = (await load('anggaran-bulanan-kunci.xlsx')).getWorksheet('Latihan')!;
    expect(k.getCell('B4').value).toMatchObject({ formula: 'SUM(B2:B3)', result: 7500000 });
    expect(k.getCell('B13').value).toMatchObject({ formula: 'SUM(B7:B12)', result: 5250000 });
    expect(k.getCell('B15').value).toMatchObject({ formula: 'B4-B13', result: 2250000 });
  });

  it('rekap penjualan: tanggal asli dan hasil terhitung benar', async () => {
    const k = (await load('rekap-penjualan-kunci.xlsx')).getWorksheet('Latihan')!;
    expect(k.getCell('A2').value).toBeInstanceOf(Date);
    expect(k.getCell('A2').numFmt).toBe('dd/mm/yyyy');
    expect(k.getCell('E2').value).toMatchObject({ formula: 'C2*D2', result: 204000 });
    const total = k.getCell('H1').value as { result: number };
    const sum = [204000, 180000, 160000, 112000, 96000, 132000, 108000, 133000, 140000, 75000].reduce((a, b) => a + b, 0);
    expect(total.result).toBe(sum);
  });

  it('sumif/countif: hasil kunci sesuai perhitungan manual', async () => {
    const k = (await load('latihan-sumif-countif-kunci.xlsx')).getWorksheet('Latihan')!;
    const r = (ref: string) => (k.getCell(ref).value as { result: number }).result;
    expect(r('H2')).toBe(8); // Lunas
    expect(r('H3')).toBe(740000); // Makanan
    expect(r('H4')).toBe(5); // Jakarta
    expect(r('H5')).toBe(4); // Lunas & >= 100000
    expect(r('H6')).toBe(460000); // Makanan di Jakarta
    expect(r('H7')).toBe(205000); // Minuman belum lunas
  });

  it('latihan lookup: tabel acuan dan hasil VLOOKUP', async () => {
    const k = (await load('latihan-lookup-kunci.xlsx')).getWorksheet('Latihan')!;
    expect(k.getCell('G1').value).toBe('Kode');
    expect(k.getCell('C2').value).toMatchObject({ formula: 'VLOOKUP(A2,$G$2:$I$6,2,FALSE)', result: 'Gula 1 kg' });
    expect(k.getCell('E2').value).toMatchObject({ result: 160000 });
  });

  it('merapikan data: latihan berantakan, hasil bersih, daftar masalah', async () => {
    const p = (await load('latihan-merapikan-data.xlsx')).getWorksheet('Latihan')!;
    expect(p.getCell('B3').value).toBe('JAKARTA ');
    expect(p.getCell('C2').value).toBe('Rp 15000');
    const key = await load('latihan-merapikan-data-kunci.xlsx');
    expect(key.worksheets.map((s) => s.name)).toEqual(['Petunjuk', 'Hasil', 'Masalah']);
    expect(key.getWorksheet('Hasil')!.getCell('B3').value).toBe('Jakarta');
    expect(key.getWorksheet('Hasil')!.getCell('C2').value).toBe(15000);
  });

  it('absensi: persentase berformat dan hitungan COUNTIF', async () => {
    const k = (await load('absensi-karyawan-kunci.xlsx')).getWorksheet('Latihan')!;
    expect(k.getCell('L2').value).toMatchObject({ formula: 'COUNTIF(B2:K2,"H")', result: 9 });
    expect(k.getCell('M2').numFmt).toBe('0%');
    expect(k.getCell('M5').value).toMatchObject({ result: 1 });
  });

  it('latihan IF: 10 soal dengan jawaban terhitung', async () => {
    const k = (await load('latihan-if-kunci.xlsx')).getWorksheet('Latihan')!;
    const ans = (n: number) => (k.getCell(`E${n}`).value as { result: unknown }).result;
    expect(ans(2)).toBe('Lulus');
    expect(ans(3)).toBe('Remedial');
    expect(ans(4)).toBe(600000);
    expect(ans(5)).toBe('Ya');
    expect(ans(6)).toBe('Tidak');
    expect(ans(7)).toBe(20000);
    expect(ans(8)).toBe(60000);
    expect(ans(9)).toBe('B');
    expect(ans(10)).toBe('A');
    expect(ans(11)).toBe('-');
  });

  it('semua rumus pada kunci memiliki hasil tersimpan (tidak ada galat)', async () => {
    for (const w of worksheets) {
      const wb = await load(`${w.slug}-kunci.xlsx`);
      wb.eachSheet((s) =>
        s.eachRow((row) =>
          row.eachCell((c) => {
            if (c.value && typeof c.value === 'object' && 'formula' in c.value) {
              const res = (c.value as { result?: unknown }).result;
              expect(res, `${w.slug} ${s.name}!${c.address}`).not.toBeUndefined();
              expect(String(res)).not.toMatch(/^#/);
            }
          }),
        ),
      );
    }
  });
});
