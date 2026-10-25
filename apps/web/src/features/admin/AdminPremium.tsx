import { useState, type FormEvent } from 'react';
import { ConfirmDialog, EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api, errorMessage } from '../../services/api';

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

interface Payment {
  id: number;
  payer: string;
  amount: number;
  months: number;
  paidOn: string;
  note: string | null;
  linkedEmail: string | null;
}
interface PaymentList {
  items: Payment[];
  page: number;
  pageSize: number;
  total: number;
  summary: { count: number; amount: number; months: number; amount30: number };
}

const PAY_PAGE = 20;
const todayWib = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const payDateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const fmtPaid = (d: string): string => payDateFmt.format(new Date(`${d}T12:00:00+07:00`));

/** Buku kas kecil untuk pembayaran yang diterima di luar aplikasi: angka nyata, bukan perkiraan dari log. */
function PaymentsSection({ estimated, onChanged }: { estimated: number; onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const list = useAsync((s) => api.get<PaymentList>(`/admin/payments?page=${page}&pageSize=${PAY_PAGE}`, s), [page]);
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('12');
  const [paidOn, setPaidOn] = useState(todayWib());
  const [note, setNote] = useState('');
  const [activate, setActivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<Payment | null>(null);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await api.post('/admin/payments', {
        payer: payer.trim(),
        amount: Number(amount),
        months: Number(months || 0),
        paidOn,
        note: note.trim() || undefined,
        activate,
      });
      setMsg({ tone: 'success', text: activate ? 'Pembayaran dicatat dan Premium diaktifkan.' : 'Pembayaran dicatat.' });
      setPayer('');
      setAmount('');
      setNote('');
      setActivate(false);
      setPage(1);
      list.reload();
      onChanged();
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Payment): Promise<void> => {
    setToDelete(null);
    setMsg(null);
    try {
      await api.del(`/admin/payments/${p.id}`);
      list.reload();
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    }
  };

  const s = list.data?.summary;
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAY_PAGE));

  return (
    <section aria-labelledby="catatan-bayar" className="mt-4">
      <h2 className="h5" id="catatan-bayar">
        Catatan pembayaran
      </h2>
      <p className="xl-small xl-muted">
        Isi setiap kali menerima pembayaran lewat WhatsApp atau transfer. Ini angka nyata, berbeda dengan perkiraan dari log di atas.
      </p>
      <dl className="xl-stats">
        <div>
          <dt>Tercatat total</dt>
          <dd>{rp(s?.amount ?? 0)}</dd>
          <div className="xl-small xl-muted">{nf.format(s?.count ?? 0)} pembayaran</div>
        </div>
        <div>
          <dt>Tercatat 30 hari</dt>
          <dd>{rp(s?.amount30 ?? 0)}</dd>
        </div>
        <div>
          <dt>Perkiraan dari log</dt>
          <dd>{rp(estimated)}</dd>
          <div className="xl-small xl-muted">dari log, memakai harga sekarang</div>
        </div>
      </dl>

      <form onSubmit={submit} className="row g-2 align-items-end mb-3" aria-label="Catat pembayaran">
        <div className="col-12 col-md-4">
          <label htmlFor="bayar-pembayar" className="form-label">
            Pembayar (email akun atau nama)
          </label>
          <input id="bayar-pembayar" className="form-control" value={payer} onChange={(e) => setPayer(e.target.value)} maxLength={255} required />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="bayar-nominal" className="form-label">
            Nominal (Rp)
          </label>
          <input id="bayar-nominal" className="form-control" type="number" inputMode="numeric" min={0} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="bayar-bulan" className="form-label">
            Lama (bulan)
          </label>
          <input id="bayar-bulan" className="form-control" type="number" inputMode="numeric" min={0} max={36} value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="bayar-tanggal" className="form-label">
            Tanggal bayar
          </label>
          <input id="bayar-tanggal" className="form-control" type="date" max={todayWib()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
        </div>
        <div className="col-12 col-md-6">
          <label htmlFor="bayar-catatan" className="form-label">
            Catatan (opsional)
          </label>
          <input id="bayar-catatan" className="form-control" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
        </div>
        <div className="col-12 col-md-4">
          <div className="form-check">
            <input id="bayar-aktifkan" className="form-check-input" type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            <label htmlFor="bayar-aktifkan" className="form-check-label">
              Aktifkan Premium akun ini sekarang
            </label>
            <div className="xl-small xl-muted">Hanya bila pembayar diisi dengan email akun.</div>
          </div>
        </div>
        <div className="col-12 col-md-2">
          <button type="submit" className="btn btn-primary w-100" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Catat pembayaran'}
          </button>
        </div>
      </form>
      {msg && (
        <div className="mb-3">
          <Status tone={msg.tone} live>
            {msg.text}
          </Status>
        </div>
      )}

      {list.loading && !list.data ? (
        <Loading label="Memuat catatan pembayaran…" />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState title="Belum ada pembayaran tercatat">Catat pembayaran pertamamu lewat form di atas.</EmptyState>
      ) : (
        <>
          <div className="xl-table-wrap">
            <table className="xl-table">
              <caption className="visually-hidden">Catatan pembayaran manual, terbaru di atas</caption>
              <thead>
                <tr>
                  <th scope="col">Tanggal</th>
                  <th scope="col">Pembayar</th>
                  <th scope="col">Nominal</th>
                  <th scope="col">Lama</th>
                  <th scope="col">Catatan</th>
                  <th scope="col">
                    <span className="visually-hidden">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="text-nowrap">{fmtPaid(p.paidOn)}</td>
                    <td>
                      {p.payer}
                      {p.linkedEmail && p.linkedEmail !== p.payer.toLowerCase() && <div className="xl-small xl-muted">{p.linkedEmail}</div>}
                    </td>
                    <td className="text-nowrap">{rp(p.amount)}</td>
                    <td>{p.months > 0 ? `${p.months} bulan` : '-'}</td>
                    <td>{p.note ?? ''}</td>
                    <td>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setToDelete(p)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="xl-small xl-muted" role="status">
                Halaman {page} dari {pages}
              </span>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                  Lebih baru
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>
                  Lebih lama
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title="Hapus catatan pembayaran?"
        confirmLabel="Hapus"
        danger
        onConfirm={() => toDelete && void remove(toDelete)}
        onCancel={() => setToDelete(null)}
      >
        {toDelete && (
          <p>
            Catatan {fmtPaid(toDelete.paidOn)} dari {toDelete.payer} sebesar {rp(toDelete.amount)} akan dihapus. Premium akun tidak berubah.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}

export function AdminPremium() {
  const st = useAsync((s) => api.get<PremiumStats>('/admin/stats/premium', s), []);
  if (st.loading && !st.data) return <Loading label="Memuat data Premium…" />;
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

      <PaymentsSection estimated={d.estimatedRevenue} onChanged={st.reload} />
    </>
  );
}
