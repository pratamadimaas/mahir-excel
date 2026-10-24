import { describe, expect, it } from 'vitest';
import { Sheet, isError, traceFormula } from './index';

const data = new Sheet({ A1: '10', A2: '20', A3: '30', B1: 'apel', B2: 'jeruk', B3: 'apel', C1: '5' });

describe('traceFormula', () => {
  it('menelusuri aritmetika dari dalam ke luar', () => {
    const t = traceFormula('=A1+A2*C1', data);
    expect(t.parseError).toBeNull();
    expect(t.result).toBe(110);
    expect(t.steps.map((s) => s.before.target)).toEqual(['A1', 'A2', 'C1', '20*5', '10+100']);
    expect(t.steps[0]!.value).toBe('10');
    expect(t.steps.at(-1)!.value).toBe('110');
  });

  it('IF memilih cabang tanpa menghitung cabang lain', () => {
    const t = traceFormula('=IF(A1>5,"besar",1/0)', data);
    expect(t.result).toBe('besar');
    expect(t.steps.some((s) => s.note.includes('benar'))).toBe(true);
    expect(t.steps.every((s) => !s.isError)).toBe(true);
  });

  it('rentang tetap utuh dan fungsi dihitung sekali', () => {
    const t = traceFormula('=SUM(A1:A3)/COUNT(A1:A3)', data);
    expect(t.result).toBe(20);
    expect(t.steps.map((s) => s.before.target)).toEqual(['SUM(A1:A3)', 'COUNT(A1:A3)', '60/3']);
  });

  it('referensi di dalam fungsi pencarian tidak diganti nilainya', () => {
    const t = traceFormula('=COUNTIF(B1:B3,"apel")*2', data);
    expect(t.result).toBe(4);
    expect(t.steps[0]!.before.target).toBe('COUNTIF(B1:B3,"apel")');
  });

  it('menandai galat di langkah yang menyebabkannya', () => {
    const t = traceFormula('=A1/(A2-20)', data);
    expect(isError(t.result)).toBe(true);
    const bad = t.steps.find((s) => s.isError)!;
    expect(bad.value).toBe('#DIV/0!');
    expect(bad.note).toContain('galat');
  });

  it('IFERROR memakai nilai pengganti saat galat', () => {
    const t = traceFormula('=IFERROR(A1/0,"nol")', data);
    expect(t.result).toBe('nol');
  });

  it('kurung dipertahankan sesuai urutan hitung', () => {
    const t = traceFormula('=(A1+A2)*C1', data);
    expect(t.start).toBe('(A1+A2)*C1');
    expect(t.result).toBe(150);
  });

  it('melaporkan rumus yang tidak bisa dibaca', () => {
    const t = traceFormula('=SUM(A1:A3', data);
    expect(t.parseError).not.toBeNull();
    expect(t.steps).toEqual([]);
  });

  it('sel kosong tampil sebagai (kosong) dan dihitung 0', () => {
    const t = traceFormula('=Z9+1', data);
    expect(t.steps[0]!.value).toBe('(kosong)');
    expect(t.result).toBe(1);
  });
});
