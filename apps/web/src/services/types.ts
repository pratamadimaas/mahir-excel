import type { Difficulty, LessonContent, PublicExercise, ShortcutCategory } from '@excellab/shared';

export type { Difficulty, LessonContent, PublicExercise, ShortcutCategory };

export interface LessonBrief {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  sortOrder: number;
  exerciseCount: number;
}

export interface ModuleSummary {
  slug: string;
  title: string;
  summary: string;
  sortOrder: number;
  lessons: LessonBrief[];
}

export interface ExerciseSummary {
  slug: string;
  title: string;
  description: string;
  topic: string;
  difficulty: Difficulty;
  points: number;
  lessonSlug: string | null;
}

export interface LessonDetail {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  published: boolean;
  module: { slug: string; title: string };
  siblings: { slug: string; title: string }[];
  content: LessonContent;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  exercises: ExerciseSummary[];
}

export interface ShortcutView {
  id: number;
  slug: string;
  action: string;
  keysWindows: string | null;
  keysMac: string | null;
  category: ShortcutCategory;
  explanation: string;
  example?: string;
  verification: string;
}

export interface WorksheetView {
  slug: string;
  title: string;
  description: string;
  objective: string;
  difficulty: Difficulty;
  skills: string[];
  instructions: string[];
  /** Hanya bisa diunduh anggota Premium. */
  premiumOnly: boolean;
  fileType: string;
  fileSize: number | null;
  available: boolean;
  keyAvailable: boolean;
  keySize: number | null;
  preview?: { sheet: string; rows: string[][] } | null;
}

export interface SubmitResult {
  correct: boolean;
  message: string;
  targets: { cell: string; ok: boolean; message: string }[];
  pointsAwarded: number;
  alreadyCompleted: boolean;
  totalPoints?: number;
  explanation?: string;
  solution?: Record<string, string>;
}

export interface RevealResult {
  explanation: string;
  solution: Record<string, string>;
  pointsAwarded: number;
  /** Solusi dibuka dari jatah gratis mingguan (bukan Premium). */
  free?: boolean;
  nextFreeAt?: string | null;
}

/** Jatah solusi gratis: satu solusi baru setiap 7 hari untuk akun gratis. */
export interface SolutionQuota {
  premium: boolean;
  available: boolean;
  nextFreeAt: string | null;
  /** Slug latihan yang solusinya pernah dibuka lewat jatah gratis; membukanya lagi tidak memakai jatah. */
  unlocked: string[];
}

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  emailVerified?: boolean;
  premium?: boolean;
  premiumUntil?: string | null;
}

export interface ChallengeToday {
  date: string;
  exercise: PublicExercise;
}

export const TOPIC_LABELS: Record<string, string> = {
  'mengenal-excel': 'Mengenal Excel',
  'mengolah-data': 'Mengolah Data',
  'rumus-dasar': 'Rumus Dasar',
  logika: 'Logika',
  'fungsi-bersyarat': 'Fungsi Bersyarat',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' };
export const DIFFICULTY_LEVEL: Record<Difficulty, number> = { mudah: 1, sedang: 2, sulit: 3 };

export function formatBytes(n: number | null): string {
  if (n === null) return '-';
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(n < 10240 ? 1 : 0).replace('.', ',')} KB`;
}

export interface ProgramRequirement {
  key: 'placement' | 'sprint' | 'exercises';
  label: string;
  done: boolean;
  progress?: { have: number; need: number };
  to: string;
}

/** Status Program Perintis. Bagian pengguna (requirements, eligible, claim) hanya ada saat sudah masuk akun. */
export interface ProgramStatus {
  enabled: boolean;
  open: boolean;
  quota: number;
  taken: number;
  remaining: number;
  minExercises: number;
  requirements?: ProgramRequirement[];
  eligible?: boolean;
  claim?: { slot: number; code: string; claimedAt: string } | null;
}
