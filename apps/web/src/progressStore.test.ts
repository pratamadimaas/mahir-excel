import { describe, expect, it } from 'vitest';
import { emptyProgress } from '@excellab/shared';
import {
  STORAGE_KEY,
  completeLesson,
  isEmptyProgress,
  loadLocal,
  localTotals,
  recordResult,
  sanitize,
  saveLocal,
  uncompleteLesson,
  type StorageLike,
} from './services/progressStore';

const memory = (): StorageLike & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
};

const day = (d: string) => new Date(`${d}T05:00:00Z`);

describe('progres lokal anonim', () => {
  it('persisten: simpan lalu muat kembali', () => {
    const s = memory();
    const { snapshot } = recordResult(
      emptyProgress(),
      'total-pengeluaran',
      { correct: true, message: 'ok', points: 10 },
      day('2026-03-01'),
    );
    expect(saveLocal(s, completeLesson(snapshot, 'fungsi-sum', '2026-03-01'))).toBe(true);
    const loaded = loadLocal(s);
    expect(loaded.completedLessons).toEqual(['fungsi-sum']);
    expect(loaded.exercises['total-pengeluaran']).toMatchObject({ points: 10, attempts: 1 });
    expect(loaded.activeDays).toEqual(['2026-03-01']);
  });

  it('poin hanya diberikan sekali per latihan', () => {
    let snap = emptyProgress();
    const first = recordResult(snap, 'a-b', { correct: true, message: 'ok', points: 20 }, day('2026-03-01'));
    snap = first.snapshot;
    const second = recordResult(snap, 'a-b', { correct: true, message: 'ok', points: 20 }, day('2026-03-02'));
    expect(first.pointsAwarded).toBe(20);
    expect(second.pointsAwarded).toBe(0);
    expect(localTotals(second.snapshot, '2026-03-02').totalPoints).toBe(20);
    expect(second.snapshot.exercises['a-b']!.attempts).toBe(2);
  });

  it('jawaban salah masuk tinjauan dan hilang saat benar', () => {
    const wrong = recordResult(emptyProgress(), 'x-y', { correct: false, message: 'Rentang kurang', points: 10 }, day('2026-03-01'));
    expect(wrong.snapshot.reviews['x-y']!.message).toBe('Rentang kurang');
    expect(wrong.pointsAwarded).toBe(0);
    const right = recordResult(wrong.snapshot, 'x-y', { correct: true, message: 'ok', points: 10 }, day('2026-03-01'));
    expect(right.snapshot.reviews['x-y']).toBeUndefined();
  });

  it('streak dihitung dari hari aktif berurutan', () => {
    let s = emptyProgress();
    s = completeLesson(s, 'a', '2026-03-01');
    s = completeLesson(s, 'b', '2026-03-02');
    s = completeLesson(s, 'c', '2026-03-03');
    expect(localTotals(s, '2026-03-03').streak).toEqual({ current: 3, longest: 3 });
    expect(localTotals(s, '2026-03-06').streak.current).toBe(0);
  });

  it('menandai dan membatalkan pelajaran selesai', () => {
    const s = completeLesson(emptyProgress(), 'fungsi-if', '2026-03-01');
    expect(s.completedLessons).toEqual(['fungsi-if']);
    expect(uncompleteLesson(s, 'fungsi-if').completedLessons).toEqual([]);
    expect(completeLesson(s, 'fungsi-if', '2026-03-01').completedLessons).toEqual(['fungsi-if']);
  });

  it('data rusak atau berbahaya disaring', () => {
    const dirty = {
      completedLessons: ['ok-slug', '../etc/passwd', 42, 'ok-slug'],
      exercises: { 'bagus-sekali': { completedAt: 'x', attempts: -5, points: 99999 }, '<script>': { attempts: 1 }, normal: 'bukan objek' },
      reviews: { rev: { message: 'a'.repeat(900) }, bad: { at: 1 } },
      activeDays: ['2026-01-01', 'kemarin', '2026-01-01'],
    };
    const clean = sanitize(dirty);
    expect(clean.completedLessons).toEqual(['ok-slug']);
    expect(Object.keys(clean.exercises)).toEqual(['bagus-sekali']);
    expect(clean.exercises['bagus-sekali']!.attempts).toBe(1);
    expect(clean.exercises['bagus-sekali']!.points).toBeUndefined();
    expect(clean.reviews.rev!.message).toHaveLength(500);
    expect(clean.activeDays).toEqual(['2026-01-01']);
    expect(sanitize('rusak')).toEqual(emptyProgress());
    expect(sanitize(null)).toEqual(emptyProgress());
  });

  it('JSON rusak di storage tidak merusak aplikasi', () => {
    const s = memory();
    s.data[STORAGE_KEY] = '{bukan json';
    expect(isEmptyProgress(loadLocal(s))).toBe(true);
  });

  it('storage yang menolak tulis (mode privat) ditangani', () => {
    const s: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    expect(saveLocal(s, emptyProgress())).toBe(false);
    expect(saveLocal(null, emptyProgress())).toBe(false);
    expect(loadLocal(null)).toEqual(emptyProgress());
  });
});
