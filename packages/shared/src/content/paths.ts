/**
 * Bidang: urutan pelajaran yang dipilih untuk satu tujuan. Isinya hanya daftar slug dari kurikulum yang ada;
 * judul, durasi, dan jumlah latihan dihitung dari pelajaran aslinya (lihat apps/api/src/routes/paths.ts).
 */
export interface PathDef {
  slug: string;
  title: string;
  /** Satu kalimat untuk kartu daftar. */
  tagline: string;
  forWho: string;
  /** Hal yang bisa dikerjakan setelah menyelesaikan bidang. Bukan janji pekerjaan atau gaji. */
  outcomes: string[];
  /** Slug pelajaran, sudah berurutan. */
  lessons: string[];
  /** Slug template .xlsx yang relevan. */
  templates: string[];
  /** Hal Premium yang relevan untuk bidang ini, ditulis apa adanya dan harus benar-benar ada. */
  premiumExtras: string[];
}

export const paths: PathDef[] = [
  {
    slug: 'perkantoran-admin',
    title: 'Admin dan Perkantoran',
    tagline: 'Merapikan data, membuat rekap, dan mencari informasi dari tabel.',
    forWho: 'Kamu sedang melamar atau baru bekerja sebagai admin, dan harus merapikan daftar, membuat rekap, serta mencocokkan data antar tabel.',
    outcomes: [
      'Merapikan daftar yang berantakan: nama, kode, nomor telepon, dan tanggal.',
      'Membuat rekap jumlah dan total per kategori dengan rumus, bukan hitung manual.',
      'Mengambil data dari tabel lain dengan VLOOKUP.',
      'Menghitung jatuh tempo, masa kerja, dan hari kerja.',
    ],
    lessons: [
      'sel-baris-kolom-rentang',
      'referensi-sel-dasar',
      'mengurutkan-menyaring-tabel',
      'data-tidak-konsisten',
      'fungsi-sum',
      'count-counta',
      'referensi-relatif-absolut',
      'fungsi-if',
      'countif-countifs',
      'sumif-sumifs',
      'vlookup-dasar',
      'fungsi-teks',
      'fungsi-tanggal',
      'substitute-find',
      'tanggal-lanjutan',
      'proyek-data-pelanggan',
    ],
    templates: ['laporan-penjualan', 'invoice-piutang'],
    premiumExtras: [
      'Solusi langsung tanpa batas di semua latihan bidang ini.',
      'Penelusur rumus dan wizard rumus lengkap untuk memeriksa rumusmu langkah demi langkah.',
      'Contekan PDF per modul untuk dicetak atau disimpan di HP.',
    ],
  },
  {
    slug: 'admin-hrd',
    title: 'Admin HRD dan Tes Kerja',
    tagline: 'Rumus dan fitur yang biasa diuji untuk admin HRD: absensi, lembur, masa kerja, kontrak.',
    forWho: 'Kamu sedang mempersiapkan tes Excel untuk posisi admin HRD atau personalia, dan ingin berlatih dari data karyawan yang mirip soal sebenarnya.',
    outcomes: [
      'Merapikan data karyawan: baris ganda, sel kosong, dan angka yang tersimpan sebagai teks.',
      'Merekap absensi dan lembur dengan COUNTIF, SUMIF, dan SUBTOTAL yang ikut filter.',
      'Mengambil data karyawan dengan VLOOKUP atau INDEX dan MATCH, serta mencari gaji tertinggi per divisi dengan MAXIFS.',
      'Menghitung masa kerja, tanggal kontrak berakhir, dan hari kerja.',
      'Menyiapkan tabel yang siap cetak, dan merangkum data dengan PivotTable.',
    ],
    lessons: [
      'mengurutkan-menyaring-tabel',
      'data-tidak-konsisten',
      'pemeriksa-data',
      'hapus-duplikat',
      'tabel-ctrl-t',
      'fungsi-sum',
      'referensi-relatif-absolut',
      'fungsi-if',
      'and-or-if-bertingkat',
      'countif-countifs',
      'sumif-sumifs',
      'maxifs-minifs',
      'subtotal-countblank',
      'vlookup-dasar',
      'index-match',
      'fungsi-teks',
      'fungsi-tanggal',
      'tanggal-lanjutan',
      'edate-weekday',
      'pivottable-grafik',
      'siap-cetak',
      'proyek-rekap-gaji',
    ],
    templates: ['invoice-piutang'],
    premiumExtras: [
      'Worksheet Gaji dan Lembur serta Absensi Karyawan (.xlsx) beserta kunci jawabannya.',
      'Solusi langsung tanpa batas di semua latihan bidang ini.',
      'Penelusur rumus untuk melihat di langkah mana sebuah rumus keliru.',
    ],
  },
  {
    slug: 'jualan-usaha',
    title: 'Jualan dan Usaha Kecil',
    tagline: 'Menghitung omzet, stok, dan harga untuk warung, toko, atau usaha online.',
    forWho: 'Kamu berjualan atau mengelola usaha kecil dan ingin tahu penjualan, stok, dan tagihan tanpa menghitung di kalkulator.',
    outcomes: [
      'Menghitung total, rata-rata, dan peringkat penjualan.',
      'Merekap penjualan per kategori dan per kota.',
      'Membulatkan harga dan menghitung kebutuhan kardus atau ongkos kirim.',
      'Mengambil harga dari daftar produk dengan kode.',
    ],
    lessons: [
      'referensi-sel-dasar',
      'fungsi-sum',
      'average-min-max',
      'referensi-relatif-absolut',
      'round-pembulatan',
      'median-large-small-rank',
      'roundup-rounddown',
      'fungsi-if',
      'countif-countifs',
      'sumif-sumifs',
      'averageif-sumproduct',
      'vlookup-dasar',
      'proyek-laporan-penjualan',
      'proyek-katalog-harga',
    ],
    templates: ['laporan-penjualan', 'stok-barang', 'invoice-piutang'],
    premiumExtras: [
      'Template stok barang, invoice, dan rekap piutang yang rumusnya sudah terpasang.',
      'Solusi langsung tanpa batas dan perbandingan jawabanmu dengan solusi.',
      'Laporan kemajuan yang menunjukkan topik yang masih lemah.',
    ],
  },
  {
    slug: 'keuangan-dasar',
    title: 'Keuangan dan Akuntansi Dasar',
    tagline: 'Rumus untuk anggaran, rekap transaksi, dan pencocokan data keuangan.',
    forWho: 'Kamu belajar akuntansi atau ingin bekerja di bagian keuangan, dan butuh Excel untuk mencatat, merekap, dan memeriksa angka.',
    outcomes: [
      'Menyusun anggaran dan menghitung sisa dengan rumus yang aman disalin.',
      'Merekap transaksi per kategori dan membandingkannya dengan anggaran.',
      'Mencocokkan dua daftar dengan VLOOKUP atau INDEX dan MATCH.',
      'Menangani galat dan menghitung tanggal jatuh tempo.',
    ],
    lessons: [
      'referensi-sel-dasar',
      'fungsi-sum',
      'referensi-relatif-absolut',
      'round-pembulatan',
      'fungsi-if',
      'and-or-if-bertingkat',
      'fungsi-iferror',
      'countif-countifs',
      'sumif-sumifs',
      'vlookup-dasar',
      'index-match',
      'fungsi-tanggal',
      'tanggal-lanjutan',
      'pivottable-grafik',
      'proyek-rekap-gaji',
    ],
    templates: ['keuangan-pribadi', 'invoice-piutang'],
    premiumExtras: [
      'Template invoice dan rekap piutang, dan anggaran pernikahan untuk contoh anggaran vendor.',
      'Penelusur rumus untuk melihat di langkah mana sebuah rumus keliru.',
      'Contekan PDF per modul dan laporan kemajuan pribadi.',
    ],
  },
];

export const pathBySlug = (slug: string): PathDef | undefined => paths.find((p) => p.slug === slug);
