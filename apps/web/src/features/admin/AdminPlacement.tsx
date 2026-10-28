import { useState } from 'react';
import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { TOPIC_LABELS } from '../../services/types';

type Level = 'Pemula' | 'Menengah' | 'Mahir';
const LEVELS: Level[] = ['Pemula', 'Menengah', 'Mahir'];

interface PlacementDetail {
  total: number;
  averageScore: number | null;
  withAccount: number;
  sampled: number;
  legacy: number;
  levels: Record<Level, number>;
  hardest: { id: string; question: string; module: string; asked: number; wrong: number }[];
  moduleAccuracy: { module: string; correct: number; total: number }[];
  weekly: { week: string; count: number; avgPercent: number }[];
  matching: number;
  recent: {
    id: number;
    score: number;
    total: number;
    level: Level | null;
    legacy: boolean;
    startModule: string | null;
    at: string;
    user: { displayName: string | null; email: string } | null;
  }[];
}

const nf = new Intl.NumberFormat('id-ID');
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const weekFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0);
const moduleLabel = (slug: string): string => TOPIC_LABELS[slug] ?? slug;

/** Hasil uji kemampuan Excel: sebaran tingkat, soal tersulit, akurasi per modul, tren mingguan, dan daftar hasil. */
export function PlacementSection() {
  const [level, setLevel] = useState<'' | Level>('');
  const [onlyAccount, setOnlyAccount] = useState(false);
  const q = new URLSearchParams();
  if (level) q.set('level', level);
  if (onlyAccount) q.set('account', '1');
  const qs = q.toString();
  const st = useAsync((s) => api.get<PlacementDetail>(`/admin/stats/placement${qs ? `?${qs}` : ''}`, s), [qs]);
  const d = st.data;
  const leveled = d && d.total > 0 ? LEVELS.reduce((n, l) => n + d.levels[l], 0) : 0;

  return (
    <section aria-labelledby="pt-admin">
      <h2 className="h5 mt-4" id="pt-admin">
        Uji Kemampuan Excel
      </h2>
      {st.error && <ErrorState message={st.error} onRetry={st.reload} />}
      {st.loading && !d && <Loading label="Memuat hasil tes…" />}
      {d && d.total === 0 && <EmptyState title="Belum ada yang mengikuti uji kemampuan Excel" />}
      {d && d.total > 0 && (
        <>
          <p className="mb-2">
            <strong>{nf.format(d.total)}</strong> hasil, rata-rata skor <strong>{d.averageScore}</strong>.
            {d.legacy > 0 && (
              <>
                {' '}
                {nf.format(d.legacy)} hasil berasal dari tes versi lama (12 soal); tingkatnya dihitung ulang dari jawabannya dan diberi tanda “lama”.
              </>
            )}
            {d.sampled < d.total && <> Rincian di bawah dari {nf.format(d.sampled)} hasil terbaru.</>}
          </p>

          <h3 className="h6 mt-3">Sebaran tingkat</h3>
          <dl className="xl-stats">
            {LEVELS.map((l) => (
              <div key={l}>
                <dt>{l}</dt>
                <dd>{nf.format(d.levels[l])}</dd>
                <div className="xl-small xl-muted">
                  {pct(d.levels[l], leveled)}% dari {nf.format(leveled)} hasil
                </div>
              </div>
            ))}
          </dl>
          {leveled < 30 && (
            <p className="xl-small xl-muted">Contoh masih sedikit ({nf.format(leveled)} hasil), jadi persentase belum bisa dijadikan pegangan.</p>
          )}

          <div className="row g-4 mt-1">
            <div className="col-12 col-lg-7">
              <h3 className="h6">Soal yang paling sering salah</h3>
              <div className="xl-table-wrap">
                <table className="xl-table">
                  <caption className="visually-hidden">Soal uji kemampuan Excel yang paling sering dijawab salah</caption>
                  <thead>
                    <tr>
                      <th scope="col">Soal</th>
                      <th scope="col">Modul</th>
                      <th scope="col">Salah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.hardest.map((h) => (
                      <tr key={h.id}>
                        <td>{h.question}</td>
                        <td>{moduleLabel(h.module)}</td>
                        <td className="text-nowrap">
                          {pct(h.wrong, h.asked)}% ({nf.format(h.wrong)} dari {nf.format(h.asked)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-12 col-lg-5">
              <h3 className="h6">Akurasi per modul</h3>
              <ul className="xl-module-summary">
                {d.moduleAccuracy.map((m) => (
                  <li key={m.module}>
                    <span>{moduleLabel(m.module)}</span>
                    <span>
                      {pct(m.correct, m.total)}% ({nf.format(m.correct)}/{nf.format(m.total)})
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className="h6 mt-3">Per minggu</h3>
              <div className="xl-table-wrap">
                <table className="xl-table">
                  <caption className="visually-hidden">Jumlah tes dan rata-rata skor per minggu</caption>
                  <thead>
                    <tr>
                      <th scope="col">Minggu mulai</th>
                      <th scope="col">Tes</th>
                      <th scope="col">Rata-rata skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.weekly.map((w) => (
                      <tr key={w.week}>
                        <td className="text-nowrap">{weekFmt.format(new Date(`${w.week}T12:00:00+07:00`))}</td>
                        <td>{nf.format(w.count)}</td>
                        <td>{w.avgPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <h3 className="h6 mt-4">Hasil terbaru</h3>
          <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
            <label className="d-flex align-items-center gap-2 mb-0">
              <span className="xl-small">Tingkat</span>
              <select className="form-select form-select-sm w-auto" value={level} onChange={(e) => setLevel(e.target.value as '' | Level)}>
                <option value="">Semua</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="d-flex align-items-center gap-2 mb-0">
              <input type="checkbox" className="form-check-input mt-0" checked={onlyAccount} onChange={(e) => setOnlyAccount(e.target.checked)} />
              <span className="xl-small">Hanya yang punya akun</span>
            </label>
            <span className="xl-small xl-muted" role="status">
              {nf.format(d.matching)} hasil cocok{d.matching > d.recent.length ? `, ${d.recent.length} terbaru ditampilkan` : ''}
            </span>
          </div>
          <div className="xl-table-wrap">
            <table className="xl-table">
              <caption className="visually-hidden">Hasil uji kemampuan Excel terbaru</caption>
              <thead>
                <tr>
                  <th scope="col">Waktu</th>
                  <th scope="col">Tingkat</th>
                  <th scope="col">Skor</th>
                  <th scope="col">Modul awal</th>
                  <th scope="col">Peserta</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((p) => (
                  <tr key={p.id}>
                    <td className="text-nowrap">{dateTimeFmt.format(new Date(p.at))}</td>
                    <td className="text-nowrap">
                      {p.level ?? '-'}
                      {p.legacy && <span className="xl-small xl-muted ms-1">(lama)</span>}
                    </td>
                    <td>
                      {p.score}/{p.total}
                    </td>
                    <td>{p.startModule ? <code>{p.startModule}</code> : '-'}</td>
                    <td>{p.user ? `${p.user.displayName ?? ''} (${p.user.email})` : 'Tanpa akun'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
