import { MAX_REVIEW_BOX, computeStreak, emptyProgress, jakartaDate, scheduleNext, type ProgressSnapshot } from '@excellab/shared';

/** Progres lokal anonim. Disimpan di localStorage browser; dapat hilang bila data situs dibersihkan. */
export const STORAGE_KEY = 'excellab.progress.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Memvalidasi data dari localStorage: data rusak atau diubah tangan tidak boleh merusak aplikasi. */
export function sanitize(input: unknown): ProgressSnapshot {
  const out = emptyProgress();
  if (!isRecord(input)) return out;
  if (Array.isArray(input.completedLessons)) {
    out.completedLessons = [...new Set(input.completedLessons.filter((s): s is string => typeof s === 'string' && SLUG.test(s)))].slice(
      0,
      200,
    );
  }
  if (isRecord(input.exercises)) {
    for (const [slug, v] of Object.entries(input.exercises).slice(0, 300)) {
      if (!SLUG.test(slug) || !isRecord(v)) continue;
      out.exercises[slug] = {
        completedAt: typeof v.completedAt === 'string' ? v.completedAt.slice(0, 40) : new Date(0).toISOString(),
        attempts: typeof v.attempts === 'number' && v.attempts >= 1 ? Math.min(Math.floor(v.attempts), 100000) : 1,
        ...(typeof v.points === 'number' && v.points >= 0 && v.points <= 1000 ? { points: Math.floor(v.points) } : {}),
      };
    }
  }
  if (isRecord(input.reviews)) {
    for (const [slug, v] of Object.entries(input.reviews).slice(0, 300)) {
      if (!SLUG.test(slug) || !isRecord(v) || typeof v.message !== 'string') continue;
      out.reviews[slug] = {
        at: typeof v.at === 'string' ? v.at.slice(0, 40) : new Date(0).toISOString(),
        message: v.message.slice(0, 500),
      };
    }
  }
  if (isRecord(input.schedule)) {
    const schedule: NonNullable<ProgressSnapshot['schedule']> = {};
    for (const [slug, v] of Object.entries(input.schedule).slice(0, 300)) {
      if (!SLUG.test(slug) || !isRecord(v)) continue;
      const box = typeof v.box === 'number' && Number.isInteger(v.box) && v.box >= 0 && v.box <= MAX_REVIEW_BOX ? v.box : null;
      const due = typeof v.dueAt === 'string' ? new Date(v.dueAt) : null;
      if (box === null || !due || Number.isNaN(due.getTime())) continue;
      schedule[slug] = { box, dueAt: due.toISOString() };
    }
    out.schedule = schedule;
  }
  if (Array.isArray(input.activeDays)) {
    out.activeDays = [...new Set(input.activeDays.filter((d): d is string => typeof d === 'string' && DAY.test(d)))].sort().slice(-400);
  }
  return out;
}

export function loadLocal(storage: StorageLike | null): ProgressSnapshot {
  if (!storage) return emptyProgress();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveLocal(storage: StorageLike | null, snap: ProgressSnapshot): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snap));
    return true;
  } catch {
    return false; // mode privat / kuota penuh
  }
}

export function clearLocal(storage: StorageLike | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* abaikan */
  }
}

export function getStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const isEmptyProgress = (s: ProgressSnapshot): boolean =>
  s.completedLessons.length === 0 &&
  Object.keys(s.exercises).length === 0 &&
  Object.keys(s.reviews).length === 0 &&
  Object.keys(s.schedule ?? {}).length === 0 &&
  s.activeDays.length === 0;

const withDay = (s: ProgressSnapshot, today: string): ProgressSnapshot =>
  s.activeDays.includes(today) ? s : { ...s, activeDays: [...s.activeDays, today].sort().slice(-400) };

export function completeLesson(s: ProgressSnapshot, slug: string, today = jakartaDate()): ProgressSnapshot {
  if (s.completedLessons.includes(slug)) return withDay(s, today);
  return withDay({ ...s, completedLessons: [...s.completedLessons, slug] }, today);
}

export function uncompleteLesson(s: ProgressSnapshot, slug: string): ProgressSnapshot {
  return { ...s, completedLessons: s.completedLessons.filter((l) => l !== slug) };
}

/** Mencatat hasil submit. Poin hanya dihitung pada penyelesaian pertama sebuah latihan. */
export function recordResult(
  s: ProgressSnapshot,
  slug: string,
  result: { correct: boolean; message: string; points: number },
  now = new Date(),
): { snapshot: ProgressSnapshot; pointsAwarded: number } {
  const r = recordCore(s, slug, result, now);
  return { snapshot: updateSchedule(r.snapshot, slug, result.correct, now), pointsAwarded: r.pointsAwarded };
}

/** Jadwal ulang: jawaban salah menjadwalkan ulang sekarang; benar pada latihan terjadwal menaikkan box. Latihan yang langsung benar tidak dijadwalkan. */
function updateSchedule(s: ProgressSnapshot, slug: string, correct: boolean, now: Date): ProgressSnapshot {
  const cur = s.schedule?.[slug];
  if (!correct) return { ...s, schedule: { ...s.schedule, [slug]: { box: 0, dueAt: now.toISOString() } } };
  if (!cur) return s;
  const n = scheduleNext(cur.box, true, now);
  return { ...s, schedule: { ...s.schedule, [slug]: { box: n.box, dueAt: n.dueAt.toISOString() } } };
}

/** Latihan yang jatuh tempo untuk diulang (data lokal), paling lama menunggu lebih dulu. */
export function localDue(s: ProgressSnapshot, now = new Date()): { slug: string; box: number; dueAt: string }[] {
  return Object.entries(s.schedule ?? {})
    .filter(([, v]) => new Date(v.dueAt).getTime() <= now.getTime())
    .map(([slug, v]) => ({ slug, box: v.box, dueAt: v.dueAt }))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

function recordCore(
  s: ProgressSnapshot,
  slug: string,
  result: { correct: boolean; message: string; points: number },
  now = new Date(),
): { snapshot: ProgressSnapshot; pointsAwarded: number } {
  const today = jakartaDate(now);
  const prev = s.exercises[slug];
  if (result.correct) {
    const { [slug]: _removed, ...reviews } = s.reviews;
    if (prev) {
      return {
        snapshot: withDay({ ...s, reviews, exercises: { ...s.exercises, [slug]: { ...prev, attempts: prev.attempts + 1 } } }, today),
        pointsAwarded: 0,
      };
    }
    return {
      snapshot: withDay(
        { ...s, reviews, exercises: { ...s.exercises, [slug]: { completedAt: now.toISOString(), attempts: 1, points: result.points } } },
        today,
      ),
      pointsAwarded: result.points,
    };
  }
  return {
    snapshot: withDay(
      { ...s, reviews: prev ? s.reviews : { ...s.reviews, [slug]: { at: now.toISOString(), message: result.message.slice(0, 500) } } },
      today,
    ),
    pointsAwarded: 0,
  };
}

export function localTotals(s: ProgressSnapshot, today = jakartaDate()) {
  const totalPoints = Object.values(s.exercises).reduce((n, e) => n + (e.points ?? 0), 0);
  return { totalPoints, streak: computeStreak(s.activeDays, today) };
}
