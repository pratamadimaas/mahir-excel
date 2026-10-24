import { DATE, PCT, RP, type TCell, type TSheet } from './model';

const f = (formula: string): TCell => ({ f: formula });
const d = (date: string): TCell => ({ d: date });
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const pad = (n: number): string => String(n).padStart(2, '0');

/** Ruang untuk sel hasil rumus yang diisi ke bawah: "A5".."A{to}" per kolom. */
function fillDown(cells: Record<string, TCell>, colLetter: string, from: number, to: number, make: (row: number) => TCell): void {
  for (let r = from; r <= to; r++) cells[`${colLetter}${r}`] = make(r);
}

/** Sheet "Cara pakai" yang seragam untuk semua template. */
function howTo(title: string, lines: string[], formulas: string[]): TSheet {
  const cells: Record<string, TCell> = { A1: title, A3: 'Cara memakai' };
  let r = 4;
  lines.forEach((l, i) => (cells[`A${r++}`] = `${i + 1}. ${l}`));
  r++;
  cells[`A${r++}`] = 'Warna sel';
  cells[`A${r++}`] = 'Sel kuning muda: tempat kamu mengisi. Isi awalnya hanya contoh, hapus lalu ganti dengan datamu sendiri.';
  cells[`A${r++}`] = 'Sel putih berisi rumus: biarkan, jangan dihapus. Hasilnya otomatis mengikuti isian kuning.';
  r++;
  cells[`A${r++}`] = 'Rumus yang dipakai';
  cells[`A${r++}`] = `${formulas.join(', ')}. Semuanya jalan di Excel 2016 ke atas, Google Sheets, dan LibreOffice.`;
  r++;
  cells[`A${r}`] = 'Dibuat dengan Mahir Excel (mahirexcel.online). Bukan produk Microsoft.';
  const wrap = Object.keys(cells).filter((k) => k !== 'A1');
  return { name: 'Cara pakai', widths: [100], cells, title: ['A1'], head: ['A3', `A${4 + lines.length + 1}`], wrap, note: [`A${r}`] };
}

const rangeOf = (sheet: string, col: string, from: number, to: number): string => `${sheet}!$${col}$${from}:$${col}$${to}`;

// ---------------------------------------------------------------- laporan penjualan

export function laporanPenjualan(): TSheet[] {
  const products: [string, number][] = [
    ['Kopi susu', 18000],
    ['Teh manis', 8000],
    ['Roti bakar', 15000],
    ['Nasi goreng', 25000],
    ['Mie goreng', 22000],
    ['Es jeruk', 9000],
  ];
  const P0 = 5;
  const P1 = 24;
  const S0 = 5;
  const S1 = 304;

  const produk: Record<string, TCell> = { A1: 'Daftar produk dan harga', A2: 'Contoh produk. Ganti dengan produkmu, harga satuan dalam Rupiah.', A4: 'Produk', B4: 'Harga satuan' };
  products.forEach(([n, h], i) => {
    produk[`A${P0 + i}`] = n;
    produk[`B${P0 + i}`] = h;
  });

  const sales: { date: string; product: string; qty: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const month = 1 + Math.floor(i / 10);
    const day = 1 + ((i * 3) % 27);
    sales.push({ date: `2025-${pad(month)}-${pad(day)}`, product: products[i % 6]![0], qty: 1 + ((i * 7) % 5) });
  }
  sales.sort((a, b) => a.date.localeCompare(b.date));
  const penjualan: Record<string, TCell> = {
    A1: 'Catatan penjualan harian',
    A2: 'Isi tanggal, pilih produk, isi jumlah. Harga dan total muncul sendiri. Data di bawah hanya contoh.',
    A4: 'Tanggal',
    B4: 'Produk',
    C4: 'Harga satuan',
    D4: 'Jumlah',
    E4: 'Total',
  };
  sales.forEach((s, i) => {
    const r = S0 + i;
    penjualan[`A${r}`] = d(s.date);
    penjualan[`B${r}`] = s.product;
    penjualan[`D${r}`] = s.qty;
  });
  fillDown(penjualan, 'C', S0, S1, (r) => f(`IF(B${r}="","",IFERROR(VLOOKUP(B${r},Produk!$A$${P0}:$B$${P1},2,FALSE),"Produk tidak ada"))`));
  fillDown(penjualan, 'E', S0, S1, (r) => f(`IF(OR(B${r}="",D${r}=""),"",C${r}*D${r})`));

  const A = rangeOf('Penjualan', 'A', S0, S1);
  const B = rangeOf('Penjualan', 'B', S0, S1);
  const Dq = rangeOf('Penjualan', 'D', S0, S1);
  const E = rangeOf('Penjualan', 'E', S0, S1);
  const rekap: Record<string, TCell> = {
    A1: 'Rekap penjualan',
    A2: 'Tahun',
    B2: 2025,
    A4: 'No',
    B4: 'Bulan',
    C4: 'Transaksi',
    D4: 'Barang terjual',
    E4: 'Total penjualan',
    F4: 'Rata-rata per transaksi',
  };
  for (let m = 1; m <= 12; m++) {
    const r = 4 + m;
    const range = `${A},">="&DATE($B$2,$A${r},1),${A},"<"&DATE($B$2,$A${r}+1,1)`;
    rekap[`A${r}`] = m;
    rekap[`B${r}`] = MONTHS[m - 1]!;
    rekap[`C${r}`] = f(`COUNTIFS(${range})`);
    rekap[`D${r}`] = f(`SUMIFS(${Dq},${range})`);
    rekap[`E${r}`] = f(`SUMIFS(${E},${range})`);
    rekap[`F${r}`] = f(`IFERROR(E${r}/C${r},0)`);
  }
  rekap.B17 = 'Total setahun';
  rekap.C17 = f('SUM(C5:C16)');
  rekap.D17 = f('SUM(D5:D16)');
  rekap.E17 = f('SUM(E5:E16)');
  rekap.F17 = f('IFERROR(E17/C17,0)');
  rekap.A19 = 'Per produk (tahun di atas)';
  rekap.A20 = 'Produk';
  rekap.B20 = 'Terjual';
  rekap.C20 = 'Total penjualan';
  rekap.D20 = 'Porsi';
  for (let i = 0; i < 20; i++) {
    const r = 21 + i;
    const pr = P0 + i;
    const range = `${A},">="&DATE($B$2,1,1),${A},"<"&DATE($B$2+1,1,1)`;
    rekap[`A${r}`] = f(`IF(Produk!A${pr}="","",Produk!A${pr})`);
    rekap[`B${r}`] = f(`IF(A${r}="","",SUMIFS(${Dq},${B},A${r},${range}))`);
    rekap[`C${r}`] = f(`IF(A${r}="","",SUMIFS(${E},${B},A${r},${range}))`);
    rekap[`D${r}`] = f(`IF(A${r}="","",IFERROR(C${r}/$E$17,0))`);
  }

  return [
    howTo(
      'Laporan Penjualan Harian dan Bulanan',
      [
        'Buka sheet Produk. Tulis nama produk dan harga satuannya.',
        'Buka sheet Penjualan. Setiap ada penjualan, tulis satu baris: tanggal, produk (pilih dari daftar), dan jumlah.',
        'Buka sheet Rekap. Ganti tahun di sel B2, lalu lihat total tiap bulan dan tiap produk.',
        'Tersedia 300 baris penjualan. Perlu lebih banyak? Salin baris terakhir ke bawah, lalu perluas rentang rumus di Rekap.',
      ],
      ['VLOOKUP', 'SUMIFS', 'COUNTIFS', 'IFERROR', 'IF', 'OR', 'SUM'],
    ),
    {
      name: 'Produk',
      widths: [32, 16],
      cells: produk,
      title: ['A1'],
      head: ['A4:B4'],
      input: [`A${P0}:B${P1}`],
      note: ['A2'],
      fmt: { [`B${P0}:B${P1}`]: RP },
      freeze: 4,
    },
    {
      name: 'Penjualan',
      widths: [14, 24, 16, 10, 18],
      cells: penjualan,
      title: ['A1'],
      head: ['A4:E4'],
      input: [`A${S0}:B${S1}`, `D${S0}:D${S1}`],
      note: ['A2'],
      fmt: { [`A${S0}:A${S1}`]: DATE, [`C${S0}:C${S1}`]: RP, [`E${S0}:E${S1}`]: RP },
      lists: { [`B${S0}:B${S1}`]: `Produk!$A$${P0}:$A$${P1}` },
      freeze: 4,
    },
    {
      name: 'Rekap',
      widths: [26, 16, 14, 16, 20, 24],
      cells: rekap,
      title: ['A1'],
      head: ['A4:F4', 'A20:D20'],
      input: ['B2'],
      total: ['A17:F17'],
      fmt: { 'C5:D17': '#,##0', 'E5:F17': RP, 'B21:B40': '#,##0', 'C21:C40': RP, 'D21:D40': '0.0%' },
    },
  ];
}

// ---------------------------------------------------------------- keuangan pribadi

export function keuanganPribadi(): TSheet[] {
  const income = ['Gaji', 'Usaha sampingan', 'Lainnya (masuk)'];
  const expense: [string, number][] = [
    ['Makan', 1800000],
    ['Transport', 500000],
    ['Sewa atau kos', 1500000],
    ['Listrik, air, internet', 400000],
    ['Hiburan', 300000],
    ['Tabungan', 1000000],
    ['Lainnya (keluar)', 300000],
  ];
  const T0 = 5;
  const T1 = 304;
  const kategori: Record<string, TCell> = {
    A1: 'Daftar kategori dan anggaran',
    A2: 'Contoh kategori. Ganti dengan kategorimu. Anggaran adalah batas pengeluaran sebulan.',
    A4: 'Kategori uang masuk',
    E4: 'Kategori uang keluar',
    F4: 'Anggaran sebulan',
  };
  income.forEach((n, i) => (kategori[`A${5 + i}`] = n));
  expense.forEach(([n, a], i) => {
    kategori[`E${5 + i}`] = n;
    kategori[`F${5 + i}`] = a;
  });

  const rows: [string, string, string, number][] = [
    ['2025-01-01', 'Gaji', 'Gaji bulan ini', 6000000],
    ['2025-01-03', 'Sewa atau kos', 'Kos bulan Januari', 1500000],
    ['2025-01-04', 'Makan', 'Belanja mingguan', 350000],
    ['2025-01-06', 'Transport', 'Isi bensin', 100000],
    ['2025-01-10', 'Makan', 'Makan di luar', 150000],
    ['2025-01-12', 'Listrik, air, internet', 'Token listrik dan internet', 400000],
    ['2025-01-15', 'Usaha sampingan', 'Jasa desain', 1200000],
    ['2025-01-18', 'Hiburan', 'Nonton bioskop', 120000],
    ['2025-01-20', 'Makan', 'Belanja mingguan', 400000],
    ['2025-01-22', 'Transport', 'Isi bensin', 150000],
    ['2025-01-25', 'Tabungan', 'Setor tabungan', 1000000],
    ['2025-01-28', 'Hiburan', 'Langganan streaming', 180000],
    ['2025-01-29', 'Makan', 'Makan di luar', 250000],
    ['2025-01-30', 'Lainnya (keluar)', 'Hadiah ulang tahun teman', 350000],
  ];
  const transaksi: Record<string, TCell> = {
    A1: 'Catatan uang masuk dan keluar',
    A2: 'Satu baris untuk satu kejadian. Pilih kategori dari daftar. Jumlah selalu angka positif. Data di bawah hanya contoh.',
    A4: 'Tanggal',
    B4: 'Kategori',
    C4: 'Keterangan',
    D4: 'Jumlah',
    E4: 'Jenis',
  };
  rows.forEach(([date, cat, note, amount], i) => {
    const r = T0 + i;
    transaksi[`A${r}`] = d(date);
    transaksi[`B${r}`] = cat;
    transaksi[`C${r}`] = note;
    transaksi[`D${r}`] = amount;
  });
  fillDown(transaksi, 'E', T0, T1, (r) =>
    f(`IF(B${r}="","",IF(COUNTIF(Kategori!$A$5:$A$9,B${r})>0,"Masuk",IF(COUNTIF(Kategori!$E$5:$E$19,B${r})>0,"Keluar","Kategori belum terdaftar")))`),
  );

  const kat = rangeOf('Transaksi', 'B', T0, T1);
  const jenis = rangeOf('Transaksi', 'E', T0, T1);
  const jumlah = rangeOf('Transaksi', 'D', T0, T1);
  const ringkasan: Record<string, TCell> = {
    A1: 'Ringkasan bulan ini',
    A2: 'Bulan',
    B2: 'Januari 2025',
    A4: 'Uang masuk',
    B4: f(`SUMIF(${jenis},"Masuk",${jumlah})`),
    A5: 'Uang keluar',
    B5: f(`SUMIF(${jenis},"Keluar",${jumlah})`),
    A6: 'Sisa (masuk dikurangi keluar)',
    B6: f('B4-B5'),
    A7: 'Persen dari pemasukan yang tersisa',
    B7: f('IF(B4=0,0,B6/B4)'),
    A9: 'Pengeluaran per kategori',
    A10: 'Kategori',
    B10: 'Anggaran',
    C10: 'Terpakai',
    D10: 'Sisa anggaran',
    E10: 'Status',
  };
  for (let i = 0; i < 15; i++) {
    const r = 11 + i;
    const kr = 5 + i;
    ringkasan[`A${r}`] = f(`IF(Kategori!E${kr}="","",Kategori!E${kr})`);
    ringkasan[`B${r}`] = f(`IF(A${r}="","",Kategori!F${kr})`);
    ringkasan[`C${r}`] = f(`IF(A${r}="","",SUMIF(${kat},A${r},${jumlah}))`);
    ringkasan[`D${r}`] = f(`IF(A${r}="","",B${r}-C${r})`);
    ringkasan[`E${r}`] = f(`IF(A${r}="","",IF(D${r}<0,"Lewat anggaran","Aman"))`);
  }
  ringkasan.A26 = 'Total';
  ringkasan.B26 = f('SUM(B11:B25)');
  ringkasan.C26 = f('SUM(C11:C25)');
  ringkasan.D26 = f('SUM(D11:D25)');

  return [
    howTo(
      'Keuangan Pribadi Bulanan',
      [
        'Buka sheet Kategori. Tulis kategori uang masuk dan uang keluar, dan anggaran sebulan untuk tiap pengeluaran.',
        'Buka sheet Transaksi. Catat setiap uang masuk atau keluar: tanggal, kategori (pilih dari daftar), keterangan, jumlah.',
        'Buka sheet Ringkasan. Lihat sisa uang bulan ini dan kategori mana yang melewati anggaran.',
        'Satu file untuk satu bulan. Awal bulan berikutnya, simpan salinan file ini lalu hapus isi kuning di sheet Transaksi.',
      ],
      ['SUMIF', 'COUNTIF', 'IF', 'SUM'],
    ),
    {
      name: 'Kategori',
      widths: [28, 3, 3, 3, 28, 18],
      cells: kategori,
      title: ['A1'],
      head: ['A4', 'E4:F4'],
      input: ['A5:A9', 'E5:F19'],
      note: ['A2'],
      fmt: { 'F5:F19': RP },
    },
    {
      name: 'Transaksi',
      widths: [14, 26, 34, 16, 22],
      cells: transaksi,
      title: ['A1'],
      head: ['A4:E4'],
      input: [`A${T0}:D${T1}`],
      note: ['A2'],
      fmt: { [`A${T0}:A${T1}`]: DATE, [`D${T0}:D${T1}`]: RP },
      lists: { [`B${T0}:B${T1}`]: 'Kategori!$E$5:$E$19' },
      freeze: 4,
    },
    {
      name: 'Ringkasan',
      widths: [34, 18, 18, 18, 20],
      cells: ringkasan,
      title: ['A1'],
      head: ['A10:E10'],
      input: ['B2'],
      total: ['A26:D26', 'A6:B6'],
      fmt: { 'B4:B6': RP, B7: PCT, 'B11:D26': RP },
      cf: [{ range: 'E11:E25', formula: 'E11="Lewat anggaran"', fill: 'FFF8D7DA', font: 'FF9B1C1C' }],
    },
  ];
}

// ---------------------------------------------------------------- stok barang

export function stokBarang(): TSheet[] {
  const items: [string, string, string, number, number][] = [
    ['BRG001', 'Beras 5 kg', 'karung', 40, 15],
    ['BRG002', 'Minyak goreng 2 L', 'pcs', 30, 10],
    ['BRG003', 'Gula pasir 1 kg', 'pcs', 50, 20],
    ['BRG004', 'Telur', 'kg', 25, 10],
    ['BRG005', 'Tepung terigu 1 kg', 'pcs', 20, 8],
    ['BRG006', 'Kopi bubuk 200 g', 'pcs', 15, 6],
    ['BRG007', 'Teh celup', 'kotak', 30, 10],
    ['BRG008', 'Susu UHT 1 L', 'pcs', 18, 10],
  ];
  const masuk: [string, string, number, string][] = [
    ['2025-01-05', 'BRG001', 20, 'Kulakan'],
    ['2025-01-05', 'BRG003', 30, 'Kulakan'],
    ['2025-01-08', 'BRG004', 10, 'Pasar'],
    ['2025-01-12', 'BRG006', 10, 'Kulakan'],
    ['2025-01-15', 'BRG008', 12, 'Kulakan'],
    ['2025-01-20', 'BRG002', 5, 'Tambahan'],
  ];
  const keluar: [string, string, number, string][] = [
    ['2025-01-06', 'BRG001', 35, 'Terjual'],
    ['2025-01-07', 'BRG002', 28, 'Terjual'],
    ['2025-01-10', 'BRG003', 60, 'Terjual'],
    ['2025-01-14', 'BRG005', 14, 'Terjual'],
    ['2025-01-16', 'BRG004', 30, 'Terjual'],
    ['2025-01-18', 'BRG006', 18, 'Terjual'],
    ['2025-01-22', 'BRG007', 12, 'Terjual'],
    ['2025-01-25', 'BRG008', 25, 'Terjual'],
  ];
  const B0 = 5;
  const B1 = 54;
  const L0 = 5;
  const L1 = 304;

  const barang: Record<string, TCell> = {
    A1: 'Daftar barang dan stok sekarang',
    A2: 'Tulis kode unik tiap barang (huruf dan angka, mis. BRG001). Stok sekarang = stok awal + masuk - keluar, dihitung otomatis.',
    A4: 'Kode',
    B4: 'Nama barang',
    C4: 'Satuan',
    D4: 'Stok awal',
    E4: 'Masuk',
    F4: 'Keluar',
    G4: 'Stok sekarang',
    H4: 'Batas minimum',
    I4: 'Status',
    K4: 'Ringkasan',
    K5: 'Jenis barang',
    L5: f(`COUNTA(A${B0}:A${B1})`),
    K6: 'Perlu dipesan lagi',
    L6: f(`COUNTIF(I${B0}:I${B1},"Pesan lagi")`),
  };
  items.forEach(([k, n, s, a, m], i) => {
    const r = B0 + i;
    barang[`A${r}`] = k;
    barang[`B${r}`] = n;
    barang[`C${r}`] = s;
    barang[`D${r}`] = a;
    barang[`H${r}`] = m;
  });
  for (let r = B0; r <= B1; r++) {
    barang[`E${r}`] = f(`IF(A${r}="","",SUMIF(${rangeOf('Masuk', 'B', L0, L1)},A${r},${rangeOf('Masuk', 'C', L0, L1)}))`);
    barang[`F${r}`] = f(`IF(A${r}="","",SUMIF(${rangeOf('Keluar', 'B', L0, L1)},A${r},${rangeOf('Keluar', 'C', L0, L1)}))`);
    barang[`G${r}`] = f(`IF(A${r}="","",D${r}+E${r}-F${r})`);
    barang[`I${r}`] = f(`IF(A${r}="","",IF(G${r}<=H${r},"Pesan lagi","Aman"))`);
  }

  const log = (title: string, data: [string, string, number, string][]): Record<string, TCell> => {
    const c: Record<string, TCell> = {
      A1: title,
      A2: 'Satu baris per kejadian. Pilih kode barang dari daftar, nama barang muncul sendiri. Data di bawah hanya contoh.',
      A4: 'Tanggal',
      B4: 'Kode barang',
      C4: 'Jumlah',
      D4: 'Catatan',
      E4: 'Nama barang',
    };
    data.forEach(([date, kode, qty, note], i) => {
      const r = L0 + i;
      c[`A${r}`] = d(date);
      c[`B${r}`] = kode;
      c[`C${r}`] = qty;
      c[`D${r}`] = note;
    });
    fillDown(c, 'E', L0, L1, (r) =>
      f(`IF(B${r}="","",IFERROR(INDEX(${rangeOf('Barang', 'B', B0, B1)},MATCH(B${r},${rangeOf('Barang', 'A', B0, B1)},0)),"Kode tidak ada"))`),
    );
    return c;
  };
  const logSheet = (name: string, title: string, data: [string, string, number, string][]): TSheet => ({
    name,
    widths: [14, 16, 12, 26, 28],
    cells: log(title, data),
    title: ['A1'],
    head: ['A4:E4'],
    input: [`A${L0}:D${L1}`],
    note: ['A2'],
    fmt: { [`A${L0}:A${L1}`]: DATE },
    lists: { [`B${L0}:B${L1}`]: `Barang!$A$${B0}:$A$${B1}` },
    freeze: 4,
  });

  return [
    howTo(
      'Stok Barang Masuk, Keluar, dan Sisa',
      [
        'Buka sheet Barang. Isi kode, nama, satuan, stok awal, dan batas minimum tiap barang.',
        'Setiap ada barang datang, catat di sheet Masuk. Setiap ada barang keluar atau terjual, catat di sheet Keluar.',
        'Kembali ke sheet Barang. Kolom Stok sekarang dan Status terhitung sendiri. Merah berarti stok sudah di batas minimum atau kurang.',
        'Muat 50 jenis barang dan 300 catatan masuk dan keluar. Perlu lebih? Salin baris terakhir ke bawah dan perluas rentang rumus.',
      ],
      ['SUMIF', 'INDEX', 'MATCH', 'IFERROR', 'IF', 'COUNTIF', 'COUNTA'],
    ),
    {
      name: 'Barang',
      widths: [12, 28, 10, 11, 10, 10, 14, 14, 14, 3, 20, 10],
      cells: barang,
      title: ['A1'],
      head: ['A4:I4', 'K4:L4'],
      input: [`A${B0}:D${B1}`, `H${B0}:H${B1}`],
      note: ['A2'],
      cf: [{ range: `I${B0}:I${B1}`, formula: `I${B0}="Pesan lagi"`, fill: 'FFF8D7DA', font: 'FF9B1C1C' }],
      freeze: 4,
    },
    logSheet('Masuk', 'Catatan barang masuk', masuk),
    logSheet('Keluar', 'Catatan barang keluar', keluar),
  ];
}

// ---------------------------------------------------------------- invoice dan piutang

export function invoicePiutang(): TSheet[] {
  const inv: [string, string, string, number, number, string][] = [
    ['INV-001', '2025-01-05', 'Toko Maju Jaya (contoh)', 14, 2500000, '2025-01-05'],
    ['INV-002', '2025-01-12', 'CV Sinar Terang (contoh)', 30, 4800000, '2025-01-12'],
    ['INV-003', '2025-02-02', 'Ibu Ratna (contoh)', 7, 1200000, '2025-02-02'],
    ['INV-004', '2025-02-10', 'Toko Maju Jaya (contoh)', 14, 3100000, '2025-02-10'],
    ['INV-005', '2025-03-01', 'Bengkel Sumber Rejeki (contoh)', 30, 7500000, '2025-03-01'],
    ['INV-006', '2025-03-15', 'Ibu Ratna (contoh)', 7, 950000, '2025-03-15'],
  ];
  const pay: [string, string, number, string][] = [
    ['2025-01-18', 'INV-001', 2500000, 'Transfer lunas'],
    ['2025-01-30', 'INV-002', 2000000, 'Cicilan pertama'],
    ['2025-02-08', 'INV-003', 1200000, 'Tunai lunas'],
    ['2025-03-12', 'INV-005', 3000000, 'DP'],
  ];
  const D0 = 5;
  const D1 = 104;
  const P0 = 5;
  const P1 = 304;

  const invoice: Record<string, TCell> = {
    A1: 'INVOICE',
    A3: 'Nomor',
    B3: 'INV-007',
    A4: 'Tanggal',
    B4: d('2025-04-01'),
    A5: 'Kepada',
    B5: 'Nama pelanggan (contoh)',
    A6: 'Dari',
    B6: 'Nama usahamu (contoh)',
    A8: 'No',
    B8: 'Deskripsi',
    C8: 'Jumlah',
    D8: 'Harga satuan',
    E8: 'Subtotal',
  };
  const lines: [string, number, number][] = [
    ['Jasa desain logo (contoh)', 1, 1500000],
    ['Cetak kartu nama, 2 box (contoh)', 2, 85000],
    ['Biaya pengiriman (contoh)', 1, 25000],
  ];
  for (let i = 0; i < 10; i++) {
    const r = 9 + i;
    invoice[`A${r}`] = i + 1;
    const line = lines[i];
    if (line) {
      invoice[`B${r}`] = line[0];
      invoice[`C${r}`] = line[1];
      invoice[`D${r}`] = line[2];
    }
    invoice[`E${r}`] = f(`IF(OR(C${r}="",D${r}=""),"",C${r}*D${r})`);
  }
  invoice.D20 = 'Subtotal';
  invoice.E20 = f('SUM(E9:E18)');
  invoice.D21 = 'Diskon (%)';
  invoice.C21 = 0;
  invoice.E21 = f('E20*C21');
  invoice.D22 = 'PPN (%)';
  invoice.C22 = 0.11;
  invoice.E22 = f('(E20-E21)*C22');
  invoice.D23 = 'TOTAL';
  invoice.E23 = f('E20-E21+E22');
  invoice.A25 = 'Setelah invoice dikirim, catat nomor dan totalnya di sheet Daftar supaya piutang terpantau.';
  invoice.A26 = 'Pembayaran ke: tulis nama bank dan nomor rekeningmu di sini.';

  const daftar: Record<string, TCell> = {
    A1: 'Daftar invoice dan piutang',
    A2: 'Satu baris per invoice. Dibayar diambil dari sheet Pembayaran. Status memakai tanggal hari ini. Data di bawah hanya contoh.',
    A4: 'Nomor invoice',
    B4: 'Tanggal',
    C4: 'Pelanggan',
    D4: 'Termin (hari)',
    E4: 'Jatuh tempo',
    F4: 'Total tagihan',
    G4: 'Dibayar',
    H4: 'Sisa',
    I4: 'Status',
    J4: 'Hari terlambat',
    L4: 'Ringkasan',
    L5: 'Total tagihan',
    M5: f(`SUM(F${D0}:F${D1})`),
    L6: 'Sudah dibayar',
    M6: f(`SUM(G${D0}:G${D1})`),
    L7: 'Piutang (belum dibayar)',
    M7: f(`SUM(H${D0}:H${D1})`),
    L8: 'Piutang yang terlambat',
    M8: f(`SUMIF(I${D0}:I${D1},"Terlambat",H${D0}:H${D1})`),
    L9: 'Invoice terlambat',
    M9: f(`COUNTIF(I${D0}:I${D1},"Terlambat")`),
  };
  inv.forEach(([no, date, who, term, total], i) => {
    const r = D0 + i;
    daftar[`A${r}`] = no;
    daftar[`B${r}`] = d(date);
    daftar[`C${r}`] = who;
    daftar[`D${r}`] = term;
    daftar[`F${r}`] = total;
  });
  for (let r = D0; r <= D1; r++) {
    daftar[`E${r}`] = f(`IF(A${r}="","",B${r}+D${r})`);
    daftar[`G${r}`] = f(`IF(A${r}="","",SUMIF(${rangeOf('Pembayaran', 'B', P0, P1)},A${r},${rangeOf('Pembayaran', 'C', P0, P1)}))`);
    daftar[`H${r}`] = f(`IF(A${r}="","",F${r}-G${r})`);
    daftar[`I${r}`] = f(`IF(A${r}="","",IF(H${r}<=0,"Lunas",IF(TODAY()>E${r},"Terlambat","Belum jatuh tempo")))`);
    daftar[`J${r}`] = f(`IF(I${r}="Terlambat",TODAY()-E${r},"")`);
  }

  const pembayaran: Record<string, TCell> = {
    A1: 'Catatan pembayaran masuk',
    A2: 'Satu baris setiap ada pembayaran, termasuk cicilan. Nomor invoice harus sama persis dengan di sheet Daftar. Data di bawah hanya contoh.',
    A4: 'Tanggal',
    B4: 'Nomor invoice',
    C4: 'Jumlah',
    D4: 'Catatan',
  };
  pay.forEach(([date, no, amount, note], i) => {
    const r = P0 + i;
    pembayaran[`A${r}`] = d(date);
    pembayaran[`B${r}`] = no;
    pembayaran[`C${r}`] = amount;
    pembayaran[`D${r}`] = note;
  });

  return [
    howTo(
      'Invoice dan Rekap Piutang',
      [
        'Sheet Invoice adalah lembar tagihan siap cetak. Ganti nomor, tanggal, nama pelanggan, dan baris rincian.',
        'Setelah invoice dikirim, catat satu baris di sheet Daftar: nomor, tanggal, pelanggan, termin pembayaran (hari), dan total dari invoice.',
        'Setiap ada pembayaran masuk, catat di sheet Pembayaran dengan nomor invoice yang sama.',
        'Kembali ke sheet Daftar. Sisa, status Lunas atau Terlambat, dan jumlah hari terlambat dihitung sendiri berdasarkan tanggal hari ini.',
      ],
      ['SUMIF', 'COUNTIF', 'TODAY', 'IF', 'OR', 'SUM'],
    ),
    {
      name: 'Invoice',
      widths: [12, 40, 12, 18, 18],
      cells: invoice,
      title: ['A1'],
      head: ['A8:E8'],
      input: ['B3:B6', 'B9:D18', 'C21:C22'],
      total: ['D20:E20', 'D23:E23'],
      note: ['A25:A26'],
      fmt: { 'D9:E23': RP, 'C21:C22': PCT },
    },
    {
      name: 'Daftar',
      widths: [16, 13, 32, 12, 14, 16, 16, 16, 20, 14, 3, 26, 18],
      cells: daftar,
      title: ['A1'],
      head: ['A4:J4', 'L4:M4'],
      input: [`A${D0}:D${D1}`, `F${D0}:F${D1}`],
      note: ['A2'],
      fmt: { [`B${D0}:B${D1}`]: DATE, [`E${D0}:E${D1}`]: DATE, [`F${D0}:H${D1}`]: RP, 'M5:M8': RP },
      cf: [
        { range: `I${D0}:I${D1}`, formula: `I${D0}="Terlambat"`, fill: 'FFF8D7DA', font: 'FF9B1C1C' },
        { range: `I${D0}:I${D1}`, formula: `I${D0}="Lunas"`, fill: 'FFD9F2E1', font: 'FF185C37' },
      ],
      freeze: 4,
    },
    {
      name: 'Pembayaran',
      widths: [14, 18, 18, 30],
      cells: pembayaran,
      title: ['A1'],
      head: ['A4:D4'],
      input: [`A${P0}:D${P1}`],
      note: ['A2'],
      fmt: { [`A${P0}:A${P1}`]: DATE, [`C${P0}:C${P1}`]: RP },
      freeze: 4,
    },
  ];
}

// ---------------------------------------------------------------- anggaran pernikahan

export function anggaranPernikahan(): TSheet[] {
  const cats = ['Tempat', 'Katering', 'Dekorasi', 'Busana dan rias', 'Dokumentasi', 'Hiburan', 'Undangan dan souvenir', 'Seserahan dan mahar', 'Transportasi', 'Lain-lain'];
  // kategori, vendor, estimasi, kesepakatan, jatuh tempo
  const rows: [string, string, number, number, string][] = [
    ['Tempat', 'Gedung Serbaguna (contoh)', 25000000, 28000000, '2025-05-01'],
    ['Katering', 'Katering Sederhana (contoh)', 40000000, 38000000, '2025-05-20'],
    ['Dekorasi', 'Dekor Pelaminan (contoh)', 12000000, 12500000, '2025-05-20'],
    ['Busana dan rias', 'Rias dan busana (contoh)', 10000000, 9000000, '2025-05-25'],
    ['Dokumentasi', 'Foto dan video (contoh)', 8000000, 8500000, '2025-05-25'],
    ['Hiburan', 'Organ tunggal (contoh)', 4000000, 0, '2025-05-28'],
    ['Undangan dan souvenir', 'Percetakan (contoh)', 5000000, 4200000, '2025-04-15'],
    ['Seserahan dan mahar', 'Belanja seserahan (contoh)', 10000000, 0, '2025-05-10'],
    ['Transportasi', 'Sewa mobil (contoh)', 2000000, 0, '2025-05-30'],
  ];
  const pay: [string, string, string, number][] = [
    ['2025-01-10', 'Gedung Serbaguna (contoh)', 'DP', 10000000],
    ['2025-02-05', 'Katering Sederhana (contoh)', 'DP', 15000000],
    ['2025-02-20', 'Dekor Pelaminan (contoh)', 'DP', 5000000],
    ['2025-03-01', 'Rias dan busana (contoh)', 'DP', 3000000],
    ['2025-03-10', 'Foto dan video (contoh)', 'DP', 3000000],
    ['2025-03-15', 'Percetakan (contoh)', 'Pelunasan', 4200000],
    ['2025-04-01', 'Gedung Serbaguna (contoh)', 'Cicilan', 8000000],
  ];
  const A0 = 5;
  const A1 = 44;
  const P0 = 5;
  const P1 = 304;

  const anggaran: Record<string, TCell> = {
    A1: 'Anggaran per vendor',
    A2: 'Satu baris per vendor. Estimasi: perkiraan awal. Kesepakatan: harga deal (isi 0 bila belum deal). Dibayar diambil dari sheet Pembayaran. Data hanya contoh.',
    A4: 'Kategori',
    B4: 'Vendor',
    C4: 'Estimasi',
    D4: 'Kesepakatan',
    E4: 'Sudah dibayar',
    F4: 'Sisa tagihan',
    G4: 'Selisih dari estimasi',
    H4: 'Status',
    I4: 'Jatuh tempo pelunasan',
  };
  rows.forEach(([cat, vendor, est, deal, due], i) => {
    const r = A0 + i;
    anggaran[`A${r}`] = cat;
    anggaran[`B${r}`] = vendor;
    anggaran[`C${r}`] = est;
    anggaran[`D${r}`] = deal;
    anggaran[`I${r}`] = d(due);
  });
  for (let r = A0; r <= A1; r++) {
    anggaran[`E${r}`] = f(`IF(B${r}="","",SUMIF(${rangeOf('Pembayaran', 'B', P0, P1)},B${r},${rangeOf('Pembayaran', 'D', P0, P1)}))`);
    anggaran[`F${r}`] = f(`IF(B${r}="","",D${r}-E${r})`);
    anggaran[`G${r}`] = f(`IF(B${r}="","",IF(D${r}=0,0,D${r}-C${r}))`);
    anggaran[`H${r}`] = f(`IF(B${r}="","",IF(D${r}=0,"Belum deal",IF(F${r}<=0,"Lunas",IF(E${r}>0,"Sudah DP","Belum bayar"))))`);
  }

  const pembayaran: Record<string, TCell> = {
    A1: 'Catatan pembayaran ke vendor',
    A2: 'Satu baris setiap kali membayar. Nama vendor harus sama persis dengan di sheet Anggaran. Data di bawah hanya contoh.',
    A4: 'Tanggal',
    B4: 'Vendor',
    C4: 'Jenis',
    D4: 'Jumlah',
  };
  pay.forEach(([date, vendor, kind, amount], i) => {
    const r = P0 + i;
    pembayaran[`A${r}`] = d(date);
    pembayaran[`B${r}`] = vendor;
    pembayaran[`C${r}`] = kind;
    pembayaran[`D${r}`] = amount;
  });

  const cat = rangeOf('Anggaran', 'A', A0, A1);
  const ringkasan: Record<string, TCell> = {
    A1: 'Ringkasan anggaran',
    A3: 'Dana yang disiapkan',
    B3: 150000000,
    A5: 'Total estimasi',
    B5: f(`SUM(Anggaran!C${A0}:C${A1})`),
    A6: 'Total kesepakatan (sudah deal)',
    B6: f(`SUM(Anggaran!D${A0}:D${A1})`),
    A7: 'Perkiraan total (deal, ditambah estimasi yang belum deal)',
    B7: f(`B6+SUMIF(Anggaran!D${A0}:D${A1},0,Anggaran!C${A0}:C${A1})`),
    A8: 'Sudah dibayar',
    B8: f(`SUM(Anggaran!E${A0}:E${A1})`),
    A9: 'Sisa tagihan ke vendor',
    B9: f(`SUM(Anggaran!F${A0}:F${A1})`),
    A10: 'Sisa dana setelah perkiraan total',
    B10: f('B3-B7'),
    A11: 'Keterangan',
    B11: f('IF(B10<0,"Perkiraan melebihi dana","Masih dalam dana")'),
    A13: 'Per kategori',
    A14: 'Kategori',
    B14: 'Estimasi',
    C14: 'Kesepakatan',
    D14: 'Sudah dibayar',
  };
  cats.forEach((c, i) => {
    const r = 15 + i;
    ringkasan[`A${r}`] = c;
    ringkasan[`B${r}`] = f(`SUMIF(${cat},A${r},Anggaran!$C$${A0}:$C$${A1})`);
    ringkasan[`C${r}`] = f(`SUMIF(${cat},A${r},Anggaran!$D$${A0}:$D$${A1})`);
    ringkasan[`D${r}`] = f(`SUMIF(${cat},A${r},Anggaran!$E$${A0}:$E$${A1})`);
  });
  const last = 14 + cats.length;
  ringkasan[`A${last + 1}`] = 'Total';
  ringkasan[`B${last + 1}`] = f(`SUM(B15:B${last})`);
  ringkasan[`C${last + 1}`] = f(`SUM(C15:C${last})`);
  ringkasan[`D${last + 1}`] = f(`SUM(D15:D${last})`);

  return [
    howTo(
      'Anggaran Pernikahan',
      [
        'Sheet Ringkasan: isi dana yang kamu siapkan, dan ubah daftar kategori bila perlu.',
        'Sheet Anggaran: tulis satu baris tiap vendor dengan estimasi awal. Setelah deal, isi kolom Kesepakatan.',
        'Sheet Pembayaran: catat setiap DP, cicilan, dan pelunasan. Nama vendor harus sama persis.',
        'Kembali ke Anggaran dan Ringkasan untuk melihat sisa tagihan, status tiap vendor, dan apakah perkiraan total masih masuk dana.',
      ],
      ['SUMIF', 'IF', 'SUM'],
    ),
    {
      name: 'Anggaran',
      widths: [24, 32, 16, 16, 16, 16, 20, 16, 22],
      cells: anggaran,
      title: ['A1'],
      head: ['A4:I4'],
      input: [`A${A0}:D${A1}`, `I${A0}:I${A1}`],
      note: ['A2'],
      fmt: { [`C${A0}:G${A1}`]: RP, [`I${A0}:I${A1}`]: DATE },
      lists: { [`A${A0}:A${A1}`]: 'Ringkasan!$A$15:$A$24' },
      cf: [
        { range: `H${A0}:H${A1}`, formula: `H${A0}="Lunas"`, fill: 'FFD9F2E1', font: 'FF185C37' },
        { range: `G${A0}:G${A1}`, formula: `AND(ISNUMBER(G${A0}),G${A0}>0)`, fill: 'FFF8D7DA', font: 'FF9B1C1C' },
      ],
      freeze: 4,
    },
    {
      name: 'Pembayaran',
      widths: [14, 32, 14, 18],
      cells: pembayaran,
      title: ['A1'],
      head: ['A4:D4'],
      input: [`A${P0}:D${P1}`],
      note: ['A2'],
      fmt: { [`A${P0}:A${P1}`]: DATE, [`D${P0}:D${P1}`]: RP },
      lists: { [`B${P0}:B${P1}`]: `Anggaran!$B$${A0}:$B$${A1}`, [`C${P0}:C${P1}`]: '"DP,Cicilan,Pelunasan"' },
      freeze: 4,
    },
    {
      name: 'Ringkasan',
      widths: [52, 20, 20, 20],
      cells: ringkasan,
      title: ['A1'],
      head: ['A14:D14'],
      input: ['B3', 'A15:A24'],
      total: [`A${last + 1}:D${last + 1}`],
      fmt: { 'B3:B10': RP, [`B15:D${last + 1}`]: RP },
    },
  ];
}

// ---------------------------------------------------------------- RAB sederhana

export function rabSederhana(): TSheet[] {
  const prices: [string, string, number][] = [
    ['Pembersihan lahan dan area kerja', 'm2', 15000],
    ['Bongkar keramik lama', 'm2', 45000],
    ['Pasang keramik lantai 40x40', 'm2', 135000],
    ['Pasang keramik dinding kamar mandi', 'm2', 150000],
    ['Plesteran dinding', 'm2', 60000],
    ['Pengecatan dinding (2 lapis)', 'm2', 38000],
    ['Pasang plafon gypsum', 'm2', 125000],
    ['Pengecatan plafon', 'm2', 35000],
    ['Pasang titik lampu', 'titik', 150000],
    ['Pasang stop kontak', 'titik', 130000],
    ['Pasang kusen dan pintu', 'unit', 1800000],
    ['Pasang kran dan saniter', 'unit', 350000],
  ];
  const plan: [string, string, number][] = [
    ['Persiapan', 'Pembersihan lahan dan area kerja', 40],
    ['Pembongkaran', 'Bongkar keramik lama', 30],
    ['Lantai', 'Pasang keramik lantai 40x40', 30],
    ['Dinding', 'Pasang keramik dinding kamar mandi', 12],
    ['Dinding', 'Plesteran dinding', 25],
    ['Dinding', 'Pengecatan dinding (2 lapis)', 80],
    ['Plafon', 'Pasang plafon gypsum', 30],
    ['Plafon', 'Pengecatan plafon', 30],
    ['Listrik', 'Pasang titik lampu', 6],
    ['Listrik', 'Pasang stop kontak', 5],
    ['Pintu dan jendela', 'Pasang kusen dan pintu', 2],
    ['Sanitasi', 'Pasang kran dan saniter', 3],
  ];
  const groups = ['Persiapan', 'Pembongkaran', 'Lantai', 'Dinding', 'Plafon', 'Listrik', 'Pintu dan jendela', 'Sanitasi', 'Lain-lain'];
  const H0 = 5;
  const H1 = 44;
  const R0 = 5;
  const R1 = 64;
  const hs = "'Harga satuan'";

  const harga: Record<string, TCell> = {
    A1: 'Daftar harga satuan',
    A2: 'Harga di bawah hanya CONTOH. Ganti dengan harga di daerahmu (upah dan bahan per satuan).',
    A4: 'Uraian pekerjaan',
    B4: 'Satuan',
    C4: 'Harga per satuan',
  };
  prices.forEach(([n, u, p], i) => {
    harga[`A${H0 + i}`] = n;
    harga[`B${H0 + i}`] = u;
    harga[`C${H0 + i}`] = p;
  });

  const rab: Record<string, TCell> = {
    A1: 'Rencana Anggaran Biaya',
    A2: 'Pilih kelompok dan uraian pekerjaan, isi volume. Satuan, harga, dan jumlah terisi sendiri. Perkiraan untuk keperluan pribadi, bukan untuk tender resmi.',
    A4: 'No',
    B4: 'Kelompok',
    C4: 'Uraian pekerjaan',
    D4: 'Satuan',
    E4: 'Volume',
    F4: 'Harga satuan',
    G4: 'Jumlah',
  };
  plan.forEach(([g, u, v], i) => {
    const r = R0 + i;
    rab[`B${r}`] = g;
    rab[`C${r}`] = u;
    rab[`E${r}`] = v;
  });
  for (let r = R0; r <= R1; r++) {
    rab[`A${r}`] = r - R0 + 1;
    rab[`D${r}`] = f(`IF(C${r}="","",IFERROR(VLOOKUP(C${r},${hs}!$A$${H0}:$C$${H1},2,FALSE),"Uraian tidak ada"))`);
    rab[`F${r}`] = f(`IF(C${r}="","",IFERROR(VLOOKUP(C${r},${hs}!$A$${H0}:$C$${H1},3,FALSE),0))`);
    rab[`G${r}`] = f(`IF(OR(C${r}="",E${r}=""),"",E${r}*F${r})`);
  }

  const rekap: Record<string, TCell> = { A1: 'Rekap RAB', A3: 'Kelompok pekerjaan', B3: 'Jumlah' };
  groups.forEach((g, i) => {
    const r = 4 + i;
    rekap[`A${r}`] = g;
    rekap[`B${r}`] = f(`SUMIF(RAB!$B$${R0}:$B$${R1},A${r},RAB!$G$${R0}:$G$${R1})`);
  });
  const s = 4 + groups.length; // baris subtotal
  rekap[`A${s}`] = 'Subtotal';
  rekap[`B${s}`] = f(`SUM(B4:B${s - 1})`);
  rekap[`A${s + 1}`] = 'Pekerjaan yang kelompoknya tidak ada di daftar ini';
  rekap[`B${s + 1}`] = f(`SUM(RAB!G${R0}:G${R1})-B${s}`);
  rekap[`A${s + 3}`] = 'Overhead dan keuntungan (%)';
  rekap[`B${s + 3}`] = 0.1;
  rekap[`A${s + 4}`] = 'Jumlah overhead dan keuntungan';
  rekap[`B${s + 4}`] = f(`B${s}*B${s + 3}`);
  rekap[`A${s + 5}`] = 'PPN (%), isi 0 bila tidak ada';
  rekap[`B${s + 5}`] = 0.11;
  rekap[`A${s + 6}`] = 'Jumlah PPN';
  rekap[`B${s + 6}`] = f(`(B${s}+B${s + 4})*B${s + 5}`);
  rekap[`A${s + 7}`] = 'TOTAL';
  rekap[`B${s + 7}`] = f(`B${s}+B${s + 4}+B${s + 6}`);
  rekap[`A${s + 8}`] = 'Dibulatkan ke ribuan';
  rekap[`B${s + 8}`] = f(`ROUND(B${s + 7},-3)`);
  rekap[`A${s + 10}`] = 'Perkiraan untuk keperluan pribadi, bukan RAB untuk tender resmi. Harga satuan contoh perlu diganti dengan harga daerahmu.';

  return [
    howTo(
      'RAB Sederhana (Renovasi atau Proyek Kecil)',
      [
        'Buka sheet Harga satuan. Ganti harga contoh dengan harga di daerahmu, dan tambah pekerjaan yang kamu butuhkan.',
        'Buka sheet RAB. Untuk tiap baris: pilih kelompok, pilih uraian pekerjaan dari daftar, isi volume. Satuan, harga, dan jumlah terisi sendiri.',
        'Buka sheet Rekap. Lihat subtotal tiap kelompok, atur persen overhead dan PPN, lalu baca total biaya.',
        'Ini perkiraan untuk keperluan pribadi, bukan RAB untuk tender resmi. Harga contoh bukan acuan harga resmi.',
      ],
      ['VLOOKUP', 'IFERROR', 'SUMIF', 'IF', 'OR', 'SUM', 'ROUND'],
    ),
    {
      name: 'Harga satuan',
      widths: [42, 10, 18],
      cells: harga,
      title: ['A1'],
      head: ['A4:C4'],
      input: [`A${H0}:C${H1}`],
      note: ['A2'],
      fmt: { [`C${H0}:C${H1}`]: RP },
      freeze: 4,
    },
    {
      name: 'RAB',
      widths: [6, 20, 40, 10, 10, 16, 18],
      cells: rab,
      title: ['A1'],
      head: ['A4:G4'],
      input: [`B${R0}:C${R1}`, `E${R0}:E${R1}`],
      note: ['A2'],
      fmt: { [`F${R0}:G${R1}`]: RP },
      lists: { [`B${R0}:B${R1}`]: 'Rekap!$A$4:$A$12', [`C${R0}:C${R1}`]: `${hs}!$A$${H0}:$A$${H1}` },
      freeze: 4,
    },
    {
      name: 'Rekap',
      widths: [52, 20],
      cells: rekap,
      title: ['A1'],
      head: ['A3:B3'],
      input: ['A4:A12', `B${s + 3}`, `B${s + 5}`],
      total: [`A${s}:B${s}`, `A${s + 7}:B${s + 7}`],
      note: [`A${s + 10}`],
      fmt: { [`B4:B${s + 1}`]: RP, [`B${s + 3}`]: PCT, [`B${s + 4}`]: RP, [`B${s + 5}`]: PCT, [`B${s + 6}:B${s + 8}`]: RP },
    },
  ];
}
