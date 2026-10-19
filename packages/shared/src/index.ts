export * from './types';
export * from './validate';
export * from './progress';
export { modules } from './content/modules';
export { lessonsPart1 } from './content/lessons-1';
export { lessonsPart2 } from './content/lessons-2';
export { shortcuts, shortcutCategories } from './content/shortcuts';
export { worksheets } from './content/worksheets';

import { exercises as baseExercises } from './content/exercises';
import { moreExercises } from './content/exercises-more';
import { lessonsPart1 } from './content/lessons-1';
import { lessonsPart2 } from './content/lessons-2';
import { lessonsPart3 } from './content/lessons-3';
import { lessonsPart4 } from './content/lessons-4';

export const lessons = [...lessonsPart1, ...lessonsPart2, ...lessonsPart3, ...lessonsPart4];
export const exercises = [...baseExercises, ...moreExercises];
export { placementQuestions, evaluatePlacement } from './content/placement';
export type { PlacementQuestion, PlacementResult } from './content/placement';
export { PUBLIC_LESSON_SLUGS, isPublicLesson } from './content/public';
export { placementLevel } from './content/placement';
export type { PlacementLevel } from './content/placement';

import { FUNCTION_NAMES } from '@excellab/spreadsheet-engine';
/** Jumlah fungsi rumus yang didukung playground (dipakai untuk angka di beranda agar tidak pernah basi). */
export const FUNCTION_COUNT = FUNCTION_NAMES.size;
