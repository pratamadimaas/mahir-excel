import type { Difficulty, ExerciseDef, ExerciseTools, ValidationDef } from '../types';
import { indexToCol } from '@excellab/spreadsheet-engine';

type Row = (string | number)[];

/** Mengubah baris-baris data menjadi peta sel mulai dari A1. String kosong dilewati. */
export function g(rows: Row[], startRow = 1): Record<string, string> {
  const out: Record<string, string> = {};
  rows.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v !== '') out[`${indexToCol(c)}${startRow + r}`] = String(v);
    });
  });
  return out;
}

export const POINTS: Record<Difficulty, number> = { mudah: 10, sedang: 20, sulit: 30 };

export interface Spec {
  slug: string;
  title: string;
  description: string;
  topic: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  cells: Record<string, string>;
  editable: string[];
  task: string;
  hints: string[];
  explanation: string;
  lessonSlug: string;
  validation: ValidationDef;
  tools?: ExerciseTools;
}

const specs: Spec[] = [
  {
    slug: 'isi-data-warung',
    title: 'Tambah barang ke daftar warung',
    description: 'Latihan memasukkan teks dan angka ke sel yang tepat.',
    topic: 'mengenal-excel',
    difficulty: 'mudah',
    rows: 6,
    cols: 4,
    cells: g([
      ['Barang', 'Harga'],
      ['Beras', 15000],
      ['Gula', 14000],
    ]),
    editable: ['A4', 'B4'],
    task: 'Tambahkan satu barang baru di baris 4: ketik nama "Minyak" di sel A4 dan harga 18000 di sel B4. Tulis angkanya saja, tanpa "Rp" atau titik.',
    hints: [
      'Klik sel A4, lalu ketik nama barangnya.',
      'Pindah ke B4 dan ketik angka harga tanpa huruf apa pun.',
      'Jangan menulis "Rp" atau titik pemisah ribuan; angka murni agar bisa dihitung nanti.',
    ],
    explanation:
      'Teks (Minyak) masuk ke kolom Barang dan angka murni (18000) masuk ke kolom Harga. Angka tanpa satuan dikenali sebagai angka sehingga bisa dihitung. Tampilan Rp bisa diatur lewat format sel.',
    lessonSlug: 'sel-baris-kolom-rentang',
    validation: {
      targets: [
        { cell: 'A4', solution: 'Minyak' },
        { cell: 'B4', solution: '18000' },
      ],
    },
  },
  {
    slug: 'total-harga-barang',
    title: 'Hitung total harga tiap barang',
    description: 'Tulis rumus yang memakai referensi sel, bukan angka yang diketik ulang.',
    topic: 'mengenal-excel',
    difficulty: 'mudah',
    rows: 6,
    cols: 5,
    cells: g([
      ['Barang', 'Harga', 'Jumlah', 'Total'],
      ['Beras', 15000, 2],
      ['Gula', 14000, 3],
      ['Minyak', 18000, 1],
    ]),
    editable: ['D2:D4'],
    task: 'Isi kolom Total (D2 sampai D4) dengan rumus harga × jumlah untuk setiap barang. Pakai referensi sel, jangan ketik angkanya.',
    hints: [
      'Rumus selalu diawali tanda sama dengan (=).',
      'Total baris 2 adalah isi B2 dikali isi C2.',
      'Tulis =B2*C2 di D2, lalu sesuaikan nomor baris untuk D3 dan D4.',
    ],
    explanation:
      'D2 =B2*C2, D3 =B3*C3, dan D4 =B4*C4. Karena memakai referensi, jika harga atau jumlah diubah, total ikut berubah otomatis.',
    lessonSlug: 'referensi-sel-dasar',
    validation: {
      targets: [
        { cell: 'D2', solution: '=B2*C2' },
        { cell: 'D3', solution: '=B3*C3' },
        { cell: 'D4', solution: '=B4*C4' },
      ],
      variants: [
        { B2: '20000', C3: '5' },
        { C2: '7', B4: '1' },
      ],
    },
  },
  {
    slug: 'cari-penjualan-tertinggi',
    title: 'Siapa di urutan pertama?',
    description: 'Bayangkan data diurutkan dari penjualan terbesar. Siapa yang ada di baris pertama?',
    topic: 'mengolah-data',
    difficulty: 'mudah',
    rows: 7,
    cols: 5,
    cells: g([
      ['Sales', 'Penjualan', '', 'Urutan pertama:'],
      ['Budi', 7500000],
      ['Sari', 9200000],
      ['Dewi', 5100000],
      ['Andi', 6400000],
    ]),
    editable: ['E1'],
    task: 'Jika tabel diurutkan berdasarkan Penjualan dari terbesar ke terkecil, nama siapa yang muncul di baris pertama? Ketik namanya di sel E1.',
    hints: [
      'Cari angka penjualan paling besar.',
      'Lihat nama sales di baris yang sama dengan angka itu.',
      'Ketik nama tersebut persis seperti di tabel.',
    ],
    explanation:
      'Penjualan terbesar adalah 9.200.000 milik Sari, jadi Sari ada di baris pertama setelah sort terbesar ke terkecil. Sort memindahkan seluruh baris sehingga nama dan angka tetap berpasangan.',
    lessonSlug: 'mengurutkan-menyaring-tabel',
    validation: { targets: [{ cell: 'E1', solution: 'Sari' }] },
  },
  {
    slug: 'hitung-baris-filter',
    title: 'Berapa baris yang tampil setelah filter?',
    description: 'Baca hasil filter pada kolom Status.',
    topic: 'mengolah-data',
    difficulty: 'mudah',
    rows: 9,
    cols: 5,
    cells: g([
      ['Pelanggan', 'Total', 'Status', '', 'Baris tampil:'],
      ['Ani', 50000, 'Lunas'],
      ['Beni', 70000, 'Belum'],
      ['Citra', 30000, 'Lunas'],
      ['Dedi', 90000, 'Lunas'],
      ['Eka', 45000, 'Belum'],
      ['Fajar', 60000, 'Lunas'],
    ]),
    editable: ['E2'],
    task: 'Jika filter kolom Status hanya menampilkan "Lunas", berapa baris data (tanpa judul) yang tampil? Ketik angkanya di sel E2.',
    hints: ['Lihat hanya kolom Status.', 'Hitung satu per satu baris yang berisi Lunas.', 'Judul kolom tidak dihitung.'],
    explanation: 'Ada 4 baris berstatus Lunas: Ani, Citra, Dedi, dan Fajar. Filter hanya menyembunyikan baris lain; datanya tetap ada.',
    lessonSlug: 'mengurutkan-menyaring-tabel',
    validation: { targets: [{ cell: 'E2', solution: '4' }] },
  },
  {
    slug: 'perbaiki-angka-teks',
    title: 'Perbaiki harga yang tersimpan sebagai teks',
    description: 'Temukan angka yang tidak ikut dijumlahkan, perbaiki, lalu hitung total.',
    topic: 'mengolah-data',
    difficulty: 'sedang',
    rows: 9,
    cols: 4,
    cells: g([
      ['Barang', 'Harga'],
      ['Beras', 15000],
      ['Gula', 14000],
      ['Telur', 'Rp 17000'],
      ['Minyak', 18000],
      ['Tepung', 12000],
      ['Total'],
    ]),
    editable: ['B4', 'B7'],
    task: 'Harga Telur di B4 tertulis sebagai teks. Ganti dengan angka 17000, lalu isi B7 dengan rumus SUM yang menjumlahkan semua harga.',
    hints: ['Angka yang rata kiri biasanya teks.', 'Ganti isi B4 dengan 17000 saja.', 'Total di B7: =SUM(B2:B6).'],
    explanation:
      'SUM mengabaikan teks, jadi dengan "Rp 17000" total hanya 59.000. Setelah B4 diganti angka 17000, =SUM(B2:B6) menghasilkan 76.000.',
    lessonSlug: 'data-tidak-konsisten',
    validation: {
      targets: [
        { cell: 'B4', solution: '17000' },
        { cell: 'B7', solution: '=SUM(B2:B6)', requireFunction: 'SUM' },
      ],
      rules: [
        {
          pattern: 'SUM',
          message: 'Totalnya belum sesuai. Pastikan semua harga adalah angka (rata kanan) dan rentang mencakup B2 sampai B6.',
        },
      ],
    },
  },
  {
    slug: 'seragamkan-kota',
    title: 'Seragamkan penulisan kota',
    description: 'Rapikan huruf besar-kecil dan spasi tersembunyi.',
    topic: 'mengolah-data',
    difficulty: 'sedang',
    rows: 7,
    cols: 4,
    cells: g([
      ['Nama', 'Kota'],
      ['Ani', 'jakarta'],
      ['Beni', 'JAKARTA '],
      ['Citra', 'Jakarta'],
      ['Dedi', 'Bandung'],
    ]),
    editable: ['B2', 'B3'],
    task: 'Seragamkan B2 dan B3 agar sama dengan penulisan di B4: "Jakarta" (J kapital, huruf lain kecil, tanpa spasi tambahan).',
    hints: [
      'Klik B3 dan lihat formula bar: ada spasi di akhir.',
      'Ketik ulang isi sel, jangan hanya mengubah sebagian.',
      'Tulis tepat: Jakarta.',
    ],
    explanation:
      'Ketiga sel sebaiknya identik: "Jakarta". Perbedaan huruf besar-kecil dan spasi di akhir membuat filter dan pencarian menganggapnya berbeda.',
    lessonSlug: 'data-tidak-konsisten',
    validation: {
      targets: [
        { cell: 'B2', solution: 'Jakarta', exactText: true },
        { cell: 'B3', solution: 'Jakarta', exactText: true },
      ],
      rules: [{ pattern: '.', message: 'Tulis persis "Jakarta": J kapital, huruf lainnya kecil, tanpa spasi di awal atau akhir.' }],
    },
  },
  {
    slug: 'total-pengeluaran',
    title: 'Total pengeluaran bulanan',
    description: 'Gunakan SUM untuk menjumlahkan satu rentang.',
    topic: 'rumus-dasar',
    difficulty: 'mudah',
    rows: 9,
    cols: 4,
    cells: g([
      ['Pos', 'Biaya'],
      ['Makan', 350000],
      ['Transport', 120000],
      ['Pulsa', 50000],
      ['Listrik', 200000],
      ['Internet', 300000],
      ['Total'],
    ]),
    editable: ['B7'],
    task: 'Isi B7 dengan rumus yang menjumlahkan semua biaya di B2 sampai B6 memakai fungsi SUM.',
    hints: ['Awali dengan =SUM(', 'Rentang dituliskan sel pertama, titik dua, sel terakhir.', 'Jawaban: =SUM(B2:B6)'],
    explanation:
      '=SUM(B2:B6) menjumlahkan lima biaya sekaligus: 1.020.000. Jika ada baris baru di tengah rentang, SUM otomatis ikut menghitung.',
    lessonSlug: 'fungsi-sum',
    validation: {
      targets: [{ cell: 'B7', solution: '=SUM(B2:B6)', requireFunction: 'SUM' }],
      variants: [{ B2: '400000' }, { B5: '0', B6: '1' }],
    },
  },
  {
    slug: 'sum-dua-toko',
    title: 'Total penjualan dua toko',
    description: 'Jumlahkan rentang yang meliputi lebih dari satu kolom.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 9,
    cols: 4,
    cells: g([
      ['Hari', 'Toko Pusat', 'Toko Cabang'],
      ['Senin', 1200000, 800000],
      ['Selasa', 1500000, 900000],
      ['Rabu', 1100000, 950000],
      ['Kamis', 1700000, 700000],
      ['', '', ''],
      ['Total semua toko'],
    ]),
    editable: ['B7'],
    task: 'Isi B7 dengan total penjualan seluruh hari dari kedua toko (B2 sampai C5) memakai SUM.',
    hints: [
      'Rentang bisa berbentuk persegi panjang: dua kolom sekaligus.',
      'Sel pojok kiri atas B2, sel pojok kanan bawah C5.',
      'Jawaban: =SUM(B2:C5)',
    ],
    explanation: '=SUM(B2:C5) mencakup dua kolom dan empat baris sekaligus. Alternatifnya =SUM(B2:B5;C2:C5) (dua rentang terpisah).',
    lessonSlug: 'fungsi-sum',
    validation: {
      targets: [{ cell: 'B7', solution: '=SUM(B2:C5)', requireFunction: 'SUM' }],
      variants: [{ B2: '1000000' }, { C5: '0' }],
      rules: [
        {
          pattern: 'SUM\\(\\s*B2:B5\\s*\\)\\s*$',
          message: 'Rumusmu baru mencakup Toko Pusat. Perluas rentang sampai kolom C agar Toko Cabang ikut dijumlahkan.',
        },
      ],
    },
  },
  {
    slug: 'statistik-nilai',
    title: 'Ringkas nilai ujian',
    description: 'Hitung rata-rata, nilai terendah, dan tertinggi.',
    topic: 'rumus-dasar',
    difficulty: 'mudah',
    rows: 11,
    cols: 4,
    cells: g([
      ['Siswa', 'Nilai'],
      ['Ani', 80],
      ['Beni', 70],
      ['Citra', 90],
      ['Dedi', 60],
      ['Eka', 100],
      ['', ''],
      ['Rata-rata'],
      ['Terendah'],
      ['Tertinggi'],
    ]),
    editable: ['B8:B10'],
    task: 'Isi B8 dengan rata-rata nilai, B9 dengan nilai terendah, dan B10 dengan nilai tertinggi dari B2:B6. Pakai fungsi AVERAGE, MIN, dan MAX.',
    hints: [
      'Tiga fungsi, tiga sel: satu fungsi per baris.',
      'Semuanya memakai rentang B2:B6.',
      'B8 =AVERAGE(B2:B6), B9 =MIN(B2:B6), B10 =MAX(B2:B6)',
    ],
    explanation:
      'Rata-rata = (80+70+90+60+100)/5 = 80, terendah 60, tertinggi 100. Rumusnya mengikuti perubahan data karena memakai rentang.',
    lessonSlug: 'average-min-max',
    validation: {
      targets: [
        { cell: 'B8', solution: '=AVERAGE(B2:B6)', requireFunction: 'AVERAGE' },
        { cell: 'B9', solution: '=MIN(B2:B6)', requireFunction: 'MIN' },
        { cell: 'B10', solution: '=MAX(B2:B6)', requireFunction: 'MAX' },
      ],
      variants: [{ B3: '40' }, { B6: '55', B2: '95' }],
    },
  },
  {
    slug: 'rata-rata-hari-kosong',
    title: 'Rata-rata dengan hari kosong',
    description: 'AVERAGE melewati sel kosong. Cek pemahamanmu.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 8,
    cols: 4,
    cells: g([['Hari', 'Penjualan'], ['Senin', 100000], ['Selasa', ''], ['Rabu', 200000], ['Kamis', 300000], ['', ''], ['Rata-rata']]),
    editable: ['B7'],
    task: 'Hitung rata-rata penjualan di B7 memakai AVERAGE atas B2:B5. Selasa belum diisi, biarkan kosong.',
    hints: [
      'Gunakan AVERAGE dengan rentang B2:B5.',
      'Sel kosong tidak dihitung sebagai nol.',
      'Jawaban: =AVERAGE(B2:B5) menghasilkan 200.000.',
    ],
    explanation:
      'Sel kosong dilewati, jadi rata-ratanya (100.000 + 200.000 + 300.000) / 3 = 200.000. Jika Selasa diisi angka 0, rata-ratanya jadi 150.000.',
    lessonSlug: 'average-min-max',
    validation: {
      targets: [{ cell: 'B7', solution: '=AVERAGE(B2:B5)', requireFunction: 'AVERAGE' }],
      variants: [{ B3: '400000' }, { B2: '0' }],
    },
  },
  {
    slug: 'hitung-nilai-kuis',
    title: 'Berapa yang sudah punya nilai?',
    description: 'Bedakan COUNT (angka) dan COUNTA (sel terisi).',
    topic: 'rumus-dasar',
    difficulty: 'mudah',
    rows: 11,
    cols: 4,
    cells: g([
      ['Siswa', 'Nilai Kuis'],
      ['Ani', 80],
      ['Beni', 'Absen'],
      ['Citra', ''],
      ['Dedi', 75],
      ['Eka', 90],
      ['', ''],
      ['Jumlah nilai (angka)'],
      ['Jumlah sel terisi'],
    ]),
    editable: ['B8', 'B9'],
    task: 'Di B8 hitung berapa sel yang berisi angka (COUNT) dan di B9 berapa sel yang terisi apa saja (COUNTA), keduanya untuk B2:B6.',
    hints: [
      'COUNT hanya menghitung angka.',
      'COUNTA menghitung semua sel yang tidak kosong, termasuk teks "Absen".',
      'B8 =COUNT(B2:B6) dan B9 =COUNTA(B2:B6)',
    ],
    explanation:
      'COUNT = 3 (80, 75, 90) karena "Absen" adalah teks dan Citra kosong. COUNTA = 4 karena "Absen" terhitung terisi, sedangkan sel kosong tidak.',
    lessonSlug: 'count-counta',
    validation: {
      targets: [
        { cell: 'B8', solution: '=COUNT(B2:B6)', requireFunction: 'COUNT' },
        { cell: 'B9', solution: '=COUNTA(B2:B6)', requireFunction: 'COUNTA' },
      ],
      variants: [{ B3: '70' }, { B4: '60', B5: 'Izin' }],
    },
  },
  {
    slug: 'pajak-ppn',
    title: 'Hitung PPN dengan tarif terkunci',
    description: 'Gunakan referensi absolut agar tarif tidak bergeser.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 7,
    cols: 5,
    cells: g([
      ['Barang', 'Harga', 'PPN', 'Tarif PPN:', 0.11],
      ['Beras', 15000],
      ['Gula', 14000],
      ['Minyak', 18000],
      ['Telur', 27000],
    ]),
    editable: ['C2:C5'],
    task: 'Isi C2 sampai C5 dengan PPN = harga × tarif di E1. Tulis rumus yang aman disalin ke bawah: kunci sel tarif dengan tanda $.',
    hints: [
      'Harga berubah per baris (relatif), tarif selalu di E1.',
      'Kunci kolom dan baris tarif: $E$1.',
      'C2 =B2*$E$1, C3 =B3*$E$1, dan seterusnya.',
    ],
    explanation:
      '$E$1 tetap menunjuk E1 walau rumus disalin, sedangkan B2 bergeser menjadi B3, B4, B5. Tanpa $, rumus yang disalin ke bawah akan memakai E2, E3, … yang kosong.',
    lessonSlug: 'referensi-relatif-absolut',
    validation: {
      targets: ['C2', 'C3', 'C4', 'C5'].map((c, i) => ({ cell: c, solution: `=B${i + 2}*$E$1` })),
      requirePatterns: [{ pattern: '\\$E\\$1', message: 'Kunci sel tarif dengan $E$1 supaya rumus aman disalin ke baris lain.' }],
      variants: [{ E1: '0.1' }, { B3: '20000', E1: '0.12' }],
    },
  },
  {
    slug: 'porsi-penjualan',
    title: 'Porsi tiap produk terhadap total',
    description: 'Bagi tiap angka dengan total yang terkunci.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 8,
    cols: 4,
    cells: g([
      ['Produk', 'Penjualan', 'Porsi'],
      ['Beras', 300000],
      ['Gula', 150000],
      ['Minyak', 250000],
      ['Telur', 300000],
      ['Total', '=SUM(B2:B5)'],
    ]),
    editable: ['C2:C5'],
    task: 'Isi C2 sampai C5 dengan porsi = penjualan produk ÷ total di B6. Kunci sel total dengan $.',
    hints: [
      'Total ada di B6 dan harus tetap saat rumus disalin.',
      'Penjualan produk relatif, total absolut: $B$6.',
      'C2 =B2/$B$6, C3 =B3/$B$6, …',
    ],
    explanation:
      'Hasilnya berupa pecahan (0,3 = 30%). Di Excel, ubah format sel menjadi Persen untuk menampilkan 30%. $B$6 menjaga pembagi tetap total.',
    lessonSlug: 'referensi-relatif-absolut',
    validation: {
      targets: ['C2', 'C3', 'C4', 'C5'].map((c, i) => ({ cell: c, solution: `=B${i + 2}/$B$6` })),
      requirePatterns: [{ pattern: '\\$B\\$6', message: 'Kunci sel total dengan $B$6 agar semua baris dibagi total yang sama.' }],
      variants: [{ B2: '500000' }, { B4: '0', B3: '20000' }],
    },
  },
  {
    slug: 'status-kelulusan',
    title: 'Tentukan status kelulusan',
    description: 'Tulis IF dasar dengan hasil teks.',
    topic: 'logika',
    difficulty: 'mudah',
    rows: 7,
    cols: 4,
    cells: g([
      ['Siswa', 'Nilai', 'Status'],
      ['Ani', 82],
      ['Beni', 65],
      ['Citra', 70],
      ['Dedi', 55],
    ]),
    editable: ['C2:C5'],
    task: 'Isi C2 sampai C5 dengan IF: tampilkan "Lulus" bila nilai minimal 70 dan "Remedial" bila kurang dari 70.',
    hints: [
      'Uji logikanya: nilai >= 70.',
      'Teks hasil harus diapit tanda kutip ganda.',
      '=IF(B2>=70,"Lulus","Remedial") (atau pakai titik koma)',
    ],
    explanation:
      'Nilai tepat 70 harus Lulus sehingga memakai >=. Teks "Lulus" dan "Remedial" ditulis dengan kutip, sedangkan B2 adalah referensi sel tanpa kutip.',
    lessonSlug: 'fungsi-if',
    validation: {
      targets: ['C2', 'C3', 'C4', 'C5'].map((c, i) => ({
        cell: c,
        solution: `=IF(B${i + 2}>=70,"Lulus","Remedial")`,
        requireFunction: 'IF',
      })),
      variants: [
        { B2: '50', B3: '90' },
        { B4: '69', B5: '70' },
      ],
      rules: [
        { pattern: '>\\s*70(?!=)', message: 'Nilai tepat 70 harus Lulus. Gunakan >= (lebih besar atau sama dengan), bukan hanya >.' },
      ],
    },
  },
  {
    slug: 'bonus-penjualan',
    title: 'Hitung bonus sales',
    description: 'IF yang menghasilkan angka, bukan teks.',
    topic: 'logika',
    difficulty: 'sedang',
    rows: 7,
    cols: 4,
    cells: g([
      ['Sales', 'Penjualan', 'Bonus'],
      ['Ani', 6000000],
      ['Beni', 4000000],
      ['Citra', 5000000],
      ['Dedi', 2500000],
    ]),
    editable: ['C2:C5'],
    task: 'Bonus 10% dari penjualan diberikan jika penjualan minimal 5.000.000. Jika tidak, bonusnya 0. Isi C2 sampai C5 dengan IF.',
    hints: [
      'Uji: B2>=5000000. Tulis angka tanpa titik.',
      'Jika benar: B2*0.1 (angka, tanpa kutip). Jika salah: 0.',
      '=IF(B2>=5000000,B2*0.1,0)',
    ],
    explanation:
      'Hasil IF bisa berupa rumus: B2*0.1 dihitung hanya bila syarat terpenuhi. Citra tepat 5.000.000 sehingga berhak bonus (>=).',
    lessonSlug: 'fungsi-if',
    validation: {
      targets: ['C2', 'C3', 'C4', 'C5'].map((c, i) => ({
        cell: c,
        solution: `=IF(B${i + 2}>=5000000,B${i + 2}*0.1,0)`,
        requireFunction: 'IF',
      })),
      variants: [{ B3: '8000000' }, { B2: '1000000', B5: '5000000' }],
    },
  },
  {
    slug: 'syarat-beasiswa',
    title: 'Seleksi beasiswa dengan dua syarat',
    description: 'Gabungkan dua syarat dengan AND di dalam IF.',
    topic: 'logika',
    difficulty: 'sedang',
    rows: 7,
    cols: 5,
    cells: g([
      ['Siswa', 'Nilai', 'Kehadiran (%)', 'Beasiswa'],
      ['Ani', 90, 95],
      ['Beni', 88, 80],
      ['Citra', 70, 98],
      ['Dedi', 92, 92],
    ]),
    editable: ['D2:D5'],
    task: 'Siswa mendapat beasiswa ("Ya") jika nilai minimal 85 DAN kehadiran minimal 90. Selain itu "Tidak". Isi D2 sampai D5 dengan IF dan AND.',
    hints: [
      'AND(syarat1, syarat2) benar bila keduanya benar.',
      'Syarat 1: B2>=85. Syarat 2: C2>=90.',
      '=IF(AND(B2>=85,C2>=90),"Ya","Tidak")',
    ],
    explanation:
      'Beni nilainya cukup tetapi kehadiran 80 sehingga "Tidak"; Citra kehadirannya cukup tetapi nilai 70 sehingga "Tidak". Hanya Ani dan Dedi memenuhi keduanya.',
    lessonSlug: 'and-or-if-bertingkat',
    validation: {
      targets: ['D2', 'D3', 'D4', 'D5'].map((c, i) => ({
        cell: c,
        solution: `=IF(AND(B${i + 2}>=85,C${i + 2}>=90),"Ya","Tidak")`,
        requireFunction: 'AND',
      })),
      variants: [{ B2: '80' }, { C3: '95', B4: '90' }, { C5: '89' }],
    },
  },
  {
    slug: 'diskon-member',
    title: 'Diskon untuk member atau belanja besar',
    description: 'Gunakan OR: cukup salah satu syarat yang terpenuhi.',
    topic: 'logika',
    difficulty: 'sedang',
    rows: 7,
    cols: 5,
    cells: g([
      ['Pelanggan', 'Member', 'Belanja', 'Diskon'],
      ['Ani', 'Ya', 200000],
      ['Beni', 'Tidak', 600000],
      ['Citra', 'Tidak', 100000],
      ['Dedi', 'Ya', 700000],
    ]),
    editable: ['D2:D5'],
    task: 'Diskon 10% dari belanja diberikan jika pelanggan member ("Ya") ATAU belanja minimal 500.000. Selain itu diskon 0. Isi D2 sampai D5 dengan IF dan OR.',
    hints: [
      'OR benar bila salah satu syarat benar.',
      'Syarat member: B2="Ya" (teks dalam kutip). Syarat belanja: C2>=500000.',
      '=IF(OR(B2="Ya",C2>=500000),C2*0.1,0)',
    ],
    explanation:
      'Ani member (diskon 20.000), Beni belanja besar (60.000), Citra tidak memenuhi keduanya (0), Dedi memenuhi keduanya (70.000, tetap 10%).',
    lessonSlug: 'and-or-if-bertingkat',
    validation: {
      targets: ['D2', 'D3', 'D4', 'D5'].map((c, i) => ({
        cell: c,
        solution: `=IF(OR(B${i + 2}="Ya",C${i + 2}>=500000),C${i + 2}*0.1,0)`,
        requireFunction: 'OR',
      })),
      variants: [{ B3: 'Ya' }, { C2: '900000', B4: 'Ya' }, { B5: 'Tidak', C5: '100' }],
    },
  },
  {
    slug: 'grade-bertingkat',
    title: 'Grade A, B, atau C',
    description: 'Susun IF di dalam IF untuk tiga hasil.',
    topic: 'logika',
    difficulty: 'sulit',
    rows: 8,
    cols: 4,
    cells: g([
      ['Siswa', 'Nilai', 'Grade'],
      ['Ani', 92],
      ['Beni', 78],
      ['Citra', 65],
      ['Dedi', 85],
      ['Eka', 70],
    ]),
    editable: ['C2:C6'],
    task: 'Grade "A" untuk nilai minimal 85, "B" untuk minimal 70, selain itu "C". Isi C2 sampai C6 dengan IF bertingkat (IF di dalam IF).',
    hints: [
      'Periksa syarat paling ketat lebih dulu: >=85.',
      'Jika syarat pertama salah, IF kedua memeriksa >=70.',
      '=IF(B2>=85,"A",IF(B2>=70,"B","C"))',
    ],
    explanation:
      'Dedi (85) dan Eka (70) tepat di batas dan masuk kategori atas (>=). Bila urutan dibalik dan >=70 diperiksa lebih dulu, nilai 92 ikut menjadi "B".',
    lessonSlug: 'and-or-if-bertingkat',
    validation: {
      targets: ['C2', 'C3', 'C4', 'C5', 'C6'].map((c, i) => ({
        cell: c,
        solution: `=IF(B${i + 2}>=85,"A",IF(B${i + 2}>=70,"B","C"))`,
        requireFunction: 'IF',
      })),
      requirePatterns: [
        { pattern: 'IF\\(.*IF\\(', message: 'Latihan ini meminta IF bertingkat: taruh IF kedua di posisi "jika salah" dari IF pertama.' },
      ],
      variants: [
        { B2: '60', B3: '88' },
        { B4: '70', B5: '84', B6: '85' },
      ],
    },
  },
  {
    slug: 'harga-per-unit',
    title: 'Harga per unit tanpa galat',
    description: 'Bungkus pembagian dengan IFERROR.',
    topic: 'logika',
    difficulty: 'sedang',
    rows: 7,
    cols: 5,
    cells: g([
      ['Produk', 'Total', 'Unit', 'Per unit'],
      ['Pulpen', 50000, 10],
      ['Buku', 30000, 0],
      ['Spidol', 45000, 5],
    ]),
    editable: ['D2:D4'],
    task: 'Isi D2 sampai D4 dengan total ÷ unit. Jika galat (misalnya unit 0), tampilkan tanda "-". Pakai IFERROR.',
    hints: ['Mulai dengan rumus pembagian biasa: B2/C2.', 'Bungkus dengan IFERROR(…, "-").', '=IFERROR(B2/C2,"-")'],
    explanation:
      'Buku memiliki unit 0 sehingga B3/C3 menghasilkan #DIV/0!. IFERROR menggantinya dengan "-". Hati-hati: IFERROR juga menutupi galat lain, jadi pakai seperlunya.',
    lessonSlug: 'fungsi-iferror',
    validation: {
      targets: ['D2', 'D3', 'D4'].map((c, i) => ({ cell: c, solution: `=IFERROR(B${i + 2}/C${i + 2},"-")`, requireFunction: 'IFERROR' })),
      variants: [{ C2: '0' }, { C4: '0', C3: '3' }],
    },
  },
  {
    slug: 'rata-rata-kelas-kosong',
    title: 'Rata-rata kelas yang belum ada nilai',
    description: 'Gunakan IFERROR untuk rentang yang belum terisi.',
    topic: 'logika',
    difficulty: 'sedang',
    rows: 7,
    cols: 4,
    cells: g([['Siswa', 'Nilai'], ['Ani', ''], ['Beni', ''], ['Citra', ''], ['', ''], ['Rata-rata kelas']]),
    editable: ['B6'],
    task: 'Hitung rata-rata nilai di B6 dengan AVERAGE atas B2:B4. Karena belum ada nilai, tampilkan "Belum ada nilai" alih-alih galat. Pakai IFERROR.',
    hints: ['AVERAGE tanpa angka menghasilkan #DIV/0!.', 'Bungkus AVERAGE dengan IFERROR.', '=IFERROR(AVERAGE(B2:B4),"Belum ada nilai")'],
    explanation:
      'Selama B2:B4 kosong, AVERAGE menghasilkan #DIV/0! sehingga IFERROR menampilkan teks pengganti. Begitu nilai diisi, rata-rata muncul otomatis.',
    lessonSlug: 'fungsi-iferror',
    validation: {
      targets: [{ cell: 'B6', solution: '=IFERROR(AVERAGE(B2:B4),"Belum ada nilai")', requireFunction: 'IFERROR' }],
      variants: [{ B2: '80', B3: '90' }, { B4: '75' }],
    },
  },
  {
    slug: 'jumlah-lunas',
    title: 'Hitung transaksi lunas',
    description: 'COUNTIF dengan satu kriteria teks.',
    topic: 'fungsi-bersyarat',
    difficulty: 'mudah',
    rows: 11,
    cols: 4,
    cells: g([
      ['Pelanggan', 'Total', 'Status'],
      ['Ani', 50000, 'Lunas'],
      ['Beni', 70000, 'Belum'],
      ['Citra', 30000, 'Lunas'],
      ['Dedi', 90000, 'Lunas'],
      ['Eka', 45000, 'Belum'],
      ['Fajar', 60000, 'Lunas'],
      ['Gita', 20000, 'Belum'],
      ['', ''],
      ['Jumlah lunas'],
    ]),
    editable: ['B10'],
    task: 'Isi B10 dengan rumus yang menghitung berapa transaksi berstatus "Lunas" di C2:C8 memakai COUNTIF.',
    hints: [
      'COUNTIF(rentang, kriteria): rentang dulu, lalu syarat.',
      'Kriteria teks ditulis dalam kutip: "Lunas".',
      '=COUNTIF(C2:C8,"Lunas")',
    ],
    explanation: 'Ada 4 transaksi Lunas. COUNTIF tidak peka huruf besar-kecil, jadi "lunas" juga akan terhitung.',
    lessonSlug: 'countif-countifs',
    validation: {
      targets: [{ cell: 'B10', solution: '=COUNTIF(C2:C8,"Lunas")', requireFunction: 'COUNTIF' }],
      variants: [{ C3: 'Lunas' }, { C2: 'Belum', C4: 'Belum' }],
    },
  },
  {
    slug: 'lunas-dan-besar',
    title: 'Lunas dan nominal besar',
    description: 'COUNTIFS dengan dua kriteria sekaligus.',
    topic: 'fungsi-bersyarat',
    difficulty: 'sulit',
    rows: 11,
    cols: 4,
    cells: g([
      ['Pelanggan', 'Total', 'Status'],
      ['Ani', 50000, 'Lunas'],
      ['Beni', 70000, 'Belum'],
      ['Citra', 30000, 'Lunas'],
      ['Dedi', 90000, 'Lunas'],
      ['Eka', 45000, 'Belum'],
      ['Fajar', 60000, 'Lunas'],
      ['Gita', 20000, 'Belum'],
      ['', ''],
      ['Lunas & total ≥ 50.000'],
    ]),
    editable: ['B10'],
    task: 'Isi B10 dengan jumlah transaksi yang berstatus "Lunas" DAN totalnya minimal 50000. Pakai COUNTIFS.',
    hints: [
      'COUNTIFS menerima pasangan (rentang, kriteria) sebanyak yang diperlukan.',
      'Pasangan 1: C2:C8 dengan "Lunas". Pasangan 2: B2:B8 dengan ">=50000".',
      '=COUNTIFS(C2:C8,"Lunas",B2:B8,">=50000")',
    ],
    explanation:
      'Baris yang memenuhi keduanya: Ani (50.000), Dedi (90.000), dan Fajar (60.000) = 3. Perbandingan seperti >= ditulis sebagai teks dalam kutip.',
    lessonSlug: 'countif-countifs',
    validation: {
      targets: [{ cell: 'B10', solution: '=COUNTIFS(C2:C8,"Lunas",B2:B8,">=50000")', requireFunction: 'COUNTIFS' }],
      variants: [{ B3: '40000', C3: 'Lunas' }, { B4: '55000' }, { C2: 'Belum' }],
    },
  },
  {
    slug: 'total-per-kategori',
    title: 'Total penjualan kategori Makanan',
    description: 'SUMIF: jumlahkan hanya baris yang cocok.',
    topic: 'fungsi-bersyarat',
    difficulty: 'sedang',
    rows: 11,
    cols: 5,
    cells: g([
      ['Kategori', 'Produk', 'Penjualan', 'Kota'],
      ['Makanan', 'Beras', 300000, 'Jakarta'],
      ['Minuman', 'Teh', 120000, 'Bandung'],
      ['Makanan', 'Mie', 80000, 'Bandung'],
      ['Minuman', 'Kopi', 150000, 'Jakarta'],
      ['Makanan', 'Roti', 90000, 'Jakarta'],
      ['Minuman', 'Susu', 110000, 'Bandung'],
      ['Makanan', 'Gula', 70000, 'Jakarta'],
      ['', ''],
      ['', 'Total Makanan'],
    ]),
    editable: ['C10'],
    task: 'Isi C10 dengan total Penjualan (C2:C8) untuk baris berkategori "Makanan" (A2:A8) memakai SUMIF.',
    hints: [
      'Urutan SUMIF: rentang kriteria, kriteria, rentang yang dijumlahkan.',
      'Rentang kriteria A2:A8, kriteria "Makanan", rentang jumlah C2:C8.',
      '=SUMIF(A2:A8,"Makanan",C2:C8)',
    ],
    explanation: 'Baris Makanan: 300.000 + 80.000 + 90.000 + 70.000 = 540.000. Perhatikan SUMIF menaruh rentang jumlah di argumen ketiga.',
    lessonSlug: 'sumif-sumifs',
    validation: {
      targets: [{ cell: 'C10', solution: '=SUMIF(A2:A8,"Makanan",C2:C8)', requireFunction: 'SUMIF' }],
      variants: [{ A3: 'Makanan' }, { C2: '100000', A4: 'Minuman' }],
    },
  },
  {
    slug: 'makanan-di-jakarta',
    title: 'Makanan yang terjual di Jakarta',
    description: 'SUMIFS dengan dua syarat; rentang jumlah ditulis pertama.',
    topic: 'fungsi-bersyarat',
    difficulty: 'sulit',
    rows: 11,
    cols: 5,
    cells: g([
      ['Kategori', 'Produk', 'Penjualan', 'Kota'],
      ['Makanan', 'Beras', 300000, 'Jakarta'],
      ['Minuman', 'Teh', 120000, 'Bandung'],
      ['Makanan', 'Mie', 80000, 'Bandung'],
      ['Minuman', 'Kopi', 150000, 'Jakarta'],
      ['Makanan', 'Roti', 90000, 'Jakarta'],
      ['Minuman', 'Susu', 110000, 'Bandung'],
      ['Makanan', 'Gula', 70000, 'Jakarta'],
      ['', ''],
      ['', 'Makanan di Jakarta'],
    ]),
    editable: ['C10'],
    task: 'Isi C10 dengan total Penjualan untuk kategori "Makanan" DAN kota "Jakarta" memakai SUMIFS.',
    hints: [
      'Pada SUMIFS, argumen pertama adalah rentang yang dijumlahkan.',
      'Lalu pasangan (A2:A8, "Makanan") dan (D2:D8, "Jakarta").',
      '=SUMIFS(C2:C8,A2:A8,"Makanan",D2:D8,"Jakarta")',
    ],
    explanation: 'Baris yang cocok: Beras (300.000), Roti (90.000), Gula (70.000) = 460.000. Mie dijual di Bandung sehingga tidak ikut.',
    lessonSlug: 'sumif-sumifs',
    validation: {
      targets: [{ cell: 'C10', solution: '=SUMIFS(C2:C8,A2:A8,"Makanan",D2:D8,"Jakarta")', requireFunction: 'SUMIFS' }],
      variants: [
        { D3: 'Jakarta', A3: 'Makanan' },
        { C2: '1', D6: 'Bandung' },
      ],
    },
  },
];

export const exercises: ExerciseDef[] = specs.map((s, i) => ({
  ...s,
  points: POINTS[s.difficulty],
  sortOrder: i + 1,
}));
