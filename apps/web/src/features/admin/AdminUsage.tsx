import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { api, apiUrl, errorMessage } from '../../services/api';
import type { ProgramStatus } from '../../services/types';
import { PlacementSection } from './AdminPlacement';

interface Stats {
  users: number;
  admins: number;
  attempts: number;
  completions: number;
  lessonCompletions: number;
  publishedLessons: number;
  publishedExercises: number;
  exerciseUsage: { slug: string; title: string; attempts: number; correct: number }[];
  note: string;
}

interface DailyRow {
  day: string;
  visitors: number;
  pageviews: number;
  newUsers: number;
  attempts: number;
  anonAttempts: number;
  anonCorrect: number;
}

interface Usage {
  daily: DailyRow[];
  today: DailyRow;
  /** Sejak pencatatan dimulai; tidak ada di server lama. */
  total?: { visitors: number; pageviews: number; since: string | null; firstDay?: string };
  week: Omit<DailyRow, 'day'>;
  topPages: { page: string; views: number }[];
  sources: { source: string; visitors: number }[];
  features: { feature: string; count: number }[];
  notFound: { path: string; hits: number }[];
  anonymousExercises: { slug: string; attempts: number; correct: number }[];
  note: string;
}

const nf = new Intl.NumberFormat('id-ID');
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

const sinceFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const fmtSince = (d: string): string => sinceFmt.format(new Date(`${d}T12:00:00+07:00`));
const dayYearFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const fmtDayYear = (d: string): string => dayYearFmt.format(new Date(`${d}T12:00:00+07:00`));
const fmtDateTime = (iso: string | null): string => (iso ? dateTimeFmt.format(new Date(iso)) : '-');

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{nf.format(value)}</dd>
      {hint && <div className="xl-small xl-muted">{hint}</div>}
    </div>
  );
}

interface PlacementStats {
  total: number;
  averageScore: number | null;
  withAccount: number;
  byStartModule: { module: string | null; count: number }[];
  recent: {
    id: number;
    score: number;
    total: number;
    startModule: string | null;
    at: string;
    user: { displayName: string | null; email: string } | null;
  }[];
}

/** Nama fitur yang mudah dibaca dari kunci pencatatan (mis. template:stok-barang). */
const featureName = (key: string): string => {
  const [kind, slug = ''] = key.split(':');
  const nice = slug.replace(/-/g, ' ');
  if (kind === 'template') return `Unduh template: ${nice}`;
  if (kind === 'cheatsheet') return `Unduh contekan PDF: ${nice}`;
  if (key === 'laporan-kemajuan') return 'Laporan kemajuan dibuka';
  return key;
};

const DAILY_PAGE = 14;
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Aktivitas harian, terbaru di atas. Halaman 1 memakai data yang sudah dimuat; halaman lama diambil per halaman. */
function DailyTable({ usage }: { usage: Usage }) {
  const [page, setPage] = useState(1);
  const latest = usage.daily[usage.daily.length - 1]?.day;
  const first = usage.total?.firstDay ?? usage.total?.since ?? null;
  const totalDays = first && latest ? Math.max(usage.daily.length, daysBetween(first, latest) + 1) : usage.daily.length;
  const pages = Math.max(1, Math.ceil(totalDays / DAILY_PAGE));
  const older = useAsync(
    async (s) => (page > 1 ? api.page<DailyRow>(`/admin/stats/daily?page=${page}&pageSize=${DAILY_PAGE}`, s) : null),
    [page],
  );
  const rows: DailyRow[] = page === 1 ? [...usage.daily].reverse() : older.data?.data ?? [];
  const maxVisitors = Math.max(1, ...rows.map((d) => d.visitors));

  return (
    <>
      {page > 1 && older.loading ? (
        <Loading label="Memuat hari-hari sebelumnya…" />
      ) : page > 1 && older.error ? (
        <ErrorState message={older.error} onRetry={older.reload} />
      ) : (
        <div className="xl-table-wrap">
          <table className="xl-table">
            <caption className="visually-hidden">Aktivitas harian (WIB), terbaru di atas, {DAILY_PAGE} hari per halaman</caption>
            <thead>
              <tr>
                <th scope="col">Tanggal</th>
                <th scope="col">Pengunjung</th>
                <th scope="col">Halaman dibuka</th>
                <th scope="col">Pendaftar baru</th>
                <th scope="col">Percobaan latihan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.day}>
                  <td className="text-nowrap">{fmtDayYear(d.day)}</td>
                  <td>
                    <div className="xl-bar-cell">
                      <span className="xl-bar" style={{ width: `${(d.visitors / maxVisitors) * 100}%` }} aria-hidden="true" />
                      <span>{nf.format(d.visitors)}</span>
                    </div>
                  </td>
                  <td>{nf.format(d.pageviews)}</td>
                  <td>{nf.format(d.newUsers)}</td>
                  <td>{nf.format(d.attempts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="xl-small xl-muted" role="status">
            Halaman {page} dari {pages} ({nf.format(totalDays)} hari)
          </span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Lebih baru
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Lebih lama
            </button>
          </div>
        </div>
      )}
    </>
  );
}

interface HardExercises {
  hard: { slug: string; title: string; attempts: number; correct: number; rate: number }[];
  note: string;
}

export function AdminDashboard() {
  const hard = useAsync((s) => api.get<HardExercises>('/admin/stats/hard', s), []);
  const placement = useAsync((s) => api.get<PlacementStats>('/admin/stats/placement', s), []);
  const program = useAsync((s) => api.get<ProgramStatus>('/program/status', s), []);
  const data = useAsync(
    async (s) => ({
      stats: await api.get<Stats>('/admin/stats', s),
      usage: await api.get<Usage>('/admin/stats/usage', s),
    }),
    [],
  );
  if (data.loading) return <Loading label="Memuat statistik…" />;
  if (data.error || !data.data) return <ErrorState message={data.error ?? 'Statistik tidak tersedia.'} onRetry={data.reload} />;
  const { stats, usage } = data.data;

  return (
    <>
      <h2 className="h5">Ringkasan</h2>
      <dl className="xl-stats">
        <Stat label="Pengguna terdaftar" value={stats.users} hint={`${nf.format(usage.week.newUsers)} baru dalam 7 hari`} />
        <Stat label="Pengunjung hari ini" value={usage.today.visitors} hint="unik per hari" />
        <Stat label="Pengunjung 7 hari" value={usage.week.visitors} hint="jumlah pengunjung harian" />
        {usage.total && (
          <Stat
            label="Pengunjung total"
            value={usage.total.visitors}
            hint={usage.total.since ? `sejak ${fmtSince(usage.total.since)}, jumlah pengunjung harian` : 'jumlah pengunjung harian'}
          />
        )}
        <Stat label="Halaman dibuka (7 hari)" value={usage.week.pageviews} />
        {usage.total && <Stat label="Halaman dibuka (total)" value={usage.total.pageviews} />}
        <Stat label="Percobaan latihan, akun (7 hari)" value={usage.week.attempts} />
        <Stat label="Percobaan latihan, akun (total)" value={stats.attempts} />
        <Stat
          label="Tes penempatan selesai"
          value={placement.data?.total ?? 0}
          hint={placement.data ? `${nf.format(placement.data.withAccount)} dari akun, sisanya tanpa akun` : undefined}
        />
        <Stat label="Latihan diselesaikan (akun)" value={stats.completions} />
        <Stat label="Pelajaran diselesaikan (akun)" value={stats.lessonCompletions} />
      </dl>

      <h2 className="h5">Aktivitas harian</h2>
      <DailyTable usage={usage} />
      <p className="xl-small xl-muted mt-2">{usage.note}</p>
      <p>
        <a className="btn btn-outline-secondary btn-sm" href={apiUrl('/admin/stats/usage.csv')} download>
          Unduh statistik (CSV, 90 hari)
        </a>
      </p>

      <div className="row g-4 mt-1">
        <div className="col-12 col-lg-6">
          <h2 className="h5">Halaman paling banyak dibuka (7 hari)</h2>
          {usage.topPages.length === 0 ? (
            <EmptyState title="Belum ada data kunjungan" />
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table">
                <thead>
                  <tr>
                    <th scope="col">Halaman</th>
                    <th scope="col">Dibuka</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.topPages.map((p) => (
                    <tr key={p.page}>
                      <td>
                        <code>{p.page}</code>
                      </td>
                      <td>{nf.format(p.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="col-12 col-lg-6">
          <h2 className="h5">Latihan paling sering dicoba (akun)</h2>
          {stats.exerciseUsage.length === 0 ? (
            <EmptyState title="Belum ada data percobaan" />
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table">
                <thead>
                  <tr>
                    <th scope="col">Latihan</th>
                    <th scope="col">Percobaan</th>
                    <th scope="col">Benar</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.exerciseUsage.map((u) => (
                    <tr key={u.slug}>
                      <td>{u.title}</td>
                      <td>{nf.format(u.attempts)}</td>
                      <td>{u.attempts ? Math.round((u.correct / u.attempts) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-12 col-lg-4">
          <h2 className="h5">Sumber kunjungan (7 hari)</h2>
          {(usage.sources ?? []).length === 0 ? (
            <EmptyState title="Belum ada data sumber">Mulai tercatat dari kunjungan baru setelah fitur ini aktif.</EmptyState>
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table">
                <thead>
                  <tr>
                    <th scope="col">Sumber</th>
                    <th scope="col">Pengunjung</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage.sources ?? []).map((x) => (
                    <tr key={x.source}>
                      <td>{x.source}</td>
                      <td>{nf.format(x.visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="xl-small xl-muted mt-2">
            Hanya asal kunjungan pertama tiap pengunjung per hari. Tautan dengan ?utm_source=nama dicatat dengan nama itu.
          </p>
        </div>
        <div className="col-12 col-lg-4">
          <h2 className="h5">Pemakaian fitur (7 hari)</h2>
          {(usage.features ?? []).length === 0 ? (
            <EmptyState title="Belum ada pemakaian tercatat" />
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table">
                <thead>
                  <tr>
                    <th scope="col">Fitur</th>
                    <th scope="col">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage.features ?? []).map((x) => (
                    <tr key={x.feature}>
                      <td>{featureName(x.feature)}</td>
                      <td>{nf.format(x.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="col-12 col-lg-4">
          <h2 className="h5">Alamat tidak ditemukan (7 hari)</h2>
          {(usage.notFound ?? []).length === 0 ? (
            <EmptyState title="Tidak ada alamat 404 tercatat" />
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table">
                <thead>
                  <tr>
                    <th scope="col">Alamat</th>
                    <th scope="col">Dibuka</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage.notFound ?? []).map((x) => (
                    <tr key={x.path}>
                      <td>
                        <code>{x.path}</code>
                      </td>
                      <td>{nf.format(x.hits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="xl-small xl-muted mt-2">Alamat yang sering muncul di sini bisa jadi tautan rusak atau pemindai bot.</p>
        </div>
      </div>

      {program.data && program.data.enabled && (
        <aside className="xl-panel xl-panel-body mt-4" aria-label="Program Perintis">
          <h2 className="h5">Program Perintis</h2>
          <p className="mb-0">
            {nf.format(program.data.taken)} dari {nf.format(program.data.quota)} sertifikat sudah diklaim, tersisa{' '}
            {nf.format(program.data.remaining)}. {program.data.open ? 'Program masih dibuka.' : 'Kuota sudah habis.'} Angka ini tidak
            ditampilkan ke pengunjung selama belum ada yang klaim.
          </p>
        </aside>
      )}

      <h2 className="h5 mt-4">Latihan yang paling sering gagal</h2>
      {hard.error && <ErrorState message={hard.error} onRetry={hard.reload} />}
      {hard.data && hard.data.hard.length === 0 && <EmptyState title="Belum ada latihan yang bermasalah">{hard.data.note}</EmptyState>}
      {hard.data && hard.data.hard.length > 0 && (
        <>
          <div className="xl-table-wrap">
            <table className="xl-table">
              <thead>
                <tr>
                  <th scope="col">Latihan</th>
                  <th scope="col">Percobaan</th>
                  <th scope="col">Rasio benar</th>
                </tr>
              </thead>
              <tbody>
                {hard.data.hard.map((h) => (
                  <tr key={h.slug}>
                    <td>
                      {h.title} <code>{h.slug}</code>
                    </td>
                    <td>{nf.format(h.attempts)}</td>
                    <td>{Math.round(h.rate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="xl-small xl-muted mt-2">
            {hard.data.note} Periksa petunjuk dan penjelasan latihan ini di tab Latihan; mungkin instruksinya kurang jelas.
          </p>
        </>
      )}

      <PlacementSection />
      <p className="xl-small xl-muted mt-2">
        Tes penempatan terbuka tanpa akun; pengunjung tanpa akun tersimpan tanpa nama, IP, atau data perangkat. {stats.note}
      </p>
    </>
  );
}

interface UserRow {
  id: number;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  createdAt: string | null;
  lastLoginAt: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  points: number;
  exercisesDone: number;
  lessonsDone: number;
  lastActive: string | null;
  premium: boolean;
  premiumUntil: string | null;
}

const PAGE_SIZE = 25;

export function AdminUsers() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const list = useAsync(
    async (s) => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (applied) qs.set('q', applied);
      return api.page<UserRow>(`/admin/users?${qs.toString()}`, s);
    },
    [page, applied],
  );

  const [premiumError, setPremiumError] = useState<string | null>(null);
  const setPremium = async (u: UserRow, months: number): Promise<void> => {
    setPremiumError(null);
    try {
      await api.put(`/admin/users/${u.id}/premium`, { months });
      list.reload();
    } catch (e) {
      setPremiumError(errorMessage(e));
    }
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setPage(1);
    setApplied(q.trim());
  };

  const total = list.data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <h2 className="h4 mb-0">Pengguna terdaftar{list.data ? ` (${nf.format(total)})` : ''}</h2>
        <form onSubmit={submit} role="search" aria-label="Cari pengguna" className="d-flex gap-2">
          <div>
            <label htmlFor="user-q" className="visually-hidden">
              Cari nama atau email
            </label>
            <input
              id="user-q"
              type="search"
              className="form-control"
              placeholder="Cari nama atau email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-outline-secondary">
            Cari
          </button>
        </form>
      </div>
      <p className="xl-small xl-muted">
        Daftar ini memuat email pengguna (data pribadi). Gunakan hanya untuk mengelola layanan.{' '}
        <a href={apiUrl('/admin/users.csv')} download>
          Unduh CSV pengguna
        </a>
      </p>

      {list.loading && <Loading />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {premiumError && (
        <Status tone="error" live>
          {premiumError}
        </Status>
      )}
      {list.data && list.data.data.length === 0 && (
        <EmptyState title={applied ? 'Pengguna tidak ditemukan' : 'Belum ada pengguna terdaftar'} />
      )}
      {list.data && list.data.data.length > 0 && (
        <>
          <div className="xl-table-wrap">
            <table className="xl-table">
              <caption className="visually-hidden">Daftar pengguna terdaftar</caption>
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  <th scope="col">Email</th>
                  <th scope="col">Daftar</th>
                  <th scope="col">Terakhir masuk</th>
                  <th scope="col">Terakhir aktif</th>
                  <th scope="col">Poin</th>
                  <th scope="col">Latihan</th>
                  <th scope="col">Pelajaran</th>
                  <th scope="col">Masuk dengan</th>
                  <th scope="col">Premium</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.displayName} {u.role === 'admin' && <span className="xl-small fw-semibold text-success">(admin)</span>}
                    </td>
                    <td>
                      {u.email}{' '}
                      {u.emailVerified && (
                        <span className="xl-small text-success" title="Email terverifikasi lewat kode">
                          ✓ terverifikasi
                        </span>
                      )}
                    </td>
                    <td className="text-nowrap">{fmtDateTime(u.createdAt)}</td>
                    <td className="text-nowrap">{fmtDateTime(u.lastLoginAt)}</td>
                    <td className="text-nowrap">{u.lastActive ?? '-'}</td>
                    <td>{nf.format(u.points)}</td>
                    <td>{u.exercisesDone}</td>
                    <td>{u.lessonsDone}</td>
                    <td>{u.hasPassword ? 'Kata sandi' : 'Kode email atau Google'}</td>
                    <td className="text-nowrap">
                      {u.role === 'admin' ? (
                        '-'
                      ) : (
                        <>
                          {u.premium && u.premiumUntil ? (
                            <span className="xl-small d-block">sampai {fmtDateTime(u.premiumUntil).split(',')[0]}</span>
                          ) : (
                            <span className="xl-small xl-muted d-block">Gratis</span>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm me-1"
                            aria-label={`Aktifkan Premium 12 bulan untuk ${u.email}`}
                            onClick={() => void setPremium(u, 12)}
                          >
                            +12 bln
                          </button>
                          {u.premium && (
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              aria-label={`Cabut Premium ${u.email}`}
                              onClick={() => void setPremium(u, 0)}
                            >
                              Cabut
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="xl-small xl-muted" role="status">
              Halaman {page} dari {pages}
            </span>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Sebelumnya
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
