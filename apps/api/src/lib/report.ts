import { modules } from '@excellab/shared';
import { rows, type Queryable } from '../db/pool';
import { buildProgressView } from './progress';

export type TopicLevel = 'belum-mulai' | 'perlu-latihan' | 'lumayan' | 'kuat';

export interface TopicReport {
  topic: string;
  title: string;
  totalExercises: number;
  completed: number;
  attempts: number;
  correctAttempts: number;
  /** Persen jawaban benar dari semua percobaan; null bila belum pernah mencoba. */
  accuracy: number | null;
  level: TopicLevel;
}

export interface Recommendation {
  slug: string;
  title: string;
  topic: string;
  topicTitle: string;
  difficulty: string;
  reason: string;
}

export interface ProgressReport {
  summary: { totalExercises: number; completed: number; attempts: number; accuracy: number | null; points: number; activeDays: number; streak: number; reviewPending: number };
  topics: TopicReport[];
  weakest: string[];
  recommendations: Recommendation[];
}

const DIFF_ORDER: Record<string, number> = { mudah: 1, sedang: 2, sulit: 3 };

/** Aturan tingkat per topik. Angka ini heuristik sederhana, bukan penilaian resmi. */
export function topicLevel(t: { totalExercises: number; completed: number; attempts: number; accuracy: number | null }): TopicLevel {
  if (t.attempts === 0 && t.completed === 0) return 'belum-mulai';
  const done = t.totalExercises === 0 ? 0 : t.completed / t.totalExercises;
  const acc = t.accuracy ?? 0;
  if (t.attempts >= 3 && acc < 0.5) return 'perlu-latihan';
  if (done >= 0.8 && acc >= 0.6) return 'kuat';
  if (done < 0.4 && t.attempts >= 2 && acc < 0.7) return 'perlu-latihan';
  return 'lumayan';
}

/** Laporan kemajuan pribadi dari data yang sudah tersimpan: percobaan, latihan selesai, dan tinjauan. */
export async function buildReport(db: Queryable, userId: number): Promise<ProgressReport> {
  const [exs, att, reviews, progress] = await Promise.all([
    rows<{ id: number; slug: string; title: string; topic: string; difficulty: string }>(
      db,
      'SELECT id, slug, title, topic, difficulty FROM exercises WHERE published = 1 ORDER BY sort_order, id',
    ),
    rows<{ exercise_id: number; n: number; c: number }>(
      db,
      'SELECT exercise_id, COUNT(*) AS n, SUM(correct) AS c FROM exercise_attempts WHERE user_id = ? GROUP BY exercise_id',
      [userId],
    ),
    rows<{ slug: string }>(db, 'SELECT e.slug FROM review_items ri JOIN exercises e ON e.id = ri.exercise_id WHERE ri.user_id = ?', [userId]),
    buildProgressView(db, userId),
  ]);
  const attempts = new Map(att.map((a) => [a.exercise_id, { n: Number(a.n), c: Number(a.c ?? 0) }]));
  const reviewSet = new Set(reviews.map((r) => r.slug));
  const done = new Set(Object.keys(progress.exercises));
  const titleOf = new Map(modules.map((m) => [m.slug, m.title]));

  const byTopic = new Map<string, TopicReport>();
  for (const e of exs) {
    const t =
      byTopic.get(e.topic) ??
      ({ topic: e.topic, title: titleOf.get(e.topic) ?? e.topic, totalExercises: 0, completed: 0, attempts: 0, correctAttempts: 0, accuracy: null, level: 'belum-mulai' } as TopicReport);
    t.totalExercises++;
    if (done.has(e.slug)) t.completed++;
    const a = attempts.get(e.id);
    if (a) {
      t.attempts += a.n;
      t.correctAttempts += a.c;
    }
    byTopic.set(e.topic, t);
  }
  const topics = [...byTopic.values()].map((t) => {
    const accuracy = t.attempts === 0 ? null : t.correctAttempts / t.attempts;
    return { ...t, accuracy, level: topicLevel({ ...t, accuracy }) };
  });
  // Urutan sama dengan kurikulum.
  const order = (t: string): number => {
    const i = modules.findIndex((m) => m.slug === t);
    return i < 0 ? 99 : i;
  };
  topics.sort((a, b) => order(a.topic) - order(b.topic));

  // Topik terlemah: yang sudah dicoba, dinilai dari akurasi lalu kemajuan penyelesaian.
  const weakTopics = topics
    .filter((t) => t.attempts > 0 && t.level !== 'kuat')
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1) || a.completed / a.totalExercises - b.completed / b.totalExercises)
    .slice(0, 3);

  const recommendations: Recommendation[] = [];
  for (const t of weakTopics) {
    const open = exs
      .filter((e) => e.topic === t.topic && !done.has(e.slug))
      .sort((a, b) => Number(reviewSet.has(b.slug)) - Number(reviewSet.has(a.slug)) || (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9));
    for (const e of open.slice(0, 2)) {
      recommendations.push({
        slug: e.slug,
        title: e.title,
        topic: e.topic,
        topicTitle: t.title,
        difficulty: e.difficulty,
        reason: reviewSet.has(e.slug) ? 'Kamu pernah salah di latihan ini. Coba lagi sekarang.' : `Latihan ${e.difficulty} untuk menguatkan ${t.title}.`,
      });
    }
  }
  // Belum ada percobaan sama sekali: sarankan tiga latihan termudah dari awal kurikulum.
  if (recommendations.length === 0) {
    for (const e of exs.filter((x) => !done.has(x.slug)).slice(0, 3)) {
      recommendations.push({
        slug: e.slug,
        title: e.title,
        topic: e.topic,
        topicTitle: titleOf.get(e.topic) ?? e.topic,
        difficulty: e.difficulty,
        reason: 'Langkah berikutnya di kurikulum.',
      });
    }
  }

  const totalAttempts = topics.reduce((n, t) => n + t.attempts, 0);
  const totalCorrect = topics.reduce((n, t) => n + t.correctAttempts, 0);
  return {
    summary: {
      totalExercises: exs.length,
      completed: done.size,
      attempts: totalAttempts,
      accuracy: totalAttempts === 0 ? null : totalCorrect / totalAttempts,
      points: progress.totalPoints,
      activeDays: progress.activeDays.length,
      streak: progress.streak.current,
      reviewPending: reviewSet.size,
    },
    topics,
    weakest: weakTopics.map((t) => t.topic),
    recommendations,
  };
}
