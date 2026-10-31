import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { Sheet, expandRef, indexToCol, isError } from '@excellab/spreadsheet-engine';
import { worksheets, type WorksheetDef } from '@excellab/shared';

/** Isi sel: teks/angka biasa, atau rumus dengan hasil opsional (dipakai bila fungsi belum didukung mesin Mahir Excel). */
type Cell = string | number | { f: string; r?: string | number };

interface SheetSpec {
  name: string;
  cells: Record<string, Cell>;
  dates?: Record<string, Date>;
  /** Sel judul kolom (diberi gaya tebal dengan latar hijau muda). */
  headers: string[];
  /** Sel yang harus diisi peserta. Kosong di file latihan, terisi di file kunci. */
  answers?: string[];
  widths: number[];
  /** Format angka per sel atau rentang. */
  formats?: Record<string, string>;
  freezeHeader?: boolean;
}

interface Plan {
  practice: SheetSpec[];
  key: SheetSpec[];
}

export const RP = '"Rp" #,##0';
const DATE = 'dd/mm/yyyy';
const PCT = '0%';

function table(headers: string[], rows: Cell[][], startRow = 1, startCol = 0): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  headers.forEach((h, c) => (out[`${indexToCol(startCol + c)}${startRow}`] = h));
  rows.forEach((row, r) => row.forEach((v, c) => (out[`${indexToCol(startCol + c)}${startRow + 1 + r}`] = v)));
  return out;
}

const range = (col: string, from: number, to: number): string[] => Array.from({ length: to - from + 1 }, (_, i) => `${col}${from + i}`);
const f = (formula: string, r?: string | number): Cell => ({ f: formula, r });
const day = (m: number, d: number): Date => new Date(Date.UTC(2025, m - 1, d));

/** Satu spesifikasi untuk file latihan (jawaban kosong) dan kunci (jawaban terisi). */
function standard(specs: SheetSpec[]): Plan {
  return { practice: specs, key: specs };
}

// ------------------------------------------------------------------ rencana per worksheet

const plans: Record<string, () => Plan> = {
  'anggaran-bulanan': () =>
    standard([
      {
        name: 'Latihan',
        cells: {
          ...table(
            ['Pemasukan', 'Jumlah (Rp)'],
            [
              ['Gaji', 6000000],
              ['Freelance', 1500000],
              ['Total pemasukan', f('SUM(B2:B3)')],
            ],
          ),
          ...table(
            ['Pengeluaran', 'Jumlah (Rp)'],
            [
              ['Sewa kos', 1500000],
              ['Makan', 1800000],
              ['Transport', 400000],
              ['Pulsa dan internet', 250000],
              ['Hiburan', 300000],
              ['Tabungan', 1000000],
              ['Total pengeluaran', f('SUM(B7:B12)')],
            ],
            6,
          ),
          A15: 'Sisa uang',
          B15: f('B4-B13'),
        },
        headers: ['A1', 'B1', 'A6', 'B6'],
        answers: ['B4', 'B13', 'B15'],
        widths: [28, 18],
        formats: { 'B2:B15': RP },
      },
    ]),

  'rekap-penjualan': () => {
    const items: [string, number, number][] = [
      ['Beras 5 kg', 68000, 3],
      ['Minyak 2 L', 36000, 5],
      ['Gula 1 kg', 16000, 10],
      ['Telur 1 kg', 28000, 4],
      ['Tepung 1 kg', 12000, 8],
      ['Kopi 200 g', 22000, 6],
      ['Teh 100 g', 9000, 12],
      ['Susu 1 L', 19000, 7],
      ['Mie instan', 3500, 40],
      ['Sabun', 5000, 15],
    ];
    const rows = items.map(([p, h, j], i) => [p, h, j, f(`C${i + 2}*D${i + 2}`)]);
    return standard([
      {
        name: 'Latihan',
        cells: {
          ...table(
            ['Tanggal', 'Produk', 'Harga', 'Jumlah', 'Total'],
            rows.map((r, i) => [`#d${i}`, ...r]),
          ),
          G1: 'Total penjualan',
          H1: f('SUM(E2:E11)'),
          G2: 'Rata-rata per transaksi',
          H2: f('AVERAGE(E2:E11)'),
          G3: 'Transaksi terbesar',
          H3: f('MAX(E2:E11)'),
        },
        dates: Object.fromEntries(items.map((_, i) => [`A${i + 2}`, day(1, i + 2)])),
        headers: ['A1', 'B1', 'C1', 'D1', 'E1'],
        answers: [...range('E', 2, 11), 'H1', 'H2', 'H3'],
        widths: [14, 20, 14, 10, 16, 3, 26, 18],
        formats: { 'A2:A11': DATE, 'C2:C11': RP, 'E2:E11': RP, 'H1:H3': RP },
        freezeHeader: true,
      },
    ]);
  },

  'stok-barang': () => {
    const d: [string, number, number, number, number][] = [
      ['Beras 5 kg', 40, 20, 35, 15],
      ['Minyak 2 L', 30, 0, 22, 10],
      ['Gula 1 kg', 50, 30, 60, 20],
      ['Telur 1 kg', 25, 10, 30, 10],
      ['Tepung 1 kg', 20, 0, 5, 8],
      ['Kopi 200 g', 15, 10, 18, 6],
      ['Teh 100 g', 30, 0, 12, 10],
      ['Susu 1 L', 18, 12, 25, 10],
    ];
    const rows = d.map(([n, a, m, k, min], i) => [
      n,
      a,
      m,
      k,
      f(`B${i + 2}+C${i + 2}-D${i + 2}`),
      min,
      f(`IF(E${i + 2}<F${i + 2},"Pesan","Aman")`),
    ]);
    return standard([
      {
        name: 'Latihan',
        cells: {
          ...table(['Barang', 'Stok Awal', 'Masuk', 'Keluar', 'Stok Akhir', 'Batas Minimum', 'Status'], rows),
          I1: 'Stok akhir terendah',
          J1: f('MIN(E2:E9)'),
        },
        headers: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'],
        answers: [...range('E', 2, 9), ...range('G', 2, 9), 'J1'],
        widths: [18, 11, 9, 9, 12, 16, 10, 3, 22, 10],
        freezeHeader: true,
      },
    ]);
  },

  'absensi-karyawan': () => {
    const att = ['HHHHHSHHHH', 'HHHIHHHHHH', 'HAHHHHSHHH', 'HHHHHHHHHH', 'SHHHAHHIHH', 'HHHHHHHAHH'];
    const names = ['Ani', 'Budi', 'Citra', 'Dedi', 'Eka', 'Fajar'];
    const heads = ['Nama', ...Array.from({ length: 10 }, (_, i) => `H${i + 1}`), 'Hadir', '% Hadir'];
    const rows = names.map((n, i) => [n, ...att[i]!.split(''), f(`COUNTIF(B${i + 2}:K${i + 2},"H")`), f(`L${i + 2}/$P$1`)]);
    return standard([
      {
        name: 'Latihan',
        cells: {
          ...table(heads, rows),
          O1: 'Total hari kerja',
          P1: 10,
          O2: 'Keterangan',
          P2: 'H=Hadir, S=Sakit, I=Izin, A=Alpa',
          O3: 'Karyawan dengan kehadiran minimal 90%',
          P3: f('COUNTIF(M2:M7,">=0.9")'),
        },
        headers: ['A1', ...Array.from({ length: 12 }, (_, i) => `${indexToCol(i + 1)}1`)],
        answers: [...range('L', 2, 7), ...range('M', 2, 7), 'P3'],
        widths: [12, ...Array(10).fill(5), 9, 10, 3, 38, 34],
        formats: { 'M2:M7': PCT },
        freezeHeader: true,
      },
    ]);
  },

  'rekap-nilai-siswa': () => {
    const d: [string, number, number, number][] = [
      ['Ani', 85, 78, 82],
      ['Beni', 70, 65, 60],
      ['Citra', 90, 88, 92],
      ['Dedi', 75, 70, 68],
      ['Eka', 60, 55, 72],
      ['Fajar', 80, 85, 78],
      ['Gita', 95, 90, 88],
      ['Hadi', 65, 60, 58],
    ];
    const rows = d.map(([n, t, u, a], i) => [
      n,
      t,
      u,
      a,
      f(`B${i + 2}*$I$1+C${i + 2}*$I$2+D${i + 2}*$I$3`),
      f(`IF(E${i + 2}>=$I$4,"Lulus","Remedial")`),
    ]);
    return standard([
      {
        name: 'Latihan',
        cells: {
          ...table(['Siswa', 'Tugas', 'UTS', 'UAS', 'Nilai Akhir', 'Status'], rows),
          H1: 'Bobot Tugas',
          I1: 0.3,
          H2: 'Bobot UTS',
          I2: 0.3,
          H3: 'Bobot UAS',
          I3: 0.4,
          H4: 'KKM',
          I4: 70,
          H6: 'Rata-rata kelas',
          I6: f('AVERAGE(E2:E9)'),
          H7: 'Nilai tertinggi',
          I7: f('MAX(E2:E9)'),
          H8: 'Nilai terendah',
          I8: f('MIN(E2:E9)'),
        },
        headers: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'],
        answers: [...range('E', 2, 9), ...range('F', 2, 9), 'I6', 'I7', 'I8'],
        widths: [14, 9, 9, 9, 13, 11, 3, 18, 10],
        formats: { 'E2:E9': '0.0', I6: '0.0', 'I1:I3': PCT },
        freezeHeader: true,
      },
    ]);
  },

  'latihan-if': () => {
    const q: [string, Cell, Cell, Cell][] = [
      ['Lulus jika Data A (nilai) minimal 70, selain itu "Remedial"', 82, '', f('IF(C2>=70,"Lulus","Remedial")')],
      ['Sama seperti soal 1', 65, '', f('IF(C3>=70,"Lulus","Remedial")')],
      ['Bonus 10% dari Data A (penjualan) jika minimal 5000000, selain itu 0', 6000000, '', f('IF(C4>=5000000,C4*0.1,0)')],
      [
        'AND: "Ya" jika Data A (nilai) minimal 85 DAN Data B (kehadiran) minimal 90, selain itu "Tidak"',
        90,
        95,
        f('IF(AND(C5>=85,D5>=90),"Ya","Tidak")'),
      ],
      ['Sama seperti soal 4', 88, 80, f('IF(AND(C6>=85,D6>=90),"Ya","Tidak")')],
      [
        'OR: diskon 10% dari Data A (belanja) jika belanja minimal 500000 ATAU Data B = "Ya" (member), selain itu 0',
        200000,
        'Ya',
        f('IF(OR(C7>=500000,D7="Ya"),C7*0.1,0)'),
      ],
      ['Sama seperti soal 6', 600000, 'Tidak', f('IF(OR(C8>=500000,D8="Ya"),C8*0.1,0)')],
      ['IF bertingkat: "A" jika Data A minimal 85, "B" jika minimal 70, selain itu "C"', 78, '', f('IF(C9>=85,"A",IF(C9>=70,"B","C"))')],
      ['Sama seperti soal 8', 91, '', f('IF(C10>=85,"A",IF(C10>=70,"B","C"))')],
      ['IFERROR: Data A dibagi Data B, tampilkan "-" jika galat', 100000, 0, f('IFERROR(C11/D11,"-")')],
    ];
    const rows = q.map(([s, a, b2, ans], i) => [i + 1, s, a, b2, ans]);
    return standard([
      {
        name: 'Latihan',
        cells: table(['No', 'Soal', 'Data A', 'Data B', 'Jawaban'], rows),
        headers: ['A1', 'B1', 'C1', 'D1', 'E1'],
        answers: range('E', 2, 11),
        widths: [5, 70, 14, 12, 16],
        freezeHeader: true,
      },
    ]);
  },

  'latihan-sumif-countif': () => {
    const d: [string, string, string, number, string][] = [
      ['Makanan', 'Beras', 'Jakarta', 300000, 'Lunas'],
      ['Minuman', 'Teh', 'Bandung', 120000, 'Belum'],
      ['Makanan', 'Mie', 'Bandung', 80000, 'Lunas'],
      ['Minuman', 'Kopi', 'Jakarta', 150000, 'Lunas'],
      ['Makanan', 'Roti', 'Jakarta', 90000, 'Belum'],
      ['Minuman', 'Susu', 'Bandung', 110000, 'Lunas'],
      ['Makanan', 'Gula', 'Jakarta', 70000, 'Lunas'],
      ['Snack', 'Keripik', 'Surabaya', 60000, 'Lunas'],
      ['Snack', 'Coklat', 'Jakarta', 130000, 'Belum'],
      ['Makanan', 'Minyak', 'Surabaya', 200000, 'Lunas'],
      ['Minuman', 'Jus', 'Surabaya', 85000, 'Belum'],
      ['Snack', 'Biskuit', 'Bandung', 45000, 'Lunas'],
    ];
    return standard([
      {
        name: 'Latihan',
        cells: {
          ...table(['Kategori', 'Produk', 'Kota', 'Penjualan', 'Status'], d),
          G1: 'Soal',
          H1: 'Jawaban',
          G2: 'Jumlah transaksi berstatus Lunas (COUNTIF)',
          H2: f('COUNTIF(E2:E13,"Lunas")'),
          G3: 'Total penjualan kategori Makanan (SUMIF)',
          H3: f('SUMIF(A2:A13,"Makanan",D2:D13)'),
          G4: 'Jumlah transaksi di Jakarta (COUNTIF)',
          H4: f('COUNTIF(C2:C13,"Jakarta")'),
          G5: 'Jumlah transaksi Lunas dengan penjualan minimal 100000 (COUNTIFS)',
          H5: f('COUNTIFS(E2:E13,"Lunas",D2:D13,">=100000")'),
          G6: 'Total penjualan Makanan di Jakarta (SUMIFS)',
          H6: f('SUMIFS(D2:D13,A2:A13,"Makanan",C2:C13,"Jakarta")'),
          G7: 'Total penjualan Minuman yang belum lunas (SUMIFS)',
          H7: f('SUMIFS(D2:D13,A2:A13,"Minuman",E2:E13,"Belum")'),
        },
        headers: ['A1', 'B1', 'C1', 'D1', 'E1', 'G1', 'H1'],
        answers: range('H', 2, 7),
        widths: [12, 12, 12, 14, 10, 3, 64, 16],
        formats: { 'D2:D13': RP, H3: RP, H6: RP, H7: RP },
        freezeHeader: true,
      },
    ]);
  },

  'gaji-lembur': () => {
    const staff: [string, string, number, number][] = [
      ['Ani', 'Admin', 5000000, 8],
      ['Budi', 'Gudang', 4000000, 12],
      ['Citra', 'Admin', 5500000, 2],
      ['Dedi', 'Gudang', 4200000, 15],
      ['Eka', 'Marketing', 6000000, 5],
      ['Fajar', 'Marketing', 6500000, 10],
      ['Gita', 'Admin', 5200000, 6],
      ['Hadi', 'Gudang', 3900000, 20],
    ];
    const allowance: [string, number][] = [
      ['Admin', 300000],
      ['Gudang', 250000],
      ['Marketing', 400000],
    ];
    const rows = staff.map(([n, d, g, j], i) => {
      const r = i + 2;
      return [n, d, g, j, f(`D${r}*$J$1`), f(`VLOOKUP(B${r},$I$4:$J$6,2,FALSE)`), f(`C${r}+E${r}+F${r}`)];
    });
    return standard([
      {
        name: 'Latihan',
        cells: {
          ...table(['Nama', 'Divisi', 'Gaji Pokok', 'Jam Lembur', 'Upah Lembur', 'Tunjangan', 'Total Gaji'], rows),
          I1: 'Tarif lembur per jam',
          J1: 25000,
          ...table(['Divisi', 'Tunjangan'], allowance, 3, 8),
          I8: 'Total gaji semua karyawan',
          J8: f('SUM(G2:G9)'),
          I9: 'Gaji pokok tertinggi di Gudang',
          J9: f('MAXIFS(C2:C9,B2:B9,"Gudang")'),
          I10: 'Karyawan lembur lebih dari 10 jam',
          J10: f('COUNTIF(D2:D9,">10")'),
        },
        headers: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'I3', 'J3'],
        answers: [...range('E', 2, 9), ...range('F', 2, 9), ...range('G', 2, 9), 'J8', 'J9', 'J10'],
        widths: [12, 12, 14, 12, 14, 14, 14, 3, 34, 14],
        formats: { 'C2:C9': RP, 'E2:G9': RP, 'J1': RP, 'J4:J6': RP, 'J8:J9': RP },
        freezeHeader: true,
      },
    ]);
  },

  'latihan-lookup': () => {
    const price: [string, string, number][] = [
      ['BRS', 'Beras 5 kg', 68000],
      ['MNY', 'Minyak 2 L', 36000],
      ['GLA', 'Gula 1 kg', 16000],
      ['TLR', 'Telur 1 kg', 28000],
      ['KPI', 'Kopi 200 g', 22000],
    ];
    const lookup = (code: string, col: 1 | 2): string | number => {
      const p = price.find((x) => x[0] === code)!;
      return p[col];
    };
    const tx: [string, number][] = [
      ['GLA', 10],
      ['BRS', 2],
      ['KPI', 6],
      ['TLR', 4],
      ['MNY', 3],
      ['BRS', 1],
      ['GLA', 5],
      ['KPI', 2],
    ];
    const rows = tx.map(([c, j], i) => {
      const r = i + 2;
      const harga = lookup(c, 2) as number;
      return [c, j, f(`VLOOKUP(A${r},$G$2:$I$6,2,FALSE)`, lookup(c, 1)), f(`VLOOKUP(A${r},$G$2:$I$6,3,FALSE)`, harga), f(`B${r}*D${r}`)];
    });
    return standard([
      {
        name: 'Latihan',
        cells: { ...table(['Kode', 'Jumlah', 'Nama Barang', 'Harga', 'Total'], rows), ...table(['Kode', 'Nama', 'Harga'], price, 1, 6) },
        headers: ['A1', 'B1', 'C1', 'D1', 'E1', 'G1', 'H1', 'I1'],
        answers: [...range('C', 2, 9), ...range('D', 2, 9), ...range('E', 2, 9)],
        widths: [10, 10, 16, 14, 16, 3, 10, 16, 14],
        formats: { 'D2:E9': RP, 'I2:I6': RP },
        freezeHeader: true,
      },
    ]);
  },

  'latihan-merapikan-data': () => {
    const messy: [string, string, string | number, string][] = [
      ['Ani Lestari', 'jakarta', 'Rp 15000', '12/01/2025'],
      ['Budi Santoso', 'JAKARTA ', 15000, '12/01/2025'],
      ['Citra Dewi', 'Bandung', 17500, '13/01/2025'],
      ['Dedi Pratama', ' bandung', '18000', '13/01/2025'],
      ['Eka Putri', 'Surabaya', 'Rp 12000', '14/01/2025'],
      ['Ani Lestari', 'jakarta', 'Rp 15000', '12/01/2025'],
      ['Fajar Nugroho', 'Surabaya ', 20000, '15/01/2025'],
      ['Gita Maharani', 'jakarta', 14000, '15/01/2025'],
    ];
    const clean: [string, string, number, string][] = [
      ['Ani Lestari', 'Jakarta', 15000, '12/01/2025'],
      ['Budi Santoso', 'Jakarta', 15000, '12/01/2025'],
      ['Citra Dewi', 'Bandung', 17500, '13/01/2025'],
      ['Dedi Pratama', 'Bandung', 18000, '13/01/2025'],
      ['Eka Putri', 'Surabaya', 12000, '14/01/2025'],
      ['Fajar Nugroho', 'Surabaya', 20000, '15/01/2025'],
      ['Gita Maharani', 'Jakarta', 14000, '15/01/2025'],
    ];
    const head = ['Nama', 'Kota', 'Harga Paket', 'Tanggal Daftar'];
    const practice: SheetSpec[] = [
      {
        name: 'Latihan',
        cells: table(head, messy),
        headers: ['A1', 'B1', 'C1', 'D1'],
        widths: [20, 14, 16, 16],
        formats: { 'C2:C9': RP },
        freezeHeader: true,
      },
    ];
    const key: SheetSpec[] = [
      {
        name: 'Hasil',
        cells: table(head, clean),
        headers: ['A1', 'B1', 'C1', 'D1'],
        answers: [...range('A', 2, 8), ...range('B', 2, 8), ...range('C', 2, 8)],
        widths: [20, 14, 16, 16],
        formats: { 'C2:C8': RP },
        freezeHeader: true,
      },
      {
        name: 'Masalah',
        cells: table(
          ['Baris', 'Masalah'],
          [
            [2, 'Kota "jakarta" ditulis huruf kecil semua'],
            [3, 'Kota "JAKARTA " huruf besar semua dan ada spasi di akhir'],
            [2, 'Harga "Rp 15000" tersimpan sebagai teks karena ada huruf'],
            [5, 'Kota " bandung" memiliki spasi di awal dan huruf kecil; harga "18000" tersimpan sebagai teks'],
            [6, 'Harga "Rp 12000" tersimpan sebagai teks'],
            [7, 'Baris 7 duplikat dari baris 2 (Ani Lestari) dan harus dihapus'],
            [8, 'Kota "Surabaya " memiliki spasi di akhir'],
          ],
        ),
        headers: ['A1', 'B1'],
        widths: [8, 90],
      },
    ];
    return { practice, key };
  },

  'laporan-penjualan-mini': () => {
    const d: [number, number, string, string, string, number][] = [
      [1, 2, 'Makanan', 'Jakarta', 'Beras', 300000],
      [1, 3, 'Minuman', 'Bandung', 'Teh', 120000],
      [1, 4, 'Snack', 'Jakarta', 'Keripik', 60000],
      [1, 5, 'Makanan', 'Surabaya', 'Minyak', 200000],
      [1, 6, 'Minuman', 'Jakarta', 'Kopi', 150000],
      [1, 7, 'Makanan', 'Bandung', 'Mie', 80000],
      [1, 8, 'Snack', 'Surabaya', 'Coklat', 130000],
      [1, 9, 'Minuman', 'Surabaya', 'Jus', 85000],
      [1, 10, 'Makanan', 'Jakarta', 'Roti', 90000],
      [1, 11, 'Snack', 'Bandung', 'Biskuit', 45000],
      [1, 12, 'Minuman', 'Bandung', 'Susu', 110000],
      [1, 13, 'Makanan', 'Jakarta', 'Gula', 70000],
      [1, 14, 'Snack', 'Jakarta', 'Wafer', 55000],
      [1, 15, 'Minuman', 'Jakarta', 'Soda', 40000],
      [1, 16, 'Makanan', 'Surabaya', 'Tepung', 65000],
    ];
    return standard([
      {
        name: 'Latihan',
        cells: {
          ...table(
            ['Tanggal', 'Kategori', 'Kota', 'Produk', 'Penjualan'],
            d.map(([, , k, c, p, v]) => [`#d`, k, c, p, v]),
          ),
          G1: 'RINGKASAN',
          H1: '',
          G2: 'Total penjualan',
          H2: f('SUM(E2:E16)'),
          G4: 'Total per kategori',
          H4: '',
          G5: 'Makanan',
          H5: f('SUMIF(B2:B16,G5,E2:E16)'),
          G6: 'Minuman',
          H6: f('SUMIF(B2:B16,G6,E2:E16)'),
          G7: 'Snack',
          H7: f('SUMIF(B2:B16,G7,E2:E16)'),
          G9: 'Jumlah transaksi per kota',
          H9: '',
          G10: 'Jakarta',
          H10: f('COUNTIF(C2:C16,G10)'),
          G11: 'Bandung',
          H11: f('COUNTIF(C2:C16,G11)'),
          G12: 'Surabaya',
          H12: f('COUNTIF(C2:C16,G12)'),
        },
        dates: Object.fromEntries(d.map(([m, dd], i) => [`A${i + 2}`, day(m, dd)])),
        headers: ['A1', 'B1', 'C1', 'D1', 'E1', 'G1', 'G4', 'G9'],
        answers: ['H2', 'H5', 'H6', 'H7', 'H10', 'H11', 'H12'],
        widths: [13, 12, 12, 12, 14, 3, 28, 16],
        formats: { 'A2:A16': DATE, 'E2:E16': RP, 'H2:H7': RP },
        freezeHeader: true,
      },
    ]);
  },
};

// ------------------------------------------------------------------ penulisan workbook

const GREEN_LIGHT = 'FFE2F0E8';
const ANSWER_PRACTICE = 'FFFFF2CC';
const ANSWER_KEY = 'FFD9F2E1';
const BORDER = { style: 'thin' as const, color: { argb: 'FFD9DED9' } };

function engineValues(spec: SheetSpec): Record<string, string | number | null | boolean> {
  const input: Record<string, string> = {};
  for (const [ref, c] of Object.entries(spec.cells)) {
    if (typeof c === 'string') input[ref] = spec.dates?.[ref] ? '' : c.startsWith('#d') ? '' : c;
    else if (typeof c === 'number') input[ref] = String(c);
    else input[ref] = c.r !== undefined ? String(c.r) : `=${c.f}`;
  }
  const sheet = new Sheet(input);
  const out: Record<string, string | number | null | boolean> = {};
  for (const ref of Object.keys(spec.cells)) {
    const v = sheet.getValue(ref);
    out[ref] = isError(v) ? `#ERR:${v.code}` : v;
  }
  return out;
}

function writeSheet(wb: ExcelJS.Workbook, spec: SheetSpec, withAnswers: boolean): void {
  const ws = wb.addWorksheet(spec.name, { views: spec.freezeHeader ? [{ state: 'frozen', ySplit: 1 }] : [] });
  spec.widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const values = engineValues(spec);
  const answers = new Set(spec.answers ?? []);

  for (const [ref, c] of Object.entries(spec.cells)) {
    const cell = ws.getCell(ref);
    const isAnswer = answers.has(ref);
    if (spec.dates?.[ref]) cell.value = spec.dates[ref]!;
    else if (typeof c === 'object') {
      if (isAnswer && !withAnswers) cell.value = null;
      else {
        const res = c.r !== undefined ? c.r : values[ref];
        cell.value = {
          formula: c.f,
          result: typeof res === 'string' && res.startsWith('#ERR') ? undefined : ((res as string | number | undefined) ?? undefined),
        };
      }
    } else if (isAnswer && !withAnswers) cell.value = null;
    else cell.value = c === '' || (typeof c === 'string' && c.startsWith('#d')) ? null : c;

    if (isAnswer) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: withAnswers ? ANSWER_KEY : ANSWER_PRACTICE } };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    }
  }
  for (const h of spec.headers) {
    const cell = ws.getCell(h);
    cell.font = { bold: true, color: { argb: 'FF185C37' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF217346' } } };
  }
  for (const [rng, fmt] of Object.entries(spec.formats ?? {})) for (const ref of expandRef(rng)) ws.getCell(ref).numFmt = fmt;
  // Kolom teks panjang diberi pembungkus supaya terbaca.
  ws.eachRow((row) =>
    row.eachCell((c) => (c.alignment = { vertical: 'top', wrapText: typeof c.value === 'string' && c.value.length > 40 })),
  );
}

function addInstructions(wb: ExcelJS.Workbook, def: WorksheetDef, isKey: boolean): void {
  const ws = wb.addWorksheet('Petunjuk');
  ws.getColumn(1).width = 100;
  const lines: [string, 'title' | 'label' | 'text'][] = [
    [isKey ? `${def.title} - KUNCI JAWABAN` : def.title, 'title'],
    ['', 'text'],
    ['Tujuan belajar', 'label'],
    [def.objective, 'text'],
    ['', 'text'],
    ['Tingkat', 'label'],
    [def.difficulty, 'text'],
    ['', 'text'],
    ['Keterampilan', 'label'],
    [def.skills.join(', '), 'text'],
    ['', 'text'],
    [isKey ? 'Catatan' : 'Langkah pengerjaan', 'label'],
    ...(isKey
      ? ([
          ['Ini kunci jawaban. Kerjakan file latihan terlebih dahulu sebelum membuka file ini. Sel jawaban berlatar hijau muda.', 'text'],
        ] as [string, 'text'][])
      : def.instructions.map((s, i): [string, 'text'] => [`${i + 1}. ${s}`, 'text'])),
    ...(isKey
      ? []
      : ([
          ['', 'text'],
          ['Sel berlatar kuning pada sheet Latihan adalah tempat jawabanmu.', 'text'],
        ] as [string, 'text'][])),
    ['', 'text'],
    ['Dibuat oleh Mahir Excel. Gratis untuk belajar.', 'text'],
  ];
  lines.forEach(([text, kind], i) => {
    const c = ws.getCell(`A${i + 1}`);
    c.value = text;
    c.alignment = { wrapText: true, vertical: 'top' };
    if (kind === 'title') c.font = { bold: true, size: 16, color: { argb: 'FF185C37' } };
    if (kind === 'label') c.font = { bold: true, color: { argb: 'FF217346' } };
  });
}

export function buildWorkbook(def: WorksheetDef, kind: 'practice' | 'key'): ExcelJS.Workbook {
  const planFn = plans[def.slug];
  if (!planFn) throw new Error(`Tidak ada rencana worksheet untuk ${def.slug}`);
  const plan = planFn();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mahir Excel';
  wb.title = def.title;
  wb.created = new Date(Date.UTC(2025, 0, 1));
  addInstructions(wb, def, kind === 'key');
  for (const spec of kind === 'practice' ? plan.practice : plan.key) writeSheet(wb, spec, kind === 'key');
  return wb;
}

export async function writeWorkbooks(dir: string): Promise<string[]> {
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const def of worksheets) {
    for (const [kind, suffix] of [
      ['practice', ''],
      ['key', '-kunci'],
    ] as const) {
      const file = path.join(dir, `${def.slug}${suffix}.xlsx`);
      await buildWorkbook(def, kind).xlsx.writeFile(file);
      written.push(file);
    }
  }
  return written;
}

export interface KeyCell {
  sheet: string;
  ref: string;
  expected: string | number | boolean | null;
  /** Sel kunci berisi rumus, jadi jawaban peserta juga harus berupa rumus. */
  formula: boolean;
}

const keyCache = new Map<string, KeyCell[]>();

/** Sel jawaban beserta nilai yang benar, dihitung dari rencana kunci. Dipakai untuk memeriksa berkas yang diunggah. */
export function worksheetKey(slug: string): KeyCell[] | null {
  const planFn = plans[slug];
  if (!planFn) return null;
  let out = keyCache.get(slug);
  if (!out) {
    out = [];
    for (const spec of planFn().key) {
      const values = engineValues(spec);
      for (const ref of spec.answers ?? []) {
        const c = spec.cells[ref];
        if (c === undefined) continue;
        const isFormula = typeof c === 'object';
        const v = isFormula ? (c.r !== undefined ? c.r : values[ref]) : c;
        if (typeof v === 'string' && v.startsWith('#ERR')) continue;
        out.push({ sheet: spec.name, ref, expected: v ?? null, formula: isFormula });
      }
    }
    keyCache.set(slug, out);
  }
  return out;
}
