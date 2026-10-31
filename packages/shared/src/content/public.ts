/**
 * Pelajaran contoh yang terbuka tanpa login (etalase). Pelajaran lain, latihan, shortcut, dan worksheet tetap
 * memerlukan akun. Slug harus ada di kurikulum; dicek oleh content.test.ts.
 */
export const PUBLIC_LESSON_SLUGS: readonly string[] = [
  'sel-baris-kolom-rentang',
  'fungsi-sum',
  'fungsi-if',
  'countif-countifs',
  'vlookup-dasar',
];

export const isPublicLesson = (slug: string): boolean => PUBLIC_LESSON_SLUGS.includes(slug);

/**
 * Worksheet yang bisa diunduh akun gratis: semuanya. Yang khusus Premium: kunci jawaban dan pemeriksaan berkas yang diunggah.
 * Slug harus ada di worksheets.ts; dicek oleh content.test.ts.
 */
export const FREE_WORKSHEET_SLUGS: readonly string[] = [
  'anggaran-bulanan',
  'rekap-penjualan',
  'stok-barang',
  'absensi-karyawan',
  'rekap-nilai-siswa',
  'latihan-if',
  'latihan-sumif-countif',
  'latihan-lookup',
  'latihan-merapikan-data',
  'laporan-penjualan-mini',
  'gaji-lembur',
];

export const isFreeWorksheet = (slug: string): boolean => FREE_WORKSHEET_SLUGS.includes(slug);
