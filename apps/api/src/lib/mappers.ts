import type { ExerciseDef, ExerciseTools, ShortcutDef, WorksheetDef, ShortcutCategory, Difficulty, ValidationDef } from '@excellab/shared';

export interface ExerciseRow {
  id: number;
  lesson_id: number | null;
  lesson_slug: string | null;
  topic: string;
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  points: number;
  rows_count: number;
  cols_count: number;
  cells: Record<string, string>;
  editable: string[];
  task: string;
  hints: string[];
  explanation: string;
  validation: ValidationDef;
  tools: ExerciseTools | string | null;
  sort_order: number;
  published: number;
}

export const EXERCISE_SELECT = 'SELECT e.*, l.slug AS lesson_slug FROM exercises e LEFT JOIN lessons l ON l.id = e.lesson_id';

/** mysql2 mengembalikan kolom JSON sudah terurai; guard untuk konfigurasi yang mengembalikan string. */
export function asJson<T>(v: unknown): T {
  return (typeof v === 'string' ? JSON.parse(v) : v) as T;
}

export function rowToExercise(r: ExerciseRow): ExerciseDef {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    topic: r.topic,
    difficulty: r.difficulty,
    rows: r.rows_count,
    cols: r.cols_count,
    cells: asJson(r.cells),
    editable: asJson(r.editable),
    task: r.task,
    hints: asJson(r.hints),
    explanation: r.explanation,
    points: r.points,
    lessonSlug: r.lesson_slug ?? undefined,
    sortOrder: r.sort_order,
    published: !!r.published,
    validation: asJson(r.validation),
    tools: r.tools ? asJson<ExerciseTools>(r.tools) : undefined,
  };
}

export interface ShortcutRow {
  id: number;
  slug: string;
  action: string;
  keys_windows: string | null;
  keys_mac: string | null;
  category: ShortcutCategory;
  explanation: string;
  example: string | null;
  verification: string;
  published: number;
}

export function rowToShortcut(r: ShortcutRow): ShortcutDef & { id: number } {
  return {
    id: r.id,
    slug: r.slug,
    action: r.action,
    keysWindows: r.keys_windows,
    keysMac: r.keys_mac,
    category: r.category,
    explanation: r.explanation,
    example: r.example ?? undefined,
    verification: r.verification,
    published: !!r.published,
  };
}

export interface WorksheetRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  objective: string;
  difficulty: Difficulty;
  skills: string[];
  instructions: string[];
  file_name: string;
  key_file_name: string | null;
  sort_order: number;
  published: number;
}

export function rowToWorksheet(r: WorksheetRow): WorksheetDef & { id: number; fileName: string; keyFileName: string | null } {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    objective: r.objective,
    difficulty: r.difficulty,
    skills: asJson(r.skills),
    instructions: asJson(r.instructions),
    sortOrder: r.sort_order,
    published: !!r.published,
    fileName: r.file_name,
    keyFileName: r.key_file_name,
  };
}

export function exerciseSummary(e: ExerciseDef) {
  return {
    slug: e.slug,
    title: e.title,
    description: e.description,
    topic: e.topic,
    difficulty: e.difficulty,
    points: e.points,
    lessonSlug: e.lessonSlug ?? null,
  };
}
