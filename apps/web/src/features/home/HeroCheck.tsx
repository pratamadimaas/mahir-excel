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

export function HeroCheck() {
  const wrong = FEEDBACK_STEPS[0]!;
  return (
    <figure className="xl-hc" aria-label="Contoh hasil pemeriksaan latihan Total pengeluaran bulanan">
      <div className="xl-hc-win" aria-hidden="true">
        <div className="xl-hc-bar">
          <i />
          <i />
          <i />
          <span>mahir-excel-total-pengeluaran.xlsx</span>
        </div>
        <div className="xl-hc-fx">
          <span className="xl-hc-nm">B7</span>
          <code>{wrong.formula}</code>
        </div>
        <table>
          <thead>
            <tr>
              <th />
              <th>A</th>
              <th>B</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([a, b], i) => (
              <tr key={a}>
                <td className="xl-hc-rh">{i + 1}</td>
                <td className={i === 0 ? 'fw-bold' : ''}>{a}</td>
                <td className={`xl-hc-num${i === 0 ? ' fw-bold' : ''}${i === ROWS.length - 1 ? ' xl-hc-bad' : ''}`}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xl-hc-fb" role="note">
        <strong>Belum tepat.</strong> {wrong.message}
      </div>
      <figcaption>Contoh dari latihan Total pengeluaran bulanan.</figcaption>
    </figure>
  );
}
