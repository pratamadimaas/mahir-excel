import { describe, expect, it } from 'vitest';
import { canPoint, cycleAbsolute, pointAt, rangeText } from './pointMode';

describe('canPoint', () => {
  it('benar setelah = atau operator, salah setelah operand atau di luar rumus', () => {
    expect(canPoint('=', 1, null)).toBe(true);
    expect(canPoint('=A2*', 4, null)).toBe(true);
    expect(canPoint('=SUM(', 5, null)).toBe(true);
    expect(canPoint('=IF(A2>', 7, null)).toBe(true);
    expect(canPoint('=SUM(A2,', 8, null)).toBe(true);
    expect(canPoint('=A2', 3, null)).toBe(false);
    expect(canPoint('=SUM(A2)', 8, null)).toBe(false);
    expect(canPoint('15+', 3, null)).toBe(false); // bukan rumus
    expect(canPoint('=A2& "a+', 8, null)).toBe(false); // di dalam tanda kutip
  });

  it('tetap benar tepat setelah alamat yang baru disisipkan (untuk menggantinya)', () => {
    const r = pointAt('=', 1, 'A2', null);
    expect(canPoint(r.text, r.caret, r.span)).toBe(true);
    expect(canPoint(r.text, r.caret, null)).toBe(false);
  });
});

describe('pointAt', () => {
  it('menyisipkan di kursor lalu mengganti alamat yang sama saat klik berikutnya', () => {
    const a = pointAt('=', 1, 'B2', null);
    expect(a.text).toBe('=B2');
    const b = pointAt(a.text, a.caret, 'B3', a.span);
    expect(b.text).toBe('=B3');
    expect(b.caret).toBe(3);
    const c = pointAt(b.text, b.caret, 'B3:B6', b.span);
    expect(c.text).toBe('=B3:B6');
  });

  it('mengabaikan span lama bila teks sudah berubah', () => {
    const a = pointAt('=', 1, 'B2', null);
    const out = pointAt('=B2*', 4, 'C2', a.span);
    expect(out.text).toBe('=B2*C2');
  });
});

describe('rangeText', () => {
  it('mengurutkan sudut rentang dan memakai satu sel bila sama', () => {
    expect(rangeText('B6', 'B2')).toBe('B2:B6');
    expect(rangeText('D4', 'A1')).toBe('A1:D4');
    expect(rangeText('C3', 'C3')).toBe('C3');
  });
});

describe('cycleAbsolute (F4)', () => {
  it('berganti B2 -> $B$2 -> B$2 -> $B2 -> B2', () => {
    let t = '=A2*B2';
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = cycleAbsolute(t, t.length)!;
      seen.push(r.text);
      t = r.text;
    }
    expect(seen).toEqual(['=A2*$B$2', '=A2*B$2', '=A2*$B2', '=A2*B2']);
  });

  it('mengubah seluruh rentang dan menjaga kursor di ujung referensi', () => {
    const r = cycleAbsolute('=SUM(B2:B6)', 10)!;
    expect(r.text).toBe('=SUM($B$2:$B$6)');
    expect(r.caret).toBe(14);
  });

  it('tidak melakukan apa-apa di luar referensi atau pada bukan rumus', () => {
    expect(cycleAbsolute('=SUM(', 5)).toBeNull();
    expect(cycleAbsolute('B2', 2)).toBeNull();
    expect(cycleAbsolute('="B2"', 4)).toBeNull(); // teks di dalam tanda kutip bukan referensi
  });
});
