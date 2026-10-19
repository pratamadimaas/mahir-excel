import { describe, expect, it } from 'vitest';
import { Sheet, isError, shiftFormula } from './index';

const val = (cells: Record<string, string>, ref: string, now?: Date) => new Sheet(cells, { now }).getValue(ref);
const code = (cells: Record<string, string>, ref: string): string => {
  const r = val(cells, ref);
  return isError(r) ? r.code : `bukan galat: ${String(r)}`;
};

describe('ROUND', () => {
  it.each([
    ['=ROUND(2.675,2)', 2.68],
    ['=ROUND(2.5,0)', 3],
    ['=ROUND(-2.5,0)', -3],
    ['=ROUND(1234.567,-2)', 1200],
    ['=ROUND(3.14159,3)', 3.142],
    ['=ROUND(7)', 7],
    ['=ROUND(0.1+0.2,1)', 0.3],
    ['=ROUND("1.55",1)', 1.6],
  ])('%s', (f, expected) => {
    expect(val({ A1: f }, 'A1')).toBe(expected);
  });
  it('digit di luar batas dan teks non-angka', () => {
    expect(code({ A1: '=ROUND(1,20)' }, 'A1')).toBe('#NUM!');
    expect(code({ A1: '=ROUND("abc",1)' }, 'A1')).toBe('#VALUE!');
    expect(code({ A1: '=ROUND()' }, 'A1')).toBe('#ERROR!');
  });
});

describe('tanggal', () => {
  it('DATE, YEAR, MONTH, DAY', () => {
    expect(val({ A1: '=DATE(2026,10,17)' }, 'A1')).toBe(46312);
    expect(val({ A1: '=DATE(2026,10,17)', B1: '=YEAR(A1)', C1: '=MONTH(A1)', D1: '=DAY(A1)' }, 'B1')).toBe(2026);
    expect(val({ A1: '=DATE(2026,10,17)', C1: '=MONTH(A1)' }, 'C1')).toBe(10);
    expect(val({ A1: '=DATE(2026,10,17)', D1: '=DAY(A1)' }, 'D1')).toBe(17);
  });
  it('DATE meluap bulan/hari seperti Excel', () => {
    expect(val({ A1: '=MONTH(DATE(2026,14,1))' }, 'A1')).toBe(2);
    expect(val({ A1: '=YEAR(DATE(2026,14,1))' }, 'A1')).toBe(2027);
    expect(val({ A1: '=DAY(DATE(2026,3,0))' }, 'A1')).toBe(28);
    expect(val({ A1: '=YEAR(DATE(26,1,1))' }, 'A1')).toBe(1926);
  });
  it('selisih tanggal dalam hari', () => {
    expect(val({ A1: '=DATE(2026,12,25)-DATE(2026,12,1)' }, 'A1')).toBe(24);
  });
  it('TODAY memakai jam yang bisa disuntik dan zona WIB', () => {
    const now = new Date('2026-10-17T20:00:00Z'); // 18 Okt 03:00 WIB
    expect(val({ A1: '=TODAY()' }, 'A1', now)).toBe(46313);
    expect(val({ A1: '=DAY(TODAY())' }, 'A1', now)).toBe(18);
  });
  it('argumen tidak valid', () => {
    expect(code({ A1: '=YEAR(0)' }, 'A1')).toBe('#NUM!');
    expect(code({ A1: '=DATE(10000,1,1)' }, 'A1')).toBe('#NUM!');
    expect(code({ A1: '=YEAR("teks")' }, 'A1')).toBe('#VALUE!');
    expect(code({ A1: '=TODAY(1)' }, 'A1')).toBe('#ERROR!');
  });
});

describe('teks', () => {
  const c = { A1: '  Jakarta   Selatan ', B1: 'budi santoso', C1: '12345' };
  it('LEFT, RIGHT, MID, LEN', () => {
    expect(val({ ...c, D1: '=LEFT(B1,4)' }, 'D1')).toBe('budi');
    expect(val({ ...c, D1: '=LEFT(B1)' }, 'D1')).toBe('b');
    expect(val({ ...c, D1: '=RIGHT(B1,7)' }, 'D1')).toBe('santoso');
    expect(val({ ...c, D1: '=RIGHT(B1,0)' }, 'D1')).toBe('');
    expect(val({ ...c, D1: '=MID(B1,6,3)' }, 'D1')).toBe('san');
    expect(val({ ...c, D1: '=LEN(B1)' }, 'D1')).toBe(12);
    expect(val({ ...c, D1: '=LEFT(C1,2)' }, 'D1')).toBe('12');
    expect(val({ ...c, D1: '=LEFT(B1,100)' }, 'D1')).toBe('budi santoso');
  });
  it('TRIM merapikan spasi di awal, akhir, dan di tengah', () => {
    expect(val({ ...c, D1: '=TRIM(A1)' }, 'D1')).toBe('Jakarta Selatan');
    expect(val({ ...c, D1: '=LEN(TRIM(A1))' }, 'D1')).toBe(15);
  });
  it('UPPER, LOWER, PROPER', () => {
    expect(val({ ...c, D1: '=UPPER(B1)' }, 'D1')).toBe('BUDI SANTOSO');
    expect(val({ ...c, D1: '=LOWER("ABC")' }, 'D1')).toBe('abc');
    expect(val({ ...c, D1: '=PROPER(B1)' }, 'D1')).toBe('Budi Santoso');
    expect(val({ ...c, D1: '=PROPER("jAKARTA-selatan")' }, 'D1')).toBe('Jakarta-Selatan');
  });
  it('digabung dengan &', () => {
    expect(val({ ...c, D1: '=UPPER(LEFT(B1,1))&MID(B1,2,3)' }, 'D1')).toBe('Budi');
    expect(val({ ...c, D1: '=PROPER(TRIM(A1))' }, 'D1')).toBe('Jakarta Selatan');
  });
  it('argumen negatif, galat, dan sel kosong', () => {
    expect(code({ A1: '=LEFT("abc",-1)' }, 'A1')).toBe('#VALUE!');
    expect(code({ A1: '=MID("abc",0,1)' }, 'A1')).toBe('#VALUE!');
    expect(code({ A1: '=LEN(1/0)' }, 'A1')).toBe('#DIV/0!');
    expect(val({ A1: '=LEN(B1)' }, 'A1')).toBe(0);
  });
});

describe('VLOOKUP', () => {
  const t = { A1: 'BRS', B1: 'Beras', C1: '68000', A2: 'GLA', B2: 'Gula', C2: '16000', A3: 'TLR', B3: 'Telur', C3: '28000' };
  it('pencocokan persis', () => {
    expect(val({ ...t, E1: '=VLOOKUP("GLA",A1:C3,3,FALSE)' }, 'E1')).toBe(16000);
    expect(val({ ...t, D1: 'tlr', E1: '=VLOOKUP(D1,A1:C3,2,0)' }, 'E1')).toBe('Telur');
    expect(val({ ...t, E1: '=VLOOKUP("G*",A1:C3,2,FALSE)' }, 'E1')).toBe('Gula');
  });
  it('tidak ditemukan -> #N/A dan dapat ditangkap IFERROR/IFNA', () => {
    expect(code({ ...t, E1: '=VLOOKUP("XXX",A1:C3,2,FALSE)' }, 'E1')).toBe('#N/A');
    expect(val({ ...t, E1: '=IFERROR(VLOOKUP("XXX",A1:C3,2,FALSE),"-")' }, 'E1')).toBe('-');
    expect(val({ ...t, E1: '=IFNA(VLOOKUP("XXX",A1:C3,2,FALSE),"Tidak ada")' }, 'E1')).toBe('Tidak ada');
  });
  it('IFNA tidak menutupi galat lain', () => {
    expect(code({ E1: '=IFNA(1/0,"x")' }, 'E1')).toBe('#DIV/0!');
  });
  it('nomor kolom tidak valid', () => {
    expect(code({ ...t, E1: '=VLOOKUP("GLA",A1:C3,4,FALSE)' }, 'E1')).toBe('#REF!');
    expect(code({ ...t, E1: '=VLOOKUP("GLA",A1:C3,0,FALSE)' }, 'E1')).toBe('#VALUE!');
  });
  it('pencocokan perkiraan pada data terurut (tabel grade)', () => {
    const g = { A1: '0', B1: 'E', A2: '60', B2: 'D', A3: '70', B3: 'C', A4: '80', B4: 'B', A5: '90', B5: 'A' };
    expect(val({ ...g, D1: '=VLOOKUP(85,A1:B5,2)' }, 'D1')).toBe('B');
    expect(val({ ...g, D1: '=VLOOKUP(90,A1:B5,2,TRUE)' }, 'D1')).toBe('A');
    expect(val({ ...g, D1: '=VLOOKUP(59.9,A1:B5,2)' }, 'D1')).toBe('E');
    expect(code({ ...g, D1: '=VLOOKUP(-1,A1:B5,2)' }, 'D1')).toBe('#N/A');
  });
  it('sel hasil kosong dikembalikan 0 seperti Excel', () => {
    expect(val({ A1: 'x', E1: '=VLOOKUP("x",A1:B1,2,FALSE)' }, 'E1')).toBe(0);
  });
  it('kunci berupa galat merambat', () => {
    expect(code({ ...t, E1: '=VLOOKUP(1/0,A1:C3,2,FALSE)' }, 'E1')).toBe('#DIV/0!');
  });
});

describe('XLOOKUP', () => {
  const t = { A1: 'BRS', A2: 'GLA', A3: 'TLR', A4: 'GLA', B1: 'Beras', B2: 'Gula', B3: 'Telur', B4: 'Gula 2' };
  it('persis, pertama kali ketemu atau dari belakang', () => {
    expect(val({ ...t, D1: '=XLOOKUP("GLA",A1:A4,B1:B4)' }, 'D1')).toBe('Gula');
    expect(val({ ...t, D1: '=XLOOKUP("GLA",A1:A4,B1:B4,"-",0,-1)' }, 'D1')).toBe('Gula 2');
    expect(val({ ...t, D1: '=XLOOKUP("g*",A1:A4,B1:B4,"-",2)' }, 'D1')).toBe('Gula');
  });
  it('tidak ditemukan: bawaan #N/A, atau nilai pengganti', () => {
    expect(code({ ...t, D1: '=XLOOKUP("XXX",A1:A4,B1:B4)' }, 'D1')).toBe('#N/A');
    expect(val({ ...t, D1: '=XLOOKUP("XXX",A1:A4,B1:B4,"Tidak ada")' }, 'D1')).toBe('Tidak ada');
  });
  it('mode terdekat (-1 lebih kecil, 1 lebih besar)', () => {
    const n = { A1: '10', A2: '20', A3: '30', B1: 'a', B2: 'b', B3: 'c' };
    expect(val({ ...n, D1: '=XLOOKUP(25,A1:A3,B1:B3,"-",-1)' }, 'D1')).toBe('b');
    expect(val({ ...n, D1: '=XLOOKUP(25,A1:A3,B1:B3,"-",1)' }, 'D1')).toBe('c');
    expect(val({ ...n, D1: '=XLOOKUP(5,A1:A3,B1:B3,"-",-1)' }, 'D1')).toBe('-');
  });
  it('rentang dua dimensi atau beda panjang ditolak', () => {
    expect(code({ ...t, D1: '=XLOOKUP("GLA",A1:A4,B1:B3)' }, 'D1')).toBe('#VALUE!');
    expect(code({ ...t, D1: '=XLOOKUP("GLA",A1:B4,B1:B4)' }, 'D1')).toBe('#VALUE!');
    expect(code({ ...t, D1: '=XLOOKUP("GLA",A1:A4,B1:B4,"-",5)' }, 'D1')).toBe('#VALUE!');
    expect(code({ ...t, D1: '=XLOOKUP("GLA",A1:A4,B1:B4,"-",0,2)' }, 'D1')).toBe('#VALUE!');
  });
});

describe('INDEX dan MATCH', () => {
  const t = { A1: 'BRS', A2: 'GLA', A3: 'TLR', B1: '68000', B2: '16000', B3: '28000' };
  it('MATCH persis dan perkiraan', () => {
    expect(val({ ...t, D1: '=MATCH("TLR",A1:A3,0)' }, 'D1')).toBe(3);
    expect(code({ ...t, D1: '=MATCH("XXX",A1:A3,0)' }, 'D1')).toBe('#N/A');
    const n = { A1: '10', A2: '20', A3: '30' };
    expect(val({ ...n, D1: '=MATCH(25,A1:A3,1)' }, 'D1')).toBe(2);
    expect(val({ ...n, D1: '=MATCH(25,A1:A3)' }, 'D1')).toBe(2);
    const d = { A1: '30', A2: '20', A3: '10' };
    expect(val({ ...d, D1: '=MATCH(25,A1:A3,-1)' }, 'D1')).toBe(1);
  });
  it('INDEX pada rentang dua dimensi dan satu dimensi', () => {
    expect(val({ ...t, D1: '=INDEX(A1:B3,2,2)' }, 'D1')).toBe(16000);
    expect(val({ ...t, D1: '=INDEX(A1:A3,3)' }, 'D1')).toBe('TLR');
    expect(val({ A1: 'x', B1: 'y', C1: 'z', D1: '=INDEX(A1:C1,2)' }, 'D1')).toBe('y');
  });
  it('INDEX di luar rentang atau nomor 0', () => {
    expect(code({ ...t, D1: '=INDEX(A1:B3,4,1)' }, 'D1')).toBe('#REF!');
    expect(code({ ...t, D1: '=INDEX(A1:B3,0,1)' }, 'D1')).toBe('#VALUE!');
    expect(code({ ...t, D1: '=INDEX(A1:B3,-1,1)' }, 'D1')).toBe('#VALUE!');
  });
  it('INDEX-MATCH: harga dari kode, bahkan jika kolom kode di kanan', () => {
    const r = { A1: '68000', A2: '16000', A3: '28000', B1: 'BRS', B2: 'GLA', B3: 'TLR' };
    expect(val({ ...r, D1: '=INDEX(A1:A3,MATCH("GLA",B1:B3,0))' }, 'D1')).toBe(16000);
    expect(val({ ...r, D1: '=IFERROR(INDEX(A1:A3,MATCH("XXX",B1:B3,0)),"Tidak ada")' }, 'D1')).toBe('Tidak ada');
  });
  it('MATCH dengan rentang dua dimensi ditolak', () => {
    expect(code({ ...t, D1: '=MATCH("x",A1:B3,0)' }, 'D1')).toBe('#VALUE!');
  });
});

describe('isi otomatis (shiftFormula)', () => {
  it.each([
    ['=B2*C2', 0, 1, '=B3*C3'],
    ['=B2*$E$1', 0, 3, '=B5*$E$1'],
    ['=B2/$B$6', 0, 2, '=B4/$B$6'],
    ['=SUM(B2:B6)', 1, 0, '=SUM(C2:C6)'],
    ['=SUM($B2:B$6)', 2, 2, '=SUM($B4:D$6)'],
    ['=IF(B2>=70,"B2 Lulus","Remedial")', 0, 1, '=IF(B3>=70,"B2 Lulus","Remedial")'],
    ['=VLOOKUP(A2,$G$2:$I$6,2,FALSE)', 0, 1, '=VLOOKUP(A3,$G$2:$I$6,2,FALSE)'],
    ['=ROUND(B2,2)', 0, 1, '=ROUND(B3,2)'],
    ['=SUM(1,2)', 0, 5, '=SUM(1,2)'],
    ['teks biasa B2', 0, 1, 'teks biasa B2'],
  ])('%s digeser (%i kolom, %i baris) menjadi %s', (f, dc, dr, expected) => {
    expect(shiftFormula(f, dc, dr)).toBe(expected);
  });
  it('keluar dari grid menjadi #REF!', () => {
    expect(shiftFormula('=B2', 0, -5)).toBe('=#REF!');
    expect(shiftFormula('=B2', -5, 0)).toBe('=#REF!');
  });
  it('hasil geseran tetap dapat dihitung', () => {
    const cells = { A1: '10', A2: '20', B1: '=A1*2' };
    const s = new Sheet({ ...cells, B2: shiftFormula(cells.B1, 0, 1) });
    expect(s.getValue('B2')).toBe(40);
  });
});
