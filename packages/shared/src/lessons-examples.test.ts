import { describe, expect, it } from 'vitest';
import { Sheet, indexToCol, isError } from '@excellab/spreadsheet-engine';
import { lessons } from './index';
import { lessonsPart5 } from './content/lessons-5';

/** Contoh di pelajaran harus benar: tabelnya dihitung mesin, dan hasil yang tertulis harus sama. */
describe('contoh pelajaran tambahan', () => {
  it.each(lessonsPart5.map((l) => [l.slug, l] as const))('%s: rumus contoh menghasilkan hasil yang tertulis', (_slug, lesson) => {
    const cells: Record<string, string> = {};
    lesson.content.example.table.forEach((row, r) => row.forEach((v, c) => (cells[`${indexToCol(c)}${r + 1}`] = String(v))));
    cells.Z99 = lesson.content.example.formula;
    const v = new Sheet(cells).getValue('Z99');
    expect(isError(v), `${lesson.slug}: ${isError(v) ? v.message : ''}`).toBe(false);
    expect(String(v)).toBe(lesson.content.example.result);
  });

  it('semua rumus di tabel contoh dihitung tanpa galat', () => {
    for (const lesson of lessonsPart5) {
      const cells: Record<string, string> = {};
      lesson.content.example.table.forEach((row, r) => row.forEach((v, c) => (cells[`${indexToCol(c)}${r + 1}`] = String(v))));
      const sheet = new Sheet(cells);
      for (const ref of Object.keys(cells)) {
        const v = sheet.getValue(ref);
        expect(isError(v), `${lesson.slug} ${ref}`).toBe(false);
      }
    }
  });

  it('pelajaran baru terdaftar di modul yang ada dan urutannya tidak bentrok', () => {
    for (const l of lessonsPart5) {
      const sameModule = lessons.filter((x) => x.moduleSlug === l.moduleSlug);
      expect(sameModule.filter((x) => x.sortOrder === l.sortOrder), `${l.slug} bentrok urutan`).toHaveLength(1);
    }
  });
});
