import type { ProgressSnapshot } from './types';

export const emptyProgress = (): ProgressSnapshot => ({
  version: 1,
  completedLessons: [],
  exercises: {},
  reviews: {},
  activeDays: [],
});

/** Tanggal (YYYY-MM-DD) dalam zona waktu Asia/Jakarta. */
export function jakartaDate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts; // en-CA => YYYY-MM-DD
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Hitung streak berurutan yang berakhir hari ini atau kemarin. */
export function computeStreak(activeDays: string[], today: string = jakartaDate()): { current: number; longest: number } {
  const days = [...new Set(activeDays)].map(dayNumber).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev = -Infinity;
  for (const d of days) {
    run = d === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const t = dayNumber(today);
  const last = days[days.length - 1];
  let current = 0;
  if (last !== undefined && (last === t || last === t - 1)) {
    current = 1;
    for (let i = days.length - 2; i >= 0; i--) {
      if (days[i] === days[i + 1]! - 1) current++;
      else break;
    }
  }
  return { current, longest };
}

/** Pilih latihan harian secara deterministik berdasarkan tanggal. */
export function dailyIndex(count: number, date: string = jakartaDate()): number {
  if (count <= 0) return 0;
  return dayNumber(date) % count;
}

/** Jeda ulang (hari) untuk box 1 sampai 5. Box 0 = baru salah, langsung jatuh tempo. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_REVIEW_BOX = REVIEW_INTERVALS_DAYS.length;

/** Box berikutnya setelah menjawab: salah kembali ke 0, benar naik satu (maksimal 5). */
export function nextBox(box: number, correct: boolean): number {
  return correct ? Math.min(MAX_REVIEW_BOX, Math.max(0, box) + 1) : 0;
}

/** Jeda hari sampai latihan perlu diulang pada box tertentu (0 = sekarang). */
export function intervalDays(box: number): number {
  return box <= 0 ? 0 : REVIEW_INTERVALS_DAYS[Math.min(box, MAX_REVIEW_BOX) - 1]!;
}

/** Jadwal ulang berikutnya untuk satu latihan setelah sebuah jawaban. */
export function scheduleNext(box: number, correct: boolean, now: Date): { box: number; dueAt: Date } {
  const b = nextBox(box, correct);
  return { box: b, dueAt: new Date(now.getTime() + intervalDays(b) * 86_400_000) };
}
