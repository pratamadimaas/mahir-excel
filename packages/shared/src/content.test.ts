import { describe, expect, it } from 'vitest';
import { Sheet, isError, isFormula, FUNCTION_NAMES, extractFunctions } from '@excellab/spreadsheet-engine';
import {
  editableSet,
  computeStreak,
  dailyIndex,
  exercises,
  lessons,
  modules,
  shortcuts,
  solutionCells,
  toPublicExercise,
  validateSubmission,
  worksheets,
} from './index';

describe('integritas konten', () => {
  it('memiliki minimal 29 pelajaran lengkap di 8 modul', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(29);
    expect(modules).toHaveLength(8);
    for (const l of lessons) {
      expect(modules.some((m) => m.slug === l.moduleSlug)).toBe(true);
      expect(l.content.objectives.length).toBeGreaterThan(0);
      expect(l.content.sections.length).toBeGreaterThan(0);
      expect(l.content.mistakes.length).toBeGreaterThan(0);
      expect(l.content.quiz.length).toBeGreaterThan(0);
      for (const q of l.content.quiz) expect(q.options[q.answerIndex]).toBeDefined();
      expect(exercises.some((e) => e.lessonSlug === l.slug)).toBe(true);
    }
  });

  it('slug unik', () => {
    for (const list of [lessons, exercises, shortcuts, worksheets, modules]) {
      const slugs = list.map((x) => x.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('memiliki minimal 40 pintasan dan 10 worksheet', () => {
    expect(shortcuts.length).toBeGreaterThanOrEqual(40);
    expect(worksheets).toHaveLength(10);
  });

  it('latihan terkait pelajaran yang ada, dengan petunjuk progresif', () => {
    for (const e of exercises) {
      expect(lessons.some((l) => l.slug === e.lessonSlug)).toBe(true);
      expect(e.hints.length).toBeGreaterThanOrEqual(3);
      expect(e.editable.length).toBeGreaterThan(0);
    }
  });
});

describe.each(exercises.map((e) => [e.slug, e] as const))('latihan %s', (_slug, ex) => {
  const solution = solutionCells(ex);

  it('jawaban acuan lolos validasi', () => {
    const r = validateSubmission(ex, solution);
    expect(r.targets.filter((t) => !t.ok)).toEqual([]);
    expect(r.correct).toBe(true);
  });

  it('jawaban acuan tidak menghasilkan galat dan hanya memakai fungsi yang didukung', () => {
    const sheet = new Sheet({ ...ex.cells, ...solution });
    for (const t of ex.validation.targets) {
      expect(isError(sheet.getValue(t.cell))).toBe(false);
      for (const f of extractFunctions(t.solution)) expect(FUNCTION_NAMES.has(f)).toBe(true);
    }
  });

  it('submit kosong ditolak', () => {
    const r = validateSubmission(ex, {});
    expect(r.correct).toBe(false);
  });

  it('target berada di sel yang boleh diedit', () => {
    const pub = toPublicExercise(ex);
    expect(JSON.stringify(pub)).not.toContain('solution');
    expect(pub.hints).toHaveLength(ex.hints.length - 1);
  });

  it('data awal tanpa jawaban tidak lolos (kecuali sel target bukan yang diubah)', () => {
    const r = validateSubmission(ex, ex.cells);
    expect(r.correct).toBe(false);
  });

  it('mengetik hasil langsung sebagai angka ditolak untuk target rumus', () => {
    const formulaTargets = ex.validation.targets.filter((t) => isFormula(t.solution));
    if (formulaTargets.length === 0) return;
    const sheet = new Sheet({ ...ex.cells, ...solution });
    const hardcoded: Record<string, string> = { ...solution };
    for (const t of formulaTargets) {
      const v = sheet.getValue(t.cell);
      hardcoded[t.cell] = String(v);
    }
    expect(validateSubmission(ex, hardcoded).correct).toBe(false);
  });

  it('tidak bisa mengubah sel di luar area edit', () => {
    const allowed = editableSet(ex);
    const outside = Object.keys(ex.cells).find((k) => !allowed.has(k));
    const tampered = { ...solution, ...(outside ? { [outside]: '999999' } : {}) };
    // Sel di luar area edit diabaikan sehingga jawaban tetap benar.
    expect(validateSubmission(ex, tampered).correct).toBe(true);
  });
});

describe('validasi - kasus khusus', () => {
  const ex = (slug: string) => exercises.find((e) => e.slug === slug)!;

  it('rumus beda fungsi ditolak walau hasil sama', () => {
    const r = validateSubmission(ex('total-pengeluaran'), { B7: '=350000+120000+50000+200000+300000' });
    expect(r.correct).toBe(false);
  });

  it('SUM diganti penjumlahan manual memberi pesan yang meminta SUM', () => {
    const r = validateSubmission(ex('total-pengeluaran'), { B7: '=B2+B3+B4+B5+B6' });
    expect(r.correct).toBe(false);
    expect(r.targets[0]!.message).toContain('SUM');
  });

  it('referensi relatif pada tarif ditolak', () => {
    const r = validateSubmission(ex('pajak-ppn'), { C2: '=B2*E1', C3: '=B3*E1', C4: '=B4*E1', C5: '=B5*E1' });
    expect(r.correct).toBe(false);
  });

  it('tarif diketik langsung ditolak', () => {
    const r = validateSubmission(ex('pajak-ppn'), { C2: '=B2*0.11', C3: '=B3*0.11', C4: '=B4*0.11', C5: '=B5*0.11' });
    expect(r.correct).toBe(false);
  });

  it('IF dengan > bukan >= memberi pesan khusus', () => {
    const r = validateSubmission(ex('status-kelulusan'), {
      C2: '=IF(B2>70,"Lulus","Remedial")',
      C3: '=IF(B3>70,"Lulus","Remedial")',
      C4: '=IF(B4>70,"Lulus","Remedial")',
      C5: '=IF(B5>70,"Lulus","Remedial")',
    });
    expect(r.correct).toBe(false);
    expect(r.targets.find((t) => t.cell === 'C4')!.message).toContain('>=');
  });

  it('teks dibandingkan tidak peka huruf besar-kecil kecuali exactText', () => {
    expect(validateSubmission(ex('cari-penjualan-tertinggi'), { E1: ' sari ' }).correct).toBe(true);
    expect(validateSubmission(ex('seragamkan-kota'), { B2: 'jakarta', B3: 'Jakarta' }).correct).toBe(false);
  });

  it('separator titik koma diterima', () => {
    const r = validateSubmission(ex('total-pengeluaran'), { B7: '=SUM(B2;B3;B4;B5;B6)' });
    expect(r.correct).toBe(true);
  });

  it('rumus galat memberi penjelasan galat', () => {
    const r = validateSubmission(ex('total-pengeluaran'), { B7: '=SUM(B2:B6' });
    expect(r.targets[0]!.message).toContain('#ERROR!');
  });

  it('fungsi tidak didukung memberi pesan #NAME?', () => {
    const r = validateSubmission(ex('total-pengeluaran'), { B7: '=UNIQUE(B2:B6)' });
    expect(r.targets[0]!.message).toContain('#NAME?');
  });

  it('sebagian benar dilaporkan sebagian', () => {
    const r = validateSubmission(ex('total-harga-barang'), { D2: '=B2*C2', D3: '=B3*C3', D4: '=B4+C4' });
    expect(r.correct).toBe(false);
    expect(r.message).toContain('2 dari 3');
  });
});

describe('progres', () => {
  it('computeStreak menghitung hari berurutan', () => {
    expect(computeStreak(['2026-01-01', '2026-01-02', '2026-01-03'], '2026-01-03')).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(['2026-01-01', '2026-01-02'], '2026-01-03')).toEqual({ current: 2, longest: 2 });
    expect(computeStreak(['2026-01-01'], '2026-01-05')).toEqual({ current: 0, longest: 1 });
    expect(computeStreak([], '2026-01-05')).toEqual({ current: 0, longest: 0 });
  });
  it('dailyIndex deterministik dan dalam batas', () => {
    expect(dailyIndex(10, '2026-01-01')).toBe(dailyIndex(10, '2026-01-01'));
    expect(dailyIndex(10, '2026-01-02')).toBe((dailyIndex(10, '2026-01-01') + 1) % 10);
  });
});

describe('tes penempatan', () => {
  it('semua pertanyaan valid dan mengacu modul yang ada', async () => {
    const { placementQuestions } = await import('./index');
    const ids = placementQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of placementQuestions) {
      expect(modules.some((m) => m.slug === q.module)).toBe(true);
      expect(q.options[q.answerIndex]).toBeDefined();
      expect(q.explanation.length).toBeGreaterThan(5);
    }
    expect(new Set(placementQuestions.map((q) => q.module)).size).toBe(modules.length);
  });

  it('evaluasi: semua benar -> tidak ada modul awal; salah di tengah -> mulai dari modul itu', async () => {
    const { placementQuestions, evaluatePlacement } = await import('./index');
    const all = Object.fromEntries(placementQuestions.map((q) => [q.id, q.answerIndex]));
    const perfect = evaluatePlacement(all);
    expect(perfect.score).toBe(perfect.total);
    expect(perfect.startModule).toBeNull();
    expect(perfect.missed).toEqual([]);

    const wrongLogic = { ...all, p6: (all.p6! + 1) % 4 };
    const r = evaluatePlacement(wrongLogic);
    expect(r.startModule).toBe('logika');
    expect(r.missed).toEqual(['p6']);

    const earliest = evaluatePlacement({ ...wrongLogic, p1: (all.p1! + 1) % 4 });
    expect(earliest.startModule).toBe('mengenal-excel'); // modul paling awal yang belum benar menang

    expect(evaluatePlacement({}).score).toBe(0);
    expect(evaluatePlacement({}).startModule).toBe('mengenal-excel');
  });
});

describe('jadwal ulang', () => {
  it('nextBox dan intervalDays', async () => {
    const { nextBox, intervalDays, scheduleNext } = await import('./index');
    expect(nextBox(0, true)).toBe(1);
    expect(nextBox(5, true)).toBe(5);
    expect(nextBox(3, false)).toBe(0);
    expect([0, 1, 2, 3, 4, 5].map(intervalDays)).toEqual([0, 1, 3, 7, 14, 30]);
    const now = new Date('2026-01-01T00:00:00Z');
    expect(scheduleNext(1, true, now).dueAt.toISOString()).toBe('2026-01-04T00:00:00.000Z'); // box 2 = 3 hari
    expect(scheduleNext(4, false, now).dueAt.toISOString()).toBe(now.toISOString());
  });
});

describe('pelajaran contoh publik dan level penempatan', () => {
  it('semua slug pelajaran contoh ada di kurikulum dan jumlahnya terbatas', async () => {
    const { PUBLIC_LESSON_SLUGS, lessons, isPublicLesson } = await import('./index');
    const slugs = new Set(lessons.map((l) => l.slug));
    for (const s of PUBLIC_LESSON_SLUGS) expect(slugs.has(s), s).toBe(true);
    expect(new Set(PUBLIC_LESSON_SLUGS).size).toBe(PUBLIC_LESSON_SLUGS.length);
    expect(PUBLIC_LESSON_SLUGS.length).toBeLessThanOrEqual(6);
    expect(isPublicLesson('fungsi-sum')).toBe(true);
    expect(isPublicLesson('index-match')).toBe(false);
  });

  it('worksheet gratis ada di daftar worksheet dan jumlahnya 3', async () => {
    const { FREE_WORKSHEET_SLUGS, worksheets, isFreeWorksheet } = await import('./index');
    const slugs = new Set(worksheets.map((w) => w.slug));
    for (const s of FREE_WORKSHEET_SLUGS) expect(slugs.has(s), s).toBe(true);
    expect(FREE_WORKSHEET_SLUGS).toHaveLength(3);
    expect(isFreeWorksheet('anggaran-bulanan')).toBe(true);
    expect(isFreeWorksheet('latihan-lookup')).toBe(false);
  });

  it('level: semua benar = Mahir; salah di modul awal = Pemula; di tengah = Menengah', async () => {
    const { placementLevel } = await import('./index');
    expect(placementLevel({ startModule: null })).toBe('Mahir');
    expect(placementLevel({ startModule: 'mengenal-excel' })).toBe('Pemula');
    expect(placementLevel({ startModule: 'rumus-dasar' })).toBe('Pemula');
    expect(placementLevel({ startModule: 'logika' })).toBe('Menengah');
    expect(placementLevel({ startModule: 'fungsi-pencarian' })).toBe('Menengah');
    expect(placementLevel({ startModule: 'teks-tanggal' })).toBe('Mahir');
  });
});
