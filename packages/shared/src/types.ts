export type Difficulty = 'mudah' | 'sedang' | 'sulit';

export interface ModuleDef {
  slug: string;
  title: string;
  summary: string;
  sortOrder: number;
  published?: boolean;
}

export interface LessonContent {
  objectives: string[];
  sections: { heading: string; paragraphs: string[] }[];
  syntax?: { signature: string; params: { name: string; description: string }[]; notes?: string[] };
  example: {
    title: string;
    description: string;
    /** Baris pertama adalah header. */
    table: (string | number)[][];
    formula: string;
    result: string;
    walkthrough: string;
  };
  mistakes: { title: string; detail: string }[];
  /** Catatan perbedaan Excel asli dan playground Mahir Excel. */
  playgroundNote?: string;
  quiz: { question: string; options: string[]; answerIndex: number; explanation: string }[];
}

export interface LessonDef {
  slug: string;
  moduleSlug: string;
  title: string;
  summary: string;
  minutes: number;
  sortOrder: number;
  published?: boolean;
  content: LessonContent;
}

export interface TargetDef {
  cell: string;
  /** Jawaban acuan: diawali "=" berarti rumus, selain itu nilai literal. Tidak pernah dikirim ke browser sebelum submit. */
  solution: string;
  /** Jika diisi, rumus pengguna wajib memakai fungsi ini. */
  requireFunction?: string;
  /** Perbandingan teks persis (peka huruf besar/kecil dan spasi). */
  exactText?: boolean;
}

export interface ValidationDef {
  targets: TargetDef[];
  /** Pola regex yang wajib ada pada teks rumus pengguna. */
  /** `cells` (opsional) membatasi pola hanya pada sel target tertentu (mendukung rentang seperti C2:C5). */
  requirePatterns?: { pattern: string; message: string; cells?: string[] }[];
  /** Pesan khusus untuk kesalahan umum: dicek bila hasil tidak cocok. */
  rules?: { pattern: string; message: string }[];
  /** Perubahan data untuk menguji bahwa rumus benar-benar mengikuti data. */
  variants?: Record<string, string>[];
  /** Toleransi mutlak perbandingan angka. */
  tolerance?: number;
  /** Default true bila solusi berupa rumus. */
  requireFormula?: boolean;
}

/** Alat bantu playground. Baris pertama rentang adalah judul kolom. */
export interface ExerciseTools {
  sort?: { range: string };
  filter?: { range: string };
}

export interface ExerciseDef {
  slug: string;
  title: string;
  description: string;
  /** Slug modul. */
  topic: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  cells: Record<string, string>;
  /** Sel yang boleh diubah pengguna. */
  editable: string[];
  task: string;
  hints: string[];
  explanation: string;
  points: number;
  lessonSlug?: string;
  sortOrder: number;
  published?: boolean;
  tools?: ExerciseTools;
  validation: ValidationDef;
}

/** Bentuk latihan yang aman dikirim ke browser (tanpa kunci jawaban). */
export interface PublicExercise {
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
  points: number;
  lessonSlug: string | null;
  targetCells: string[];
  tools: ExerciseTools | null;
}

export type ShortcutPlatform = 'windows' | 'mac' | 'both';
export type ShortcutCategory = 'navigasi' | 'edit-sel' | 'format' | 'seleksi' | 'data' | 'rumus' | 'lembar-kerja';

export interface ShortcutDef {
  slug: string;
  action: string;
  /** Kombinasi tombol Windows, dipisah " + " (mis. "Ctrl + Shift + L"). */
  keysWindows: string | null;
  /** Kombinasi tombol Mac. */
  keysMac: string | null;
  category: ShortcutCategory;
  explanation: string;
  example?: string;
  /** Status verifikasi / catatan sumber internal. */
  verification: string;
  published?: boolean;
}

export interface WorksheetDef {
  slug: string;
  title: string;
  description: string;
  objective: string;
  difficulty: Difficulty;
  skills: string[];
  instructions: string[];
  sortOrder: number;
  published?: boolean;
}

export interface CheckResult {
  correct: boolean;
  message: string;
  targets: { cell: string; ok: boolean; message: string }[];
}

/** Struktur progres lokal anonim (disimpan di localStorage) dan format sinkronisasi. */
export interface ProgressSnapshot {
  version: 1;
  completedLessons: string[];
  exercises: Record<string, { completedAt: string; attempts: number; points?: number }>;
  /** Jawaban salah terakhir per latihan untuk fitur tinjau. */
  reviews: Record<string, { at: string; message: string }>;
  /** Tanggal aktif (YYYY-MM-DD). */
  activeDays: string[];
  /** Jadwal ulang latihan yang pernah salah: box 0-5 dan waktu jatuh tempo (ISO). */
  schedule?: Record<string, { box: number; dueAt: string }>;
}

export interface ReviewDueItem {
  slug: string;
  title: string;
  topic: string;
  box: number;
  dueAt: string;
}

/** Progres milik pengguna terdaftar, sebagaimana dikembalikan API (server menjadi sumber kebenaran). */
export interface ProgressView {
  completedLessons: string[];
  exercises: Record<string, { completedAt: string; attempts: number; points: number }>;
  reviews: Record<string, { at: string; message: string }>;
  activeDays: string[];
  totalPoints: number;
  streak: { current: number; longest: number };
}
