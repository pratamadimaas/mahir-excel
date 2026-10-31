import { FEEDBACK_STEPS } from './landingData';

/**
 * Visual hero untuk pengunjung: satu latihan nyata dengan hasil pemeriksaannya.
 * Datanya sama dengan latihan "Total pengeluaran bulanan"; pesan salahnya adalah pesan asli validator
 * (dicek tes di landingData), jadi yang terlihat di sini memang yang dilihat pengguna.
 */
const ROWS: [string, string][] = [
  ['Pos', 'Biaya'],
  ['Makan', '350.000'],
  ['Transport', '120.000'],
  ['Pulsa', '50.000'],
  ['Listrik', '200.000'],
  ['Internet', '300.000'],
  ['Total', '720.000'],
];

/** Rumus di B7 mengacu ke B2:B5, jadi baris 2 sampai 5 ditandai seperti Excel menandai rentang saat rumus diedit. */
const IN_RANGE = [1, 2, 3, 4];

export function HeroCheck() {
  const wrong = FEEDBACK_STEPS[0]!;
  return (
    <figure className="xl-hc" aria-label="Contoh hasil pemeriksaan latihan Total pengeluaran bulanan">
      <div className="xl-hc-win">
        <div className="xl-hc-bar" aria-hidden="true">
          <i />
          <i />
          <i />
          <span>mahir-excel-total-pengeluaran.xlsx</span>
        </div>
        <div className="xl-hc-fx" aria-hidden="true">
          <span className="xl-hc-nm">B7</span>
          <code>{wrong.formula}</code>
        </div>
        <table aria-hidden="true">
          <thead>
            <tr>
              <th />
              <th className="text-start">A</th>
              <th className="text-end">B</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([a, b], i) => (
              <tr key={a}>
                <td className="xl-hc-rh">{i + 1}</td>
                <td className={i === 0 || i === ROWS.length - 1 ? 'fw-bold' : ''}>{a}</td>
                <td
                  className={[
                    'xl-hc-num',
                    i === 0 || i === ROWS.length - 1 ? 'fw-bold' : '',
                    IN_RANGE.includes(i) ? 'xl-hc-in' : '',
                    i === IN_RANGE[0] ? 'xl-hc-in-top' : '',
                    i === IN_RANGE[IN_RANGE.length - 1] ? 'xl-hc-in-bottom' : '',
                    i === ROWS.length - 1 ? 'xl-hc-bad' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="xl-hc-fb" role="note">
          <i className="xl-hc-dot" aria-hidden="true" />
          <p>
            <strong>Hasil pemeriksaan</strong>
            {wrong.message}
          </p>
        </div>
      </div>
      <figcaption>Contoh umpan balik dari latihan Total pengeluaran bulanan.</figcaption>
    </figure>
  );
}
