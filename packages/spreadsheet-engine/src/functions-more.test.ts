import { describe, expect, it } from 'vitest';
import { FUNCTION_NAMES, Sheet, isError } from './index';

const NOW = new Date('2026-10-24T05:30:15Z'); // 12:30:15 WIB
const grid: Record<string, string> = {
  A1: '10', A2: '20', A3: '30', A4: '40', A5: '50',
  B1: 'apel', B2: 'jeruk', B3: 'apel', B4: 'mangga', B5: 'apel',
  C1: '5', C2: '', C3: '15', C4: 'x', C5: '25',
  E1: 'Senin', F1: 'Selasa', G1: 'Rabu',
  E2: '100', F2: '200', G2: '300',
  E3: '7', F3: '8', G3: '9',
  H1: '2', H2: '5', H3: '2', H4: '1',
};
const ev = (f: string, extra: Record<string, string> = {}): unknown => {
  const v = new Sheet({ ...grid, ...extra, Z9: f }, { now: NOW }).getValue('Z9');
  return isError(v) ? `#${v.code}` : v;
};
const code = (f: string): string => {
  const v = new Sheet({ ...grid, Z9: f }, { now: NOW }).getValue('Z9');
  return isError(v) ? v.code : `bukan galat: ${String(v)}`;
};
const serial = (y: number, m: number, d: number): number => Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) + 25569;

describe('fungsi baru terdaftar', () => {
  it('semua 20 fungsi ada dan jumlah fungsi 53', () => {
    const names = ['AVERAGEIF', 'ROUNDUP', 'ROUNDDOWN', 'MEDIAN', 'LARGE', 'SMALL', 'RANK', 'SUMPRODUCT', 'IFS', 'SWITCH', 'SUBSTITUTE', 'FIND', 'CONCAT', 'TEXTJOIN', 'TEXT', 'NOW', 'DATEDIF', 'EOMONTH', 'NETWORKDAYS', 'HLOOKUP'];
    for (const f of names) expect(FUNCTION_NAMES.has(f), f).toBe(true);
    expect(FUNCTION_NAMES.size).toBe(33 + names.length + 13); // 13 fungsi tes kerja: lihat functions-admin.test.ts
  });
});

describe('statistik dan pembulatan', () => {
  it('AVERAGEIF dengan dan tanpa rentang rata-rata', () => {
    expect(ev('=AVERAGEIF(B1:B5,"apel",A1:A5)')).toBe(30);
    expect(ev('=AVERAGEIF(A1:A5,">20")')).toBe(40);
    expect(ev('=AVERAGEIF(C1:C5,">=5")')).toBe(15);
    expect(code('=AVERAGEIF(B1:B5,"pisang",A1:A5)')).toBe('#DIV/0!');
  });

  it('MEDIAN: ganjil, genap, mengabaikan teks dan sel kosong di rentang', () => {
    expect(ev('=MEDIAN(A1:A5)')).toBe(30);
    expect(ev('=MEDIAN(A1:A4)')).toBe(25);
    expect(ev('=MEDIAN(C1:C5)')).toBe(15);
    expect(ev('=MEDIAN(1,2,3,100)')).toBe(2.5);
    expect(code('=MEDIAN(B1:B2)')).toBe('#NUM!');
  });

  it('LARGE dan SMALL', () => {
    expect(ev('=LARGE(A1:A5,2)')).toBe(40);
    expect(ev('=SMALL(A1:A5,2)')).toBe(20);
    expect(code('=LARGE(A1:A5,6)')).toBe('#NUM!');
    expect(code('=SMALL(A1:A5,0)')).toBe('#NUM!');
  });

  it('RANK: menurun, menaik, seri berbagi peringkat, tidak ketemu', () => {
    expect(ev('=RANK(50,A1:A5)')).toBe(1);
    expect(ev('=RANK(10,A1:A5)')).toBe(5);
    expect(ev('=RANK(10,A1:A5,1)')).toBe(1);
    expect(ev('=RANK(2,H1:H4)')).toBe(2);
    expect(ev('=RANK(1,H1:H4)')).toBe(4);
    expect(code('=RANK(99,A1:A5)')).toBe('#N/A');
  });

  it('ROUNDUP dan ROUNDDOWN menjauhi dan mendekati nol, termasuk digit negatif', () => {
    expect(ev('=ROUNDUP(3.141,2)')).toBe(3.15);
    expect(ev('=ROUNDDOWN(3.149,2)')).toBe(3.14);
    expect(ev('=ROUNDUP(-3.141,2)')).toBe(-3.15);
    expect(ev('=ROUNDDOWN(-3.149,2)')).toBe(-3.14);
    expect(ev('=ROUNDUP(12345,-3)')).toBe(13000);
    expect(ev('=ROUNDDOWN(12999,-3)')).toBe(12000);
    expect(ev('=ROUNDUP(5,0)')).toBe(5);
  });

  it('SUMPRODUCT: jumlah perkalian pasangan, ukuran harus sama', () => {
    expect(ev('=SUMPRODUCT(A1:A3,H1:H3)')).toBe(10 * 2 + 20 * 5 + 30 * 2);
    expect(ev('=SUMPRODUCT(A1:A3)')).toBe(60);
    expect(ev('=SUMPRODUCT(E2:G2,E3:G3)')).toBe(100 * 7 + 200 * 8 + 300 * 9);
    expect(ev('=SUMPRODUCT(C1:C5,A1:A5)')).toBe(5 * 10 + 15 * 30 + 25 * 50); // teks dan kosong dihitung 0
    expect(code('=SUMPRODUCT(A1:A3,H1:H4)')).toBe('#VALUE!');
  });
});

describe('logika bertingkat', () => {
  it('IFS memilih pasangan pertama yang benar dan memberi #N/A bila tidak ada', () => {
    expect(ev('=IFS(A1>40,"A",A1>5,"B",TRUE,"C")')).toBe('B');
    expect(ev('=IFS(A1>40,"A",TRUE,"C")')).toBe('C');
    expect(code('=IFS(A1>40,"A",A1>30,"B")')).toBe('#N/A');
    expect(code('=IFS(A1>40,"A",A1)')).toBe('#ERROR!');
    expect(ev('=IFS(A1>5,"ok",1/0,"x")')).toBe('ok'); // pasangan setelah yang benar tidak dihitung
  });

  it('SWITCH mencocokkan nilai, mendukung nilai bawaan, tidak peka huruf besar-kecil', () => {
    expect(ev('=SWITCH(B2,"apel",1,"jeruk",2,0)')).toBe(2);
    expect(ev('=SWITCH(B4,"apel",1,"jeruk",2,0)')).toBe(0);
    expect(ev('=SWITCH("JERUK",B1,1,B2,2)')).toBe(2);
    expect(ev('=SWITCH(A1,10,"sepuluh",20,"dua puluh")')).toBe('sepuluh');
    expect(code('=SWITCH(B4,"apel",1,"jeruk",2)')).toBe('#N/A');
  });
});

describe('teks', () => {
  it('SUBSTITUTE mengganti semua atau hanya kemunculan tertentu, membedakan huruf besar-kecil', () => {
    expect(ev('=SUBSTITUTE("a-b-c","-","/")')).toBe('a/b/c');
    expect(ev('=SUBSTITUTE("a-b-c","-","/",2)')).toBe('a-b/c');
    expect(ev('=SUBSTITUTE("a-b-c","-","/",5)')).toBe('a-b-c');
    expect(ev('=SUBSTITUTE("Apel apel","apel","X")')).toBe('Apel X');
    expect(ev('=SUBSTITUTE("abc","","X")')).toBe('abc');
    expect(code('=SUBSTITUTE("abc","b","X",0)')).toBe('#VALUE!');
  });

  it('FIND: posisi, membedakan huruf besar-kecil, titik awal, tidak ketemu', () => {
    expect(ev('=FIND("-","AB-12-C")')).toBe(3);
    expect(ev('=FIND("-","AB-12-C",4)')).toBe(6);
    expect(code('=FIND("b","ABC")')).toBe('#VALUE!');
    expect(ev('=FIND("B","ABC")')).toBe(2);
    expect(code('=FIND("x","ABC",9)')).toBe('#VALUE!');
    expect(ev('=LEFT("AB-12",FIND("-","AB-12")-1)')).toBe('AB');
  });

  it('CONCAT dan TEXTJOIN menerima rentang', () => {
    expect(ev('=CONCAT("a",1,TRUE)')).toBe('a1TRUE');
    expect(ev('=CONCAT(B1:B3)')).toBe('apeljerukapel');
    expect(ev('=TEXTJOIN(", ",TRUE,B1:B3)')).toBe('apel, jeruk, apel');
    expect(ev('=TEXTJOIN("-",TRUE,C1:C3)')).toBe('5-15'); // sel kosong dilewati
    expect(ev('=TEXTJOIN("-",FALSE,C1:C3)')).toBe('5--15');
  });

  it('TEXT: angka bergaya Indonesia, persen, nol di depan, dan teks dikembalikan apa adanya', () => {
    expect(ev('=TEXT(1234567.891,"#,##0")')).toBe('1.234.568');
    expect(ev('=TEXT(1234567.891,"#,##0.00")')).toBe('1.234.567,89');
    expect(ev('=TEXT(0.256,"0%")')).toBe('26%');
    expect(ev('=TEXT(0.256,"0.0%")')).toBe('25,6%');
    expect(ev('=TEXT(7,"000")')).toBe('007');
    expect(ev('=TEXT(3.14159,"0.00")')).toBe('3,14');
    expect(ev('=TEXT(-1500,"#,##0")')).toBe('-1.500');
    expect(ev('=TEXT("abc","0")')).toBe('abc');
    expect(code('=TEXT(5,"[Red]0")')).toBe('#VALUE!');
  });

  it('TEXT: tanggal dan jam dengan nama Indonesia', () => {
    const d = serial(2025, 3, 5); // Rabu
    expect(ev(`=TEXT(${d},"dd/mm/yyyy")`)).toBe('05/03/2025');
    expect(ev(`=TEXT(${d},"d mmmm yyyy")`)).toBe('5 Maret 2025');
    expect(ev(`=TEXT(${d},"dddd")`)).toBe('Rabu');
    expect(ev(`=TEXT(${d},"ddd, dd mmm yy")`)).toBe('Rab, 05 Mar 25');
    expect(ev(`=TEXT(${d}+0.5+45/1440,"hh:mm")`)).toBe('12:45');
    expect(ev(`=TEXT(${d},"yyyy-mm-dd")`)).toBe('2025-03-05');
  });
});

describe('tanggal dan waktu', () => {
  it('NOW memakai waktu Jakarta dengan pecahan hari', () => {
    const v = ev('=NOW()') as number;
    expect(Math.floor(v)).toBe(serial(2026, 10, 24));
    expect(v - Math.floor(v)).toBeCloseTo((12 * 3600 + 30 * 60 + 15) / 86_400, 6);
  });

  it('DATEDIF: tahun, bulan, sisa bulan, hari, dan urutan terbalik', () => {
    const a = serial(2020, 1, 31);
    const b = serial(2025, 3, 15);
    expect(ev(`=DATEDIF(${a},${b},"Y")`)).toBe(5);
    expect(ev(`=DATEDIF(${a},${b},"M")`)).toBe(61);
    expect(ev(`=DATEDIF(${a},${b},"YM")`)).toBe(1);
    expect(ev(`=DATEDIF(${a},${b},"D")`)).toBe(b - a);
    expect(ev(`=DATEDIF(${serial(2025, 3, 15)},${serial(2026, 3, 14)},"Y")`)).toBe(0);
    expect(ev(`=DATEDIF(${serial(2025, 3, 15)},${serial(2026, 3, 15)},"Y")`)).toBe(1);
    expect(code(`=DATEDIF(${b},${a},"Y")`)).toBe('#NUM!');
    expect(code(`=DATEDIF(${a},${b},"MD")`)).toBe('#NUM!');
  });

  it('EOMONTH: akhir bulan, maju dan mundur, tahun kabisat', () => {
    expect(ev(`=EOMONTH(${serial(2025, 1, 15)},0)`)).toBe(serial(2025, 1, 31));
    expect(ev(`=EOMONTH(${serial(2025, 1, 31)},1)`)).toBe(serial(2025, 2, 28));
    expect(ev(`=EOMONTH(${serial(2024, 1, 31)},1)`)).toBe(serial(2024, 2, 29));
    expect(ev(`=EOMONTH(${serial(2025, 3, 10)},-3)`)).toBe(serial(2024, 12, 31));
    expect(ev(`=EOMONTH(${serial(2025, 11, 10)},3)`)).toBe(serial(2026, 2, 28));
  });

  it('NETWORKDAYS: hari kerja Senin sampai Jumat, libur, dan urutan terbalik', () => {
    // 6 Jan 2025 (Senin) sampai 12 Jan 2025 (Minggu) = 5 hari kerja
    expect(ev(`=NETWORKDAYS(${serial(2025, 1, 6)},${serial(2025, 1, 12)})`)).toBe(5);
    expect(ev(`=NETWORKDAYS(${serial(2025, 1, 6)},${serial(2025, 1, 6)})`)).toBe(1);
    expect(ev(`=NETWORKDAYS(${serial(2025, 1, 11)},${serial(2025, 1, 12)})`)).toBe(0);
    expect(ev(`=NETWORKDAYS(${serial(2025, 1, 6)},${serial(2025, 1, 17)})`)).toBe(10);
    expect(ev(`=NETWORKDAYS(${serial(2025, 1, 12)},${serial(2025, 1, 6)})`)).toBe(-5);
    expect(
      ev(`=NETWORKDAYS(${serial(2025, 1, 6)},${serial(2025, 1, 10)},I1:I2)`, { I1: String(serial(2025, 1, 8)), I2: String(serial(2025, 1, 9)) }),
    ).toBe(3);
  });
});

describe('HLOOKUP', () => {
  it('mencari di baris pertama, tepat dan perkiraan', () => {
    expect(ev('=HLOOKUP("Selasa",E1:G3,2,FALSE)')).toBe(200);
    expect(ev('=HLOOKUP("selasa",E1:G3,3,FALSE)')).toBe(8);
    expect(code('=HLOOKUP("Kamis",E1:G3,2,FALSE)')).toBe('#N/A');
    expect(code('=HLOOKUP("Rabu",E1:G3,4,FALSE)')).toBe('#REF!');
    expect(code('=HLOOKUP("Rabu",E1:G3,0,FALSE)')).toBe('#VALUE!');
    expect(ev('=HLOOKUP(25,J1:L2,2)', { J1: '0', K1: '10', L1: '50', J2: 'a', K2: 'b', L2: 'c' })).toBe('b');
  });
});
