import { Sheet, extractFunctions, formatValue, isError, isFormula, normalizeRef, expandRef } from '@excellab/spreadsheet-engine';
import type { Value } from '@excellab/spreadsheet-engine';
import type { CheckResult, ExerciseDef, PublicExercise } from './types';

export const MAX_CELL_LENGTH = 500;
export const MAX_SUBMITTED_CELLS = 200;

export function toPublicExercise(ex: ExerciseDef): PublicExercise {
  return {
    slug: ex.slug,
    title: ex.title,
    description: ex.description,
    topic: ex.topic,
    difficulty: ex.difficulty,
    rows: ex.rows,
    cols: ex.cols,
    cells: ex.cells,
    editable: ex.editable,
    task: ex.task,
    // Petunjuk terakhir pada konten hampir selalu berisi jawaban; hanya dibuka lewat tombol "Lihat solusi".
    hints: ex.hints.slice(0, -1),
    points: ex.points,
    lessonSlug: ex.lessonSlug ?? null,
    targetCells: ex.validation.targets.map((t) => t.cell),
    tools: ex.tools ?? null,
  };
}

export function editableSet(ex: Pick<ExerciseDef, 'editable'>): Set<string> {
  const set = new Set<string>();
  for (const e of ex.editable) for (const c of expandRef(e)) set.add(c);
  return set;
}

/** Hanya sel yang boleh diubah yang diambil dari kiriman pengguna; sisanya selalu dari data latihan. */
export function mergeSubmission(ex: ExerciseDef, submitted: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = { ...ex.cells };
  const allowed = editableSet(ex);
  for (const [k, raw] of Object.entries(submitted)) {
    const ref = normalizeRef(k);
    if (!ref || !allowed.has(ref)) continue;
    merged[ref] = String(raw).slice(0, MAX_CELL_LENGTH);
  }
  return merged;
}

const normText = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

function sameValue(a: Value, b: Value, tolerance: number, exactText: boolean): boolean {
  if (isError(a) || isError(b)) return false;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tolerance;
  if (typeof a === 'string' && typeof b === 'string') return exactText ? a === b : normText(a) === normText(b);
  if (a === null && b === null) return true;
  return a === b;
}

/**
 * Memvalidasi jawaban dengan menghitung sheet pengguna lewat mesin spreadsheet dan
 * membandingkannya dengan sheet acuan. Rumus juga diuji pada varian data supaya
 * jawaban yang kebetulan cocok (mis. angka diketik langsung) tidak lolos.
 */
export function validateSubmission(ex: ExerciseDef, submitted: Record<string, string>): CheckResult {
  const v = ex.validation;
  const tolerance = v.tolerance ?? 1e-6;
  const merged = mergeSubmission(ex, submitted);

  const reference: Record<string, string> = { ...ex.cells };
  for (const t of v.targets) reference[t.cell] = t.solution;

  const evaluate = (base: Record<string, string>, over: Record<string, string>) => new Sheet({ ...base, ...over });
  const userSheet = evaluate(merged, {});
  const refSheet = evaluate(reference, {});

  const results: CheckResult['targets'] = [];

  for (const t of v.targets) {
    const raw = merged[t.cell] ?? '';
    const fail = (message: string) => results.push({ cell: t.cell, ok: false, message });

    if (raw.trim() === '') {
      fail(`Sel ${t.cell} masih kosong. Isi sel ini sesuai petunjuk tugas.`);
      continue;
    }
    const solIsFormula = isFormula(t.solution);
    const needFormula = v.requireFormula ?? solIsFormula;
    const userIsFormula = isFormula(raw);

    if (needFormula && !userIsFormula) {
      fail(
        `Sel ${t.cell} harus berisi rumus (diawali tanda =), bukan angka atau teks yang diketik langsung. Rumus membuat hasil ikut berubah saat data berubah.`,
      );
      continue;
    }

    const userVal = userSheet.getValue(t.cell);
    if (isError(userVal)) {
      fail(`Sel ${t.cell} menghasilkan galat ${userVal.code}. ${userVal.message}`);
      continue;
    }

    if (t.requireFunction && !extractFunctions(raw).includes(t.requireFunction.toUpperCase())) {
      fail(
        `Latihan ini melatih fungsi ${t.requireFunction.toUpperCase()}. Hasilmu mungkin bisa sama, tetapi coba gunakan fungsi tersebut di sel ${t.cell}.`,
      );
      continue;
    }

    let patternFailed = false;
    for (const p of v.requirePatterns ?? []) {
      if (p.cells && !p.cells.some((c) => expandRef(c).includes(t.cell))) continue;
      if (userIsFormula && !new RegExp(p.pattern, 'i').test(raw)) {
        fail(p.message);
        patternFailed = true;
        break;
      }
    }
    if (patternFailed) continue;

    const expected = refSheet.getValue(t.cell);
    if (!sameValue(userVal, expected, tolerance, !!t.exactText)) {
      const rule = (v.rules ?? []).find((r) => new RegExp(r.pattern, 'i').test(raw));
      fail(
        rule
          ? rule.message
          : `Sel ${t.cell} menghasilkan ${formatValue(userVal) || '(kosong)'}. Namun, hasil tersebut belum sesuai dengan instruksi soal. Periksa rentang sel, operator, dan sel yang mungkin terlewat.`,
      );
      continue;
    }

    if (userIsFormula) {
      let variantBroken = false;
      for (const variant of v.variants ?? []) {
        const uv = evaluate(merged, variant).getValue(t.cell);
        const ev = evaluate(reference, variant).getValue(t.cell);
        if (!sameValue(uv, ev, tolerance, !!t.exactText)) {
          variantBroken = true;
          break;
        }
      }
      if (variantBroken) {
        fail(
          `Hasil di ${t.cell} cocok untuk data sekarang, tetapi tidak ikut benar saat data diubah. Biasanya ini berarti ada angka yang diketik langsung di dalam rumus atau referensi sel yang kurang tepat (misalnya perlu tanda $).`,
        );
        continue;
      }
    }
    results.push({ cell: t.cell, ok: true, message: `Sel ${t.cell} benar.` });
  }

  const correct = results.every((r) => r.ok);
  const bad = results.filter((r) => !r.ok).length;
  return {
    correct,
    message: correct
      ? 'Jawabanmu benar!'
      : bad === results.length
        ? 'Jawabanmu belum tepat. Baca catatan di bawah, lalu coba lagi atau buka petunjuk.'
        : `${results.length - bad} dari ${results.length} sel sudah benar. Perbaiki sisanya.`,
    targets: results,
  };
}

/** Solusi dalam bentuk teks untuk ditampilkan setelah latihan selesai atau menyerah. */
export function solutionCells(ex: ExerciseDef): Record<string, string> {
  return Object.fromEntries(ex.validation.targets.map((t) => [t.cell, t.solution]));
}
