import { EmptyState, ErrorState, Loading } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';

interface PremiumStats {
  users: number;
  active: number;
  rate: number;
  grants: number;
  grants30: number;
  estimatedRevenue: number;
  estimatedRevenue30: number;
  onlineOrders: number;
  onlineRevenue: number;
  expiring: { email: string; name: string; until: string }[];
  recent: { at: string; months: number; email: string | null }[];
  note: string;
}

const nf = new Intl.NumberFormat('id-ID');
const rp = (n: number): string => `Rp ${nf.format(n)}`;
const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' });
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function AdminPremium() {
  const st = useAsync((s) => api.get<PremiumStats>('/admin/stats/premium', s), []);
  if (st.loading) return <Loading label="Memuat data Premium…" />;
  if (st.error || !st.data) return <ErrorState message={st.error ?? 'Data Premium tidak tersedia.'} onRetry={st.reload} />;
  const d = st.data;

  return (
    <>
      <h2 className="h5">Premium</h2>
      <dl className="xl-stats">
        <div>
          <dt>Premium aktif</dt>
          <dd>{nf.format(d.active)}</dd>
          <div className="xl-small xl-muted">
            {Math.round(d.rate * 1000) / 10}% dari {nf.format(d.users)} pengguna
          </div>
        </div>
        <div>
          <dt>Aktivasi 30 hari</dt>
          <dd>{nf.format(d.grants30)}</dd>
          <div className="xl-small xl-muted">perkiraan {rp(d.estimatedRevenue30)}</div>
        </div>
        <div>
          <dt>Aktivasi seluruhnya</dt>
          <dd>{nf.format(d.grants)}</dd>
          <div className="xl-small xl-muted">perkiraan {rp(d.estimatedRevenue)}</div>
        </div>
        {d.onlineOrders > 0 && (
          <div>
            <dt>Pembayaran online</dt>
            <dd>{nf.format(d.onlineOrders)}</dd>
            <div className="xl-small xl-muted">{rp(d.onlineRevenue)}</div>
          </div>
        )}
      </dl>
      <p className="xl-small xl-muted">{d.note}</p>

      <div className="row g-4 mt-1">
        <div className="col-12 col-lg-6">
          <h2 className="h5">Segera habis (30 hari)</h2>
          {d.expiring.length === 0 ? (
            <EmptyState title="Belum ada yang akan habis">Daftar ini berisi pengguna yang bisa kamu hubungi untuk perpanjangan.</EmptyState>
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table">
                <thead>
                  <tr>
                    <th scope="col">Pengguna</th>
                    <th scope="col">Habis</th>
                    <th scope="col">Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {d.expiring.map((e) => (
                    <tr key={e.email}>
                      <td>
                        {e.name}
                        <div className="xl-small xl-muted">{e.email}</div>
                      </td>
                      <td>{dateFmt.format(new Date(e.until))}</td>
                      <td>{daysLeft(e.until)} hari</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="col-12 col-lg-6">
          <h2 className="h5">Aktivasi terbaru</h2>
          {d.recent.length === 0 ? (
            <EmptyState title="Belum ada aktivasi tercatat" />
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table">
                <thead>
                  <tr>
                    <th scope="col">Waktu</th>
                    <th scope="col">Pengguna</th>
                    <th scope="col">Lama</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((g, i) => (
                    <tr key={`${g.at}-${i}`}>
                      <td>{dateTimeFmt.format(new Date(g.at))}</td>
                      <td>{g.email ?? '(akun dihapus)'}</td>
                      <td>{g.months} bulan</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
