import { describe, expect, it } from 'vitest';
import { FUNCTION_NAMES, Sheet, isError } from './index';

const NOW = new Date('2026-10-24T05:30:15Z');
const grid: Record<string, string> = {
  A1: 'Nama', B1: 'Divisi', C1: 'Gaji',
  A2: 'Ani', B2: 'Admin', C2: '5000',
  A3: 'Budi', B3: 'Gudang', C3: '4000',
  A4: 'Citra', B4: 'Admin', C4: '6000',
  A5: 'Dedi', B5: 'Gudang', C5: '',
  A6: 'Eka', B6: 'Admin', C6: '3000',
  E1: '2026-01-31',
};
const ev = (f: string, extra: Record<string, string> = {}, hidden?: number[]): unknown => {
  const s = new Sheet({ ...grid, ...extra, Z9: f }, { now: NOW, hiddenRows: hidden ? new Set(hidden) : undefined });
  const v = s.getValue('Z9');
  return isError(v) ? v.code : v;
};
const serial = (y: number, m: number, d: number): number => Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) + 25569;

describe('fungsi tes kerja admin terdaftar', () => {
  it('13 fungsi ada di daftar', () => {
    for (const f of ['SUBTOTAL', 'COUNTBLANK', 'MAXIFS', 'MINIFS', 'ISBLANK', 'ISNUMBER', 'ISTEXT', 'VALUE', 'ABS', 'INT', 'MOD', 'EDATE', 'WEEKDAY']) {
      expect(FUNCTION_NAMES.has(f), f).toBe(true);
    }
  });
});

describe('SUBTOTAL', () => {
  it('tanpa filter sama dengan SUM, AVERAGE, COUNT, COUNTA, MAX, MIN', () => {
    expect(ev('=SUBTOTAL(9,C2:C6)')).toBe(18000);
    expect(ev('=SUBTOTAL(1,C2:C6)')).toBe(4500);
    expect(ev('=SUBTOTAL(2,C2:C6)')).toBe(4);
    expect(ev('=SUBTOTAL(3,C2:C6)')).toBe(4);
    expect(ev('=SUBTOTAL(4,C2:C6)')).toBe(6000);
    expect(ev('=SUBTOTAL(5,C2:C6)')).toBe(3000);
    expect(ev('=SUBTOTAL(9;C2:C6)')).toBe(18000); // pemisah titik koma juga diterima
  });

  it('melewati baris yang disembunyikan filter, termasuk kode 101-111', () => {
    expect(ev('=SUBTOTAL(9,C2:C6)', {}, [3, 5])).toBe(14000); // baris 3 (4000) tersembunyi
    expect(ev('=SUBTOTAL(109,C2:C6)', {}, [3])).toBe(14000);
    expect(ev('=SUBTOTAL(2,C2:C6)', {}, [2, 3, 4, 5, 6])).toBe(0);
    expect(ev('=SUM(C2:C6)', {}, [3])).toBe(18000); // SUM tidak peduli filter
  });

  it('tidak menghitung SUBTOTAL lain di dalam rentang (total akhir tidak ganda)', () => {
    const extra = { C7: '=SUBTOTAL(9,C2:C6)' };
    expect(ev('=SUBTOTAL(9,C2:C7)', extra)).toBe(18000);
    expect(ev('=SUM(C2:C7)', extra)).toBe(36000); // SUM akan ganda
  });

  it('galat yang jelas untuk nomor fungsi dan argumen salah', () => {
    expect(ev('=SUBTOTAL(12,C2:C6)')).toBe('#VALUE!');
    expect(ev('=SUBTOTAL(7,C2:C6)')).toBe('#VALUE!'); // belum didukung
    expect(ev('=SUBTOTAL(9,5)')).toBe('#VALUE!');
    expect(ev('=SUBTOTAL(1,C5:C5)')).toBe('#DIV/0!');
  });
});

describe('COUNTBLANK, MAXIFS, MINIFS', () => {
  it('COUNTBLANK menghitung sel kosong dan teks kosong', () => {
    expect(ev('=COUNTBLANK(C2:C6)')).toBe(1);
    expect(ev('=COUNTBLANK(A2:C6)')).toBe(1);
    expect(ev('=COUNTBLANK(C2:C6)', { C2: '=""' })).toBe(2);
  });

  it('MAXIFS dan MINIFS dengan satu dan beberapa syarat', () => {
    expect(ev('=MAXIFS(C2:C6,B2:B6,"Admin")')).toBe(6000);
    expect(ev('=MINIFS(C2:C6,B2:B6,"Admin")')).toBe(3000);
    expect(ev('=MAXIFS(C2:C6,B2:B6,"Admin",C2:C6,"<6000")')).toBe(5000);
    expect(ev('=MAXIFS(C2:C6,B2:B6,"Marketing")')).toBe(0); // tidak ada yang cocok, seperti Excel
    expect(ev('=MAXIFS(C2:C6,B2:B5,"Admin")')).toBe('#VALUE!'); // ukuran beda
  });
});

describe('fungsi pemeriksa dan angka', () => {
  it('ISBLANK, ISNUMBER, ISTEXT', () => {
    expect(ev('=ISBLANK(C5)')).toBe(true);
    expect(ev('=ISBLANK(C2)')).toBe(false);
    expect(ev('=ISNUMBER(C2)')).toBe(true);
    expect(ev('=ISNUMBER(A2)')).toBe(false);
    expect(ev('=ISTEXT(A2)')).toBe(true);
    expect(ev('=ISTEXT(C2)')).toBe(false);
    expect(ev('=ISNUMBER(1/0)')).toBe(false); // galat tidak merambat
  });

  it('VALUE, ABS, INT, MOD', () => {
    expect(ev('=VALUE("123")')).toBe(123);
    expect(ev('=VALUE("abc")')).toBe('#VALUE!');
    expect(ev('=ABS(-7.5)')).toBe(7.5);
    expect(ev('=INT(8.9)')).toBe(8);
    expect(ev('=INT(-8.1)')).toBe(-9);
    expect(ev('=MOD(10,3)')).toBe(1);
    expect(ev('=MOD(-1,3)')).toBe(2);
    expect(ev('=MOD(5,0)')).toBe('#DIV/0!');
  });
});

describe('EDATE dan WEEKDAY', () => {
  it('EDATE memajukan bulan dan menjepit tanggal di akhir bulan', () => {
    expect(ev('=EDATE(DATE(2026,1,31),1)')).toBe(serial(2026, 2, 28));
    expect(ev('=EDATE(DATE(2026,10,15),3)')).toBe(serial(2027, 1, 15));
    expect(ev('=EDATE(DATE(2026,3,31),-1)')).toBe(serial(2026, 2, 28));
    expect(ev('=EDATE(DATE(2024,1,31),1)')).toBe(serial(2024, 2, 29)); // tahun kabisat
  });

  it('WEEKDAY: 24 Oktober 2026 adalah hari Sabtu', () => {
    const d = 'DATE(2026,10,24)';
    expect(ev(`=WEEKDAY(${d})`)).toBe(7);
    expect(ev(`=WEEKDAY(${d},2)`)).toBe(6);
    expect(ev(`=WEEKDAY(${d},3)`)).toBe(5);
    expect(ev('=WEEKDAY(DATE(2026,10,25))')).toBe(1); // Minggu
    expect(ev(`=WEEKDAY(${d},9)`)).toBe('#NUM!');
  });
});
