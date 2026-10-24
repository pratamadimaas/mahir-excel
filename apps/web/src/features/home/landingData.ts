/**
 * Data untuk beranda pengunjung. Semua contoh di sini dijalankan oleh mesin rumus sungguhan
 * dan dicek oleh landing.test.tsx, jadi klaim "hasilnya begini" tidak bisa basi diam-diam.
 */

export type Row = (string | number)[];

export interface ErrorCase {
  id: string;
  tab: string;
  title: string;
  /** Sel yang dipilih saat tampil, tempat masalah terlihat. */
  selected: string;
  broken: Row[];
  fixed: Row[];
  /** Tampilan sel `selected` di tabel rusak dan tabel perbaikan (dicek tes terhadap mesin rumus). */
  brokenShows: string;
  fixedShows: string;
  cause: string;
  fix: string;
}

const pengeluaran = (total: string): Row[] => [
  ['Pos', 'Biaya'],
  ['Makan', 350000],
  ['Transport', 120000],
  ['Pulsa', 50000],
  ['Listrik', 200000],
  ['Total', total],
];

const nilai = (nama3: string, kolom: number): Row[] => [
  ['Nama', 'Nilai', '', 'Cari', 'Hasil'],
  ['Budi', 80, '', 'Sari', `=VLOOKUP(D2;A2:B4;${kolom};FALSE)`],
  [nama3, 90, '', '', ''],
  ['Dewi', 75, '', '', ''],
];

const pajak = (c3: string, c4: string): Row[] => [
  ['Barang', 'Harga', 'Pajak', 'Tarif', 0.1],
  ['Beras', 15000, '=B2*E1', '', ''],
  ['Gula', 14000, c3, '', ''],
  ['Minyak', 18000, c4, '', ''],
];

export const ERROR_CASES: ErrorCase[] = [
  {
    id: 'total-kurang',
    tab: 'Total kurang',
    title: 'Total lebih kecil dari seharusnya',
    selected: 'B6',
    broken: pengeluaran('=SUM(B2:B4)'),
    fixed: pengeluaran('=SUM(B2:B5)'),
    brokenShows: '520.000',
    fixedShows: '720.000',
    cause: 'Rentang SUM berhenti di B4, padahal data sampai B5. Satu baris terlewat, dan Excel tidak memberi peringatan apa pun.',
    fix: 'Perluas rentangnya menjadi B2:B5. Setelah menulis rumus, biasakan memeriksa batas awal dan akhir rentang.',
  },
  {
    id: 'na-spasi',
    tab: '#N/A',
    title: 'VLOOKUP tidak menemukan nama yang jelas ada',
    selected: 'E2',
    broken: nilai('Sari ', 2),
    fixed: nilai('Sari', 2),
    brokenShows: '#N/A',
    fixedShows: '90',
    cause: 'Sel A3 berisi "Sari" dengan satu spasi di belakangnya. Mata tidak melihatnya, tetapi VLOOKUP membandingkan huruf per huruf.',
    fix: 'Hapus spasi berlebih. Untuk data banyak, TRIM membuang spasi tak terlihat sebelum dicocokkan.',
  },
  {
    id: 'ref-kolom',
    tab: '#REF!',
    title: 'Nomor kolom melebihi tabel',
    selected: 'E2',
    broken: nilai('Sari', 3),
    fixed: nilai('Sari', 2),
    brokenShows: '#REF!',
    fixedShows: '90',
    cause: 'Tabel A2:B4 hanya punya dua kolom, tetapi rumus meminta kolom ke-3.',
    fix: 'Ganti angka 3 menjadi 2, atau perluas tabelnya bila memang ada kolom ketiga.',
  },
  {
    id: 'salin-bergeser',
    tab: 'Hasil jadi 0',
    title: 'Rumus disalin ke bawah, pajaknya hilang',
    selected: 'C3',
    broken: pajak('=B3*E2', '=B4*E3'),
    fixed: pajak('=B3*$E$1', '=B4*$E$1'),
    brokenShows: '0',
    fixedShows: '1400',
    cause: 'Di C3 rumusnya menjadi =B3*E2. Tarif di E1 ikut bergeser ke bawah dan sekarang menunjuk sel kosong.',
    fix: 'Kunci tarifnya dengan $E$1 agar tidak bergeser saat rumus disalin. Tombol F4 mengganti jenis referensi.',
  },
];

/** Contoh latihan "Try it": hitung total di B6. */
export const TRY_TABLE = (formula: string): Row[] => [
  ['Kas kecil', 'Biaya'],
  ['Parkir', 25000],
  ['Fotokopi', 45000],
  ['Konsumsi', 150000],
  ['ATK', 80000],
  ['Total', formula],
];
export const TRY_EXPECTED = 300000;

/** Hasil nyata tiap modul, dalam kalimat sehari-hari. Dicek tes agar setiap modul punya satu. */
export const MODULE_OUTCOMES: Record<string, string> = {
  'mengenal-excel': 'Memahami workbook, sel, dan rentang, lalu memasukkan data dengan format yang benar.',
  'mengolah-data': 'Merapikan tabel yang berantakan: urutkan, saring, dan temukan data yang tidak konsisten.',
  'rumus-dasar': 'Menjumlahkan dan merata-ratakan data dengan rumus, bukan kalkulator.',
  logika: 'Membuat Excel mengambil keputusan, misalnya lulus atau remedial, lunas atau belum.',
  'fungsi-bersyarat': 'Meringkas data per kategori, misalnya total penjualan per cabang.',
  'fungsi-pencarian': 'Mengambil harga atau nama dari tabel acuan tanpa mengetik ulang.',
  'teks-tanggal': 'Merapikan nama dan kode, dan menghitung dengan tanggal seperti jatuh tempo.',
  'rapi-dan-aman': 'Mencegah salah input, menyorot data penting otomatis, dan meringkas data.',
};

export const AUDIENCE: { title: string; text: string }[] = [
  {
    title: 'Pemula yang masih takut Excel',
    text: 'Mulai dari sel dan rentang, tanpa istilah yang melompat. Tes penempatan membantu memilih titik awal.',
  },
  {
    title: 'Pekerja kantor yang rumusnya masih tebak-tebakan',
    text: 'Fungsi yang dipakai sehari-hari, dari SUM dan IF sampai VLOOKUP dan XLOOKUP, dengan latihan yang menunjukkan kenapa hasilnya salah.',
  },
  {
    title: 'Mahasiswa dan pencari kerja',
    text: 'Butuh bukti belajar untuk CV? Selesaikan materinya dan unduh sertifikat PDF yang keasliannya bisa diperiksa lewat kode.',
  },
];

/** Tiga percobaan nyata di latihan "Total pengeluaran bulanan" (pesan persis dari validator, dicek tes). */
export interface FeedbackStep {
  formula: string;
  ok: boolean;
  message: string;
  note?: string;
}

export const FEEDBACK_STEPS: FeedbackStep[] = [
  {
    formula: '=SUM(B2:B5)',
    ok: false,
    message:
      'Sel B7 menghasilkan 720.000, tetapi itu belum sesuai dengan yang diminta. Periksa kembali rentang sel, operator, dan apakah ada sel yang terlewat.',
  },
  {
    formula: '=1020000',
    ok: false,
    message: 'Latihan ini melatih fungsi SUM. Hasilmu mungkin bisa sama, tetapi coba gunakan fungsi tersebut di sel B7.',
    note: 'Angka yang diketik langsung ditolak, walau hasilnya sama.',
  },
  {
    formula: '=SUM(B2:B6)',
    ok: true,
    message: 'Sel B7 benar.',
    note: '+10 poin, dan solusi beserta penjelasannya terbuka.',
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const faqs = (functions: number | null): Faq[] => [
  {
    q: 'Benar-benar gratis?',
    a: 'Untuk belajar, ya. Semua pelajaran, latihan, shortcut, jalur belajar, 2 template, dan 3 worksheet pertama gratis. Premium menambah solusi langsung tanpa batas di latihan, 4 template dan 7 worksheet lanjutan beserta kunci jawabannya, penelusur rumus, wizard rumus lengkap, laporan kemajuan, contekan PDF, dan sertifikat PDF.',
  },
  {
    q: 'Kenapa harus daftar dulu?',
    a: 'Supaya poin, progres, dan jadwal ulang tersimpan dan bisa dilanjutkan dari perangkat mana pun. Lima pelajaran contoh dan tes penempatan tetap bisa dibuka tanpa akun.',
  },
  {
    q: 'Perlu punya Excel di komputer?',
    a: 'Tidak untuk pelajaran dan latihan, karena semuanya berjalan di browser. Worksheet berformat .xlsx dibuka di Excel atau aplikasi spreadsheet lain yang bisa membuka berkas itu.',
  },
  {
    q: 'Apakah sama persis dengan Excel?',
    a: `Tidak. Playground memakai mesin rumus sendiri${functions ? ` dengan ${functions} fungsi` : ''}, cukup untuk dasar sampai VLOOKUP. Beberapa perilaku Excel asli sengaja tidak ditiru, dan perbedaannya dicatat di halaman Tentang.`,
  },
  {
    q: 'Bisa dipakai lewat HP?',
    a: 'Bisa dibuka dan dibaca di HP. Untuk mengetik rumus, keyboard komputer tetap lebih nyaman.',
  },
  {
    q: 'Data saya dipakai untuk apa?',
    a: 'Untuk menyimpan progres belajarmu. Tidak ada iklan dan tidak ada pelacak pihak ketiga. Rinciannya ada di halaman Privasi.',
  },
];
