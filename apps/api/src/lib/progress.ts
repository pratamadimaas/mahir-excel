import { computeStreak, type ProgressView } from '@excellab/shared';
import { rows, run, type Queryable } from '../db/pool';

export async function touchLearningDay(db: Queryable, userId: number, day: string): Promise<void> {
  await run(db, 'INSERT IGNORE INTO learning_days (user_id, day) VALUES (?, ?)', [userId, day]);
}

/** Menyusun progres lengkap seorang pengguna dari MySQL (sumber kebenaran). */
export async function buildProgressView(db: Queryable, userId: number): Promise<ProgressView> {
  const [lessons, completions, reviews, days] = await Promise.all([
    rows<{ slug: string }>(
      db,
      'SELECT l.slug FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? ORDER BY lp.completed_at',
      [userId],
    ),
    rows<{ slug: string; points: number; attempts: number; completed_at: string }>(
      db,
      'SELECT e.slug, ec.points, ec.attempts, ec.completed_at FROM exercise_completions ec JOIN exercises e ON e.id = ec.exercise_id WHERE ec.user_id = ?',
      [userId],
    ),
    rows<{ slug: string; message: string; created_at: string }>(
      db,
      'SELECT e.slug, ri.message, ri.created_at FROM review_items ri JOIN exercises e ON e.id = ri.exercise_id WHERE ri.user_id = ?',
      [userId],
    ),
    rows<{ day: string }>(db, 'SELECT day FROM learning_days WHERE user_id = ? ORDER BY day', [userId]),
  ]);

  const toIso = (s: string): string => new Date(`${s.replace(' ', 'T')}Z`).toISOString();
  const exercises: ProgressView['exercises'] = {};
  let totalPoints = 0;
  for (const c of completions) {
    exercises[c.slug] = { completedAt: toIso(c.completed_at), attempts: c.attempts, points: c.points };
    totalPoints += c.points;
  }
  const reviewMap: ProgressView['reviews'] = {};
  for (const r of reviews) reviewMap[r.slug] = { at: toIso(r.created_at), message: r.message };
  const activeDays = days.map((d) => d.day);
  return {
    completedLessons: lessons.map((l) => l.slug),
    exercises,
    reviews: reviewMap,
    activeDays,
    totalPoints,
    streak: computeStreak(activeDays),
  };
}
