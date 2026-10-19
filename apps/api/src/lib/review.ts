import { intervalDays, nextBox } from '@excellab/shared';
import { row, run, type Queryable } from '../db/pool';

/**
 * Memperbarui jadwal ulang sebuah latihan setelah jawaban pengguna terdaftar.
 * - Jawaban salah: box 0 dan langsung jatuh tempo.
 * - Jawaban benar pada latihan yang sudah terjadwal: naik satu box dengan jeda 1, 3, 7, 14, 30 hari.
 * - Jawaban benar pada latihan yang belum pernah salah: tidak dijadwalkan.
 */
export async function recordReview(db: Queryable, userId: number, exerciseId: number, correct: boolean): Promise<void> {
  if (!correct) {
    await run(
      db,
      `INSERT INTO review_schedule (user_id, exercise_id, box, due_at) VALUES (?,?,0, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE box = 0, due_at = UTC_TIMESTAMP()`,
      [userId, exerciseId],
    );
    return;
  }
  const cur = await row<{ box: number }>(db, 'SELECT box FROM review_schedule WHERE user_id = ? AND exercise_id = ?', [userId, exerciseId]);
  if (!cur) return;
  const box = nextBox(cur.box, true);
  await run(db, 'UPDATE review_schedule SET box = ?, due_at = (UTC_TIMESTAMP() + INTERVAL ? DAY) WHERE user_id = ? AND exercise_id = ?', [
    box,
    intervalDays(box),
    userId,
    exerciseId,
  ]);
}
