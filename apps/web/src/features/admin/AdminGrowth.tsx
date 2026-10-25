import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';

interface Growth {
  funnel: { key: string; label: string; count: number }[];
  cohorts: { day: string; signups: number; day1: number | null; week1: number | null }[];
  note: string;
}

const nf = new Intl.NumberFormat('id-ID');
const dayFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const fmtDay = (d: string): string => dayFmt.format(new Date(`${d}T12:00:00+07:00`));
const pct = (n: number, of: number): string => (of > 0 ? `${Math.round((n / of) * 100)}%` : '-');

function ReturnCell({ n, of }: { n: number | null; of: number }) {
  if (n === null) return <td className="xl-muted" title="Jendela waktunya belum lewat">-</td>;
  return (
    <td>
      {nf.format(n)} <span className="xl-small xl-muted">({pct(n, of)})</span>
    </td>
  );
}

export function AdminGrowth() {
  const st = useAsync((s) => api.get<Growth>('/admin/stats/growth', s), []);
  if (st.loading) return <Loading label="Memuat data pertumbuhan…" />;
  if (st.error || !st.data) return <ErrorState message={st.error ?? 'Data pertumbuhan tidak tersedia.'} onRetry={st.reload} />;
  const { funnel, cohorts, note } = st.data;
  const base = funnel[0]?.count ?? 0;

  return (
    <>
      <h2 className="h5">Dari daftar sampai Premium</h2>
      {base === 0 ? (
        <EmptyState title="Belum ada akun terdaftar" />
      ) : (
        <ol className="list-unstyled" aria-label="Corong akun">
          {funnel.map((f, i) => {
            const prev = i > 0 ? funnel[i - 1]!.count : null;
            return (
              <li key={f.key} className="mb-3">
                <div className="d-flex justify-content-between">
                  <span>{f.label}</span>
                  <span>
                    <strong>{nf.format(f.count)}</strong> <span className="xl-small xl-muted">({pct(f.count, base)} dari yang mendaftar)</span>
                  </span>
                </div>
                <div className="xl-bar-cell">
                  <span className="xl-bar" style={{ width: `${base ? (f.count / base) * 100 : 0}%`, minWidth: f.count > 0 ? 4 : 0 }} aria-hidden="true" />
                </div>
                {prev !== null && prev > 0 && f.key !== 'lesson' && f.key !== 'premium' && (
                  <div className="xl-small xl-muted">{pct(f.count, prev)} dari tahap sebelumnya</div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <h2 className="h5 mt-4">Yang kembali setelah mendaftar</h2>
      {cohorts.length === 0 ? (
        <EmptyState title="Belum ada pendaftar dalam 3 minggu terakhir" />
      ) : (
        <div className="xl-table-wrap">
          <table className="xl-table">
            <caption className="visually-hidden">Retensi per hari pendaftaran (WIB), terbaru di atas</caption>
            <thead>
              <tr>
                <th scope="col">Hari mendaftar</th>
                <th scope="col">Pendaftar</th>
                <th scope="col">Kembali besoknya</th>
                <th scope="col">Kembali dalam 7 hari</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.day}>
                  <td className="text-nowrap">{fmtDay(c.day)}</td>
                  <td>{nf.format(c.signups)}</td>
                  <ReturnCell n={c.day1} of={c.signups} />
                  <ReturnCell n={c.week1} of={c.signups} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="xl-small xl-muted mt-2">{note}</p>
    </>
  );
}
