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
