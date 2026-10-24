import { useMemo } from 'react';
import { Sheet, formatValue, isError, type Value } from '@excellab/spreadsheet-engine';
import { PremiumLock } from '../learning/PremiumLock';

interface Props {
  /** Data soal (sel yang bukan jawaban). */
  base: Record<string, string>;
  /** Jawaban acuan: sel -> rumus atau nilai. */
  solution: Record<string, string>;
  /** Isi sel milik pengguna saat ini. */
  mine: Record<string, string>;
  premium: boolean;
}

type Status = 'cocok' | 'beda' | 'kosong';

const show = (v: Value): string => (isError(v) ? v.code : v === null ? '' : typeof v === 'number' ? formatValue(v) : String(v));

function same(a: Value, b: Value): boolean {
  if (isError(a) || isError(b)) return isError(a) && isError(b) && a.code === b.code;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (typeof a === 'string' && typeof b === 'string') return a.trim().toLowerCase() === b.trim().toLowerCase();
  return a === b;
}

/** Membandingkan jawaban pengguna dengan jawaban acuan sel demi sel (hasil hitungan dan rumusnya). */
export function AnswerCompare({ base, solution, mine, premium }: Props) {
  const rows = useMemo(() => {
    const ref = new Sheet({ ...base, ...solution });
    const you = new Sheet(mine);
    return Object.entries(solution).map(([cell, solRaw]) => {
      const myRaw = mine[cell] ?? '';
      const expected = ref.getValue(cell);
      const got = you.getValue(cell);
      const status: Status = myRaw === '' ? 'kosong' : same(expected, got) ? 'cocok' : 'beda';
      return { cell, myRaw, solRaw, expected: show(expected), got: show(got), status };
    });
  }, [base, solution, mine]);

  if (!premium) {
    return (
      <div className="mt-3">
        <PremiumLock title="Bandingkan jawabanmu dengan solusi">
          Premium menampilkan jawabanmu dan jawaban acuan berdampingan, sel demi sel, dengan selisih yang ditandai.
        </PremiumLock>
      </div>
    );
  }

  const diff = rows.filter((r) => r.status !== 'cocok').length;
  return (
    <div className="mt-3 xl-compare">
      <h3 className="h6">Jawabanmu dibanding solusi</h3>
      <p className="xl-small xl-muted mb-2">
        {diff === 0
          ? 'Semua sel menghasilkan angka yang sama dengan solusi.'
          : `${diff} dari ${rows.length} sel berbeda atau masih kosong. Hasil dibandingkan, bukan cara menulis rumusnya, jadi rumus yang berbeda tetap benar bila hasilnya sama.`}
      </p>
      <div className="xl-table-wrap">
        <table className="xl-table">
          <caption className="visually-hidden">Perbandingan jawabanmu dan jawaban acuan per sel</caption>
          <thead>
            <tr>
              <th scope="col">Sel</th>
              <th scope="col">Isianmu</th>
              <th scope="col">Hasilmu</th>
              <th scope="col">Solusi</th>
              <th scope="col">Hasil solusi</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cell} className={r.status === 'cocok' ? undefined : 'xl-diff'}>
                <th scope="row">{r.cell}</th>
                <td>
                  <code>{r.myRaw || '(kosong)'}</code>
                </td>
                <td>{r.got}</td>
                <td>
                  <code>{r.solRaw}</code>
                </td>
                <td>{r.expected}</td>
                <td>{r.status === 'cocok' ? 'Cocok' : r.status === 'beda' ? 'Beda' : 'Kosong'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
