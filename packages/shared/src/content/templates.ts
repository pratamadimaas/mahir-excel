export type TemplateCategory = 'Usaha' | 'Keuangan' | 'Acara' | 'Proyek';

export interface TemplateDef {
  slug: string;
  title: string;
  description: string;
  category: TemplateCategory;
  /** Bisa diunduh akun gratis. Template lain khusus Premium. */
  free: boolean;
  forWho: string;
  /** Nama sheet di dalam berkas, sama dengan hasil buatan apps/api/src/templates. */
  sheets: string[];
  /** Fungsi yang dipakai, supaya pengguna tahu apa yang bisa dipelajari dari berkasnya. */
  formulas: string[];
  /** Catatan jujur yang tampil di halaman template. */
  note?: string;
}

/** Katalog template .xlsx. Isi berkas dibuat oleh apps/api/src/templates/builders.ts dengan slug yang sama. */
export const templates: TemplateDef[] = [
  {
    slug: 'laporan-penjualan',
    title: 'Laporan Penjualan Harian dan Bulanan',
    description: 'Catat penjualan tiap hari, rekap per bulan dan per produk otomatis.',
    category: 'Usaha',
    free: true,
    forWho: 'Pemilik warung, toko online, atau usaha kecil yang ingin tahu penjualan bulan ini tanpa menghitung manual.',
    sheets: ['Cara pakai', 'Produk', 'Penjualan', 'Rekap'],
    formulas: ['VLOOKUP', 'SUMIFS', 'COUNTIFS', 'IFERROR'],
  },
  {
    slug: 'keuangan-pribadi',
    title: 'Keuangan Pribadi Bulanan',
    description: 'Catat uang masuk dan keluar, bandingkan dengan anggaran tiap kategori.',
    category: 'Keuangan',
    free: true,
    forWho: 'Siapa saja yang ingin tahu uangnya habis ke mana dan berapa yang bisa ditabung bulan ini.',
    sheets: ['Cara pakai', 'Kategori', 'Transaksi', 'Ringkasan'],
    formulas: ['SUMIF', 'COUNTIF', 'IF', 'SUM'],
  },
  {
    slug: 'stok-barang',
    title: 'Stok Barang Masuk, Keluar, dan Sisa',
    description: 'Daftar barang dengan stok sekarang yang dihitung dari catatan masuk dan keluar, plus penanda saat stok menipis.',
    category: 'Usaha',
    free: false,
    forWho: 'Toko atau gudang kecil yang ingin tahu kapan harus memesan barang lagi.',
    sheets: ['Cara pakai', 'Barang', 'Masuk', 'Keluar'],
    formulas: ['SUMIF', 'INDEX', 'MATCH', 'IF', 'COUNTIF'],
  },
  {
    slug: 'invoice-piutang',
    title: 'Invoice dan Rekap Piutang',
    description: 'Invoice siap cetak, daftar tagihan, dan status lunas atau terlambat yang dihitung dari tanggal hari ini.',
    category: 'Usaha',
    free: false,
    forWho: 'Freelancer atau usaha jasa yang menagih pelanggan dan perlu tahu siapa yang belum membayar.',
    sheets: ['Cara pakai', 'Invoice', 'Daftar', 'Pembayaran'],
    formulas: ['SUMIF', 'COUNTIF', 'TODAY', 'IF', 'SUM'],
  },
  {
    slug: 'anggaran-pernikahan',
    title: 'Anggaran Pernikahan',
    description: 'Estimasi dan realisasi tiap vendor, pembayaran DP dan pelunasan, sisa tagihan, dan sisa dana.',
    category: 'Acara',
    free: false,
    forWho: 'Pasangan yang menyiapkan pernikahan dan ingin biaya tetap terkendali.',
    sheets: ['Cara pakai', 'Anggaran', 'Pembayaran', 'Ringkasan'],
    formulas: ['SUMIF', 'IF', 'SUM'],
  },
  {
    slug: 'rab-sederhana',
    title: 'RAB Sederhana (Renovasi atau Proyek Kecil)',
    description: 'Volume kali harga satuan, subtotal per kelompok pekerjaan, overhead dan pajak sampai total.',
    category: 'Proyek',
    free: false,
    forWho: 'Pemilik rumah atau tukang yang menyusun perkiraan biaya renovasi atau proyek kecil.',
    sheets: ['Cara pakai', 'Harga satuan', 'RAB', 'Rekap'],
    formulas: ['VLOOKUP', 'IFERROR', 'SUMIF', 'ROUND', 'SUM'],
    note: 'Ini perkiraan untuk keperluan pribadi, bukan RAB untuk tender resmi. Ganti harga satuan contoh dengan harga di daerahmu.',
  },
];

export const isFreeTemplate = (slug: string): boolean => templates.find((t) => t.slug === slug)?.free ?? false;
