import { describe, expect, it } from 'vitest';
import { Sheet, buildMatcher, extractFunctions, extractReferences, formatValue, isError, parseFormula } from './index';

const v = (cells: Record<string, string>, ref: string) => new Sheet(cells).getValue(ref);
const num = (cells: Record<string, string>, ref: string) => {
  const r = v(cells, ref);
  if (isError(r)) throw new Error(`${r.code}: ${r.message}`);
  return r;
};
const code = (cells: Record<string, string>, ref: string) => {
  const r = v(cells, ref);
  return isError(r) ? r.code : `bukan galat: ${String(r)}`;
};

const data = { A1: '10', A2: '20', A3: '30', A4: 'teks', A5: '', A6: '40' };

describe('literal dan aritmetika', () => {
  it('membaca angka, teks, dan boolean', () => {
    expect(v({ A1: '12.5', A2: 'Beras', A3: 'true' }, 'A1')).toBe(12.5);
    expect(v({ A2: 'Beras' }, 'A2')).toBe('Beras');
    expect(v({ A3: 'true' }, 'A3')).toBe(true);
    expect(v({}, 'Z9')).toBeNull();
  });
  it('mengikuti urutan operator', () => {
    expect(num({ A1: '=2+3*4' }, 'A1')).toBe(14);
    expect(num({ A1: '=(2+3)*4' }, 'A1')).toBe(20);
    expect(num({ A1: '=2^3^2' }, 'A1')).toBe(64); // kiri-ke-kanan seperti Excel
    expect(num({ A1: '=-3+10%' }, 'A1')).toBeCloseTo(-2.9);
  });
  it('menghilangkan derau floating point', () => {
    expect(num({ A1: '=0.1+0.2' }, 'A1')).toBe(0.3);
  });
  it('referensi sel dan referensi absolut', () => {
    expect(num({ A1: '5', B1: '=$A$1*2' }, 'B1')).toBe(10);
    expect(num({ a1: '5', B1: '=a1+1' }, 'B1')).toBe(6);
  });
  it('sel kosong dihitung 0 dalam aritmetika', () => {
    expect(num({ B1: '=A1+5' }, 'B1')).toBe(5);
  });
  it('teks dalam aritmetika menghasilkan #VALUE!', () => {
    expect(code({ A1: 'abc', B1: '=A1+1' }, 'B1')).toBe('#VALUE!');
  });
  it('teks angka dalam kutip dikonversi', () => {
    expect(num({ A1: '="5"+1' }, 'A1')).toBe(6);
  });
  it('pembagian dengan nol', () => {
    expect(code({ A1: '=1/0' }, 'A1')).toBe('#DIV/0!');
    expect(code({ A1: '0', B1: '=5/A1' }, 'B1')).toBe('#DIV/0!');
  });
  it('perbandingan dan penggabungan teks', () => {
    expect(v({ A1: '=3>2' }, 'A1')).toBe(true);
    expect(v({ A1: '="a"="A"' }, 'A1')).toBe(true);
    expect(v({ A1: '="Halo "&"Dunia"' }, 'A1')).toBe('Halo Dunia');
    expect(v({ A1: '=1<>1' }, 'A1')).toBe(false);
  });
});

describe('SUM / AVERAGE / MIN / MAX', () => {
  it('SUM mengabaikan teks dan sel kosong dalam rentang', () => {
    expect(num(data, 'A1')).toBe(10);
    expect(num({ ...data, B1: '=SUM(A1:A6)' }, 'B1')).toBe(100);
  });
  it('SUM menerima beberapa argumen dan pemisah titik koma', () => {
    expect(num({ A1: '=SUM(1;2;3)' }, 'A1')).toBe(6);
    expect(num({ A1: '=SUM(1,2,3)' }, 'A1')).toBe(6);
  });
  it('SUM argumen langsung berupa teks non-angka adalah #VALUE!', () => {
    expect(code({ A1: '=SUM("abc")' }, 'A1')).toBe('#VALUE!');
  });
  it('AVERAGE membagi dengan jumlah angka saja', () => {
    expect(num({ ...data, B1: '=AVERAGE(A1:A6)' }, 'B1')).toBe(25);
  });
  it('AVERAGE tanpa angka -> #DIV/0!', () => {
    expect(code({ A1: 'a', B1: '=AVERAGE(A1:A3)' }, 'B1')).toBe('#DIV/0!');
  });
  it('MIN dan MAX', () => {
    expect(num({ ...data, B1: '=MIN(A1:A6)' }, 'B1')).toBe(10);
    expect(num({ ...data, B1: '=MAX(A1:A6)' }, 'B1')).toBe(40);
    expect(num({ B1: '=MAX(A1:A3)' }, 'B1')).toBe(0);
  });
  it('galat dalam rentang merambat', () => {
    expect(code({ A1: '=1/0', A2: '5', B1: '=SUM(A1:A2)' }, 'B1')).toBe('#DIV/0!');
  });
  it('desimal presisi', () => {
    expect(num({ A1: '0.1', A2: '0.2', B1: '=SUM(A1:A2)' }, 'B1')).toBe(0.3);
  });
});

describe('COUNT / COUNTA', () => {
  it('COUNT hanya menghitung angka', () => {
    expect(num({ ...data, B1: '=COUNT(A1:A6)' }, 'B1')).toBe(4);
  });
  it('COUNTA menghitung semua sel tidak kosong', () => {
    expect(num({ ...data, B1: '=COUNTA(A1:A6)' }, 'B1')).toBe(5);
  });
});

describe('IF / AND / OR / IFERROR', () => {
  it('IF memilih cabang', () => {
    expect(v({ A1: '70', B1: '=IF(A1>=60,"Lulus","Remedial")' }, 'B1')).toBe('Lulus');
    expect(v({ A1: '50', B1: '=IF(A1>=60,"Lulus","Remedial")' }, 'B1')).toBe('Remedial');
  });
  it('IF tanpa argumen salah menghasilkan FALSE', () => {
    expect(v({ A1: '=IF(1>2,"x")' }, 'A1')).toBe(false);
  });
  it('IF bersarang', () => {
    const f = '=IF(A1>=80,"A",IF(A1>=70,"B","C"))';
    expect(v({ A1: '75', B1: f }, 'B1')).toBe('B');
  });
  it('IF malas: cabang tidak terpilih tidak dievaluasi', () => {
    expect(v({ A1: '=IF(TRUE,1,1/0)' }, 'A1')).toBe(1);
  });
  it('AND dan OR', () => {
    expect(v({ A1: '=AND(1>0,2>1)' }, 'A1')).toBe(true);
    expect(v({ A1: '=AND(1>0,2<1)' }, 'A1')).toBe(false);
    expect(v({ A1: '=OR(1<0,2>1)' }, 'A1')).toBe(true);
    expect(v({ A1: '=OR(1<0,2<1)' }, 'A1')).toBe(false);
  });
  it('AND tanpa nilai logika -> #VALUE!', () => {
    expect(code({ A1: 'x', B1: '=AND(A1:A1)' }, 'B1')).toBe('#VALUE!');
  });
  it('IFERROR menangkap galat', () => {
    expect(v({ A1: '=IFERROR(1/0,"Nol")' }, 'A1')).toBe('Nol');
    expect(v({ A1: '=IFERROR(4/2,"Nol")' }, 'A1')).toBe(2);
  });
  it('IF dengan kondisi teks bukan boolean -> #VALUE!', () => {
    expect(code({ A1: '=IF("abc",1,2)' }, 'A1')).toBe('#VALUE!');
  });
});

describe('COUNTIF / SUMIF / COUNTIFS / SUMIFS', () => {
  const t = {
    A1: 'Beras',
    B1: '10',
    C1: 'Lunas',
    A2: 'Gula',
    B2: '20',
    C2: 'Belum',
    A3: 'beras',
    B3: '30',
    C3: 'Lunas',
    A4: 'Minyak',
    B4: '40',
    C4: 'Lunas',
  };
  it('COUNTIF teks tidak peka huruf besar-kecil', () => {
    expect(num({ ...t, E1: '=COUNTIF(A1:A4,"Beras")' }, 'E1')).toBe(2);
  });
  it('COUNTIF kriteria numerik dan operator', () => {
    expect(num({ ...t, E1: '=COUNTIF(B1:B4,">15")' }, 'E1')).toBe(3);
    expect(num({ ...t, E1: '=COUNTIF(B1:B4,"<=20")' }, 'E1')).toBe(2);
    expect(num({ ...t, E1: '=COUNTIF(B1:B4,30)' }, 'E1')).toBe(1);
    expect(num({ ...t, E1: '=COUNTIF(C1:C4,"<>Lunas")' }, 'E1')).toBe(1);
  });
  it('COUNTIF dengan wildcard', () => {
    expect(num({ ...t, E1: '=COUNTIF(A1:A4,"*as")' }, 'E1')).toBe(2);
    expect(num({ ...t, E1: '=COUNTIF(A1:A4,"?ula")' }, 'E1')).toBe(1);
  });
  it('COUNTIF kriteria dari referensi sel', () => {
    expect(num({ ...t, D1: 'Gula', E1: '=COUNTIF(A1:A4,D1)' }, 'E1')).toBe(1);
  });
  it('SUMIF dengan rentang jumlah', () => {
    expect(num({ ...t, E1: '=SUMIF(C1:C4,"Lunas",B1:B4)' }, 'E1')).toBe(80);
  });
  it('SUMIF tanpa rentang jumlah menjumlahkan rentang kriteria', () => {
    expect(num({ ...t, E1: '=SUMIF(B1:B4,">15")' }, 'E1')).toBe(90);
  });
  it('COUNTIFS dan SUMIFS memakai semua kriteria (DAN)', () => {
    expect(num({ ...t, E1: '=COUNTIFS(C1:C4,"Lunas",B1:B4,">15")' }, 'E1')).toBe(2);
    expect(num({ ...t, E1: '=SUMIFS(B1:B4,C1:C4,"Lunas",A1:A4,"Beras")' }, 'E1')).toBe(40);
  });
  it('ukuran rentang berbeda -> #VALUE!', () => {
    expect(code({ ...t, E1: '=COUNTIFS(A1:A4,"x",B1:B3,">1")' }, 'E1')).toBe('#VALUE!');
    expect(code({ ...t, E1: '=SUMIFS(B1:B3,C1:C4,"Lunas")' }, 'E1')).toBe('#VALUE!');
  });
  it('kriteria bukan rentang untuk argumen pertama -> #VALUE!', () => {
    expect(code({ E1: '=COUNTIF(5,"x")' }, 'E1')).toBe('#VALUE!');
  });
  it('buildMatcher kosong', () => {
    expect(buildMatcher('')(null)).toBe(true);
    expect(buildMatcher('<>')(null)).toBe(false);
  });
});

describe('rumus tidak valid', () => {
  it.each([
    ['=SUM(', '#ERROR!'],
    ['=SUM(1,2', '#ERROR!'],
    ['=1+', '#ERROR!'],
    ['=)', '#ERROR!'],
    ['=SUM(1,,2)', '#ERROR!'],
    ['=', '#ERROR!'],
    ['="abc', '#ERROR!'],
    ['=1 2', '#ERROR!'],
    ['=@A1', '#ERROR!'],
  ])('menolak %s', (f, c) => {
    expect(code({ A1: f }, 'A1')).toBe(c);
  });
  it('menolak fungsi tak didukung', () => {
    expect(code({ A1: '=UNIQUE(A1:B2)' }, 'A1')).toBe('#NAME?');
    expect(code({ A1: '=eval("1")' }, 'A1')).toBe('#NAME?');
    expect(code({ A1: '=CONSTRUCTOR("x")' }, 'A1')).toBe('#NAME?');
  });
  it('nama tak dikenal -> #NAME?', () => {
    expect(code({ A1: '=Beras+1' }, 'A1')).toBe('#NAME?');
  });
  it('jumlah argumen salah', () => {
    expect(code({ A1: '=IF(1)' }, 'A1')).toBe('#ERROR!');
    expect(code({ A1: '=IF(1,2,3,4)' }, 'A1')).toBe('#ERROR!');
    expect(code({ A1: '=SUM()' }, 'A1')).toBe('#ERROR!');
    expect(code({ A1: '=COUNTIF(B1:B2)' }, 'A1')).toBe('#ERROR!');
    expect(code({ A1: '=SUMIFS(B1:B2,C1:C2)' }, 'A1')).toBe('#ERROR!');
    expect(code({ A1: '=IFERROR(1)' }, 'A1')).toBe('#ERROR!');
  });
  it('referensi di luar batas -> #REF!', () => {
    expect(code({ A1: '=ZZZ1' }, 'A1')).toBe('#REF!');
    expect(code({ A1: '=A99999' }, 'A1')).toBe('#REF!');
    expect(code({ A1: '=SUM(A1:A99999)' }, 'A1')).toBe('#REF!');
  });
  it('parseFormula melempar galat terstruktur', () => {
    expect(() => parseFormula('=SUM(')).toThrow();
  });
  it('rentang sebagai nilai tunggal -> #VALUE!', () => {
    expect(code({ A1: '=B1:B3+1' }, 'A1')).toBe('#VALUE!');
    expect(code({ A1: '=B1:B3' }, 'A1')).toBe('#VALUE!');
  });
});

describe('referensi melingkar dan batas sumber daya', () => {
  it('mendeteksi referensi diri sendiri', () => {
    expect(code({ A1: '=A1+1' }, 'A1')).toBe('#CIRC!');
  });
  it('mendeteksi siklus tidak langsung', () => {
    const cells = { A1: '=B1', B1: '=C1', C1: '=A1' };
    expect(code(cells, 'A1')).toBe('#CIRC!');
    expect(code(cells, 'B1')).toBe('#CIRC!');
    expect(code(cells, 'C1')).toBe('#CIRC!');
  });
  it('rantai panjang tanpa siklus tetap dihitung bila di bawah batas kedalaman', () => {
    const cells: Record<string, string> = { A1: '1' };
    for (let i = 2; i <= 50; i++) cells[`A${i}`] = `=A${i - 1}+1`;
    expect(num(cells, 'A50')).toBe(50);
  });
  it('rantai terlalu dalam dihentikan, bukan stack overflow', () => {
    const cells: Record<string, string> = { A1: '1' };
    for (let i = 2; i <= 500; i++) cells[`A${i}`] = `=A${i - 1}+1`;
    expect(code(cells, 'A500')).toBe('#LIMIT!');
  });
  it('rentang terlalu besar ditolak saat parsing', () => {
    expect(code({ A1: '=SUM(A1:ZZ1000)' }, 'A1')).toBe('#LIMIT!');
  });
  it('rumus terlalu panjang atau bersarang ditolak', () => {
    expect(code({ A1: '=' + '1+'.repeat(600) + '1' }, 'A1')).toBe('#LIMIT!');
    expect(code({ A1: '=' + '('.repeat(100) + '1' + ')'.repeat(100) }, 'A1')).toBe('#LIMIT!');
  });
  it('anggaran langkah mencegah komputasi berlebihan', () => {
    const s = new Sheet(
      { A1: '=SUM(B1:B100)', ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`B${i + 1}`, '1'])) },
      { maxSteps: 50 },
    );
    const r = s.getValue('A1');
    expect(isError(r) && r.code).toBe('#LIMIT!');
  });
  it('IFERROR tidak menutupi batas sumber daya', () => {
    const cells: Record<string, string> = {
      A1: '=IFERROR(A2,0)',
      ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`B${i + 1}`, '1'])),
      A2: '=SUM(B1:B100)',
    };
    const r = new Sheet(cells, { maxSteps: 50 }).getValue('A1');
    expect(isError(r) && r.code).toBe('#LIMIT!');
  });
});

describe('utilitas', () => {
  it('extractReferences dan extractFunctions', () => {
    expect(extractReferences('=SUM(B2:B6)+A1')).toEqual(['B2:B6', 'A1']);
    expect(extractFunctions('=if(a1>1,SUM(B1:B2),0)').sort()).toEqual(['IF', 'SUM']);
    expect(extractReferences('=SUM(')).toEqual([]);
  });
  it('formatValue memakai format Indonesia', () => {
    expect(formatValue(15000.5)).toBe('15.000,5');
    expect(formatValue(2026)).toBe('2026'); // tahun tidak diberi pemisah ribuan
    expect(formatValue(1500.5)).toBe('1500,5');
    expect(formatValue(true)).toBe('TRUE');
    expect(formatValue(null)).toBe('');
  });
  it('setCell menghitung ulang', () => {
    const s = new Sheet({ A1: '1', B1: '=A1*2' });
    expect(s.getValue('B1')).toBe(2);
    s.setCell('A1', '5');
    expect(s.getValue('B1')).toBe(10);
  });
});
