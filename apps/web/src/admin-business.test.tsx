import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, mockApi, renderApp } from './testutil';

const ADMIN = { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin', emailVerified: true, premium: true };
const daily = Array.from({ length: 14 }, (_, i) => ({
  day: `2026-10-${String(11 + i).padStart(2, '0')}`,
  visitors: i,
  pageviews: i * 2,
  newUsers: 0,
  attempts: 0,
  anonAttempts: 0,
  anonCorrect: 0,
}));
const base = {
  'GET /auth/me': { user: ADMIN, csrfToken: 'x' },
  'GET /progress': EMPTY_PROGRESS,
  'GET /progress/review-due': { due: [], upcoming: 0 },
};

const STATS = { users: 42, admins: 1, attempts: 100, completions: 30, lessonCompletions: 20, publishedLessons: 38, publishedExercises: 70, exerciseUsage: [], attemptsPerDay: [], note: 'Statistik akun.' };
const USAGE = {
  daily,
  today: daily[13],
  week: { visitors: 80, pageviews: 300, newUsers: 5, attempts: 7, anonAttempts: 0, anonCorrect: 0 },
  topPages: [],
  anonymousExercises: [],
  sources: [
    { source: 'Instagram', visitors: 12 },
    { source: 'Threads', visitors: 7 },
  ],
  features: [
    { feature: 'template:stok-barang', count: 4 },
    { feature: 'cheatsheet:logika', count: 2 },
    { feature: 'laporan-kemajuan', count: 3 },
  ],
  notFound: [{ path: '/ads.txt', hits: 9 }],
  note: 'Catatan.',
};
const dashboard = {
  ...base,
  'GET /admin/stats': STATS,
  'GET /admin/stats/usage': USAGE,
  'GET /admin/stats/hard': { hard: [], note: '' },
  'GET /admin/stats/placement': { total: 0, averageScore: null, withAccount: 0, byStartModule: [], recent: [] },
  'GET /admin/stats/activity': {
    signups: { d1: 1, d7: 6, d30: 21 },
    active: { d1: 3, d7: 10, d30: 25 },
    total: 100,
    note: 'Aktif berarti akun yang mengerjakan latihan.',
  },
  'GET /admin/stats/datasets': {
    days: 30,
    datasetTotal: 50,
    downloads: 37,
    distinctDownloaded: 9,
    checks: 4,
    worksheetChecks: 2,
    formats: { xlsx: 30, csv: 7 },
    byField: [
      { field: 'keuangan', downloads: 20 },
      { field: 'hrd', downloads: 17 },
    ],
    top: [{ slug: 'kas-kecil', title: 'Kas Kecil', field: 'keuangan', downloads: 20, checks: 3 }],
    note: 'Catatan data latihan.',
  },
};

describe('ringkasan admin: sumber, fitur, 404, dan Perintis', () => {
  it('menampilkan sumber kunjungan, pemakaian fitur dengan nama yang mudah dibaca, dan alamat 404', async () => {
    mockApi({ ...dashboard, 'GET /program/status': { enabled: true, open: true, quota: 100, taken: 0, remaining: 100, minExercises: 5 } });
    renderApp('/admin');
    const sumber = await screen.findByRole('heading', { name: /Sumber kunjungan/ });
    const table = sumber.parentElement!.querySelector('table')!;
    expect(within(table).getByText('Instagram')).toBeInTheDocument();
    expect(within(table).getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Unduh template: stok barang')).toBeInTheDocument();
    expect(screen.getByText('Unduh contekan PDF: logika')).toBeInTheDocument();
    expect(screen.getByText('Laporan kemajuan dibuka')).toBeInTheDocument();
    expect(screen.getByText('/ads.txt')).toBeInTheDocument();
  });

  it('menampilkan pendaftar baru, pengguna aktif, dan statistik Data Latihan', async () => {
    mockApi({ ...dashboard, 'GET /program/status': { enabled: false, open: false, quota: 100, taken: 0, remaining: 100, minExercises: 5 } });
    renderApp('/admin');
    expect((await screen.findByText('Pendaftar baru, 30 hari')).parentElement).toHaveTextContent('21');
    expect(screen.getByText('Pendaftar baru, 30 hari').parentElement).toHaveTextContent('dari 100 akun');
    expect(screen.getByText('Aktif, 7 hari').parentElement).toHaveTextContent('10% dari semua akun');

    const heading = await screen.findByRole('heading', { name: /Data Latihan \(30 hari\)/ });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('Unduhan', { selector: 'dt' }).parentElement).toHaveTextContent('37');
    expect(screen.getByText('Unduhan', { selector: 'dt' }).parentElement).toHaveTextContent('9 dari 50 file pernah diunduh');
    expect(screen.getByText('Unduhan .csv').parentElement).toHaveTextContent('7');
    const table = screen.getByRole('table', { name: 'Data Latihan paling banyak diunduh' });
    expect(within(table).getByText('Kas Kecil')).toBeInTheDocument();
    expect(within(table).getByText('Keuangan')).toBeInTheDocument();
  });

  it('menampilkan total sejak awal berdampingan dengan angka 7 hari', async () => {
    mockApi({
      ...dashboard,
      'GET /admin/stats/usage': { ...USAGE, total: { visitors: 1234, pageviews: 5678, since: '2026-09-01' } },
      'GET /program/status': { enabled: false, open: false, quota: 100, taken: 0, remaining: 100, minExercises: 5 },
    });
    renderApp('/admin');
    const label = await screen.findByText('Pengunjung total');
    expect(label.parentElement).toHaveTextContent('1.234');
    expect(label.parentElement).toHaveTextContent('sejak 1 Sep 2026');
    expect(screen.getByText('Halaman dibuka (total)').parentElement).toHaveTextContent('5.678');
    expect(screen.getByText('Percobaan latihan, akun (total)').parentElement).toHaveTextContent('100');
  });

  it('aktivitas harian berhalaman: halaman 1 dari data ringkasan, halaman lama dimuat sesuai permintaan', async () => {
    const calls: string[] = [];
    const older = Array.from({ length: 14 }, (_, i) => ({
      day: `2026-09-${String(30 - i).padStart(2, '0')}`,
      visitors: 3,
      pageviews: 7,
      newUsers: 0,
      attempts: 0,
      anonAttempts: 0,
      anonCorrect: 0,
    }));
    mockApi({
      ...dashboard,
      // data pertama 29 hari sebelum hari terakhir di tabel (2026-10-24) -> 30 hari -> 3 halaman
      'GET /admin/stats/usage': { ...USAGE, total: { visitors: 1, pageviews: 1, since: '2026-09-25', firstDay: '2026-09-25' } },
      'GET /admin/stats/daily': (url: URL) => {
        calls.push(url.search);
        return { body: { data: older, meta: { page: 2, pageSize: 14, total: 30 } } };
      },
      'GET /program/status': { enabled: false, open: false, quota: 100, taken: 0, remaining: 100, minExercises: 5 },
    });
    renderApp('/admin');
    expect(await screen.findByText(/Halaman 1 dari 3 \(30 hari\)/)).toBeInTheDocument();
    expect(calls).toEqual([]); // halaman 1 tidak meminta data tambahan
    await userEvent.click(screen.getByRole('button', { name: 'Lebih lama' }));
    expect(await screen.findByText(/Halaman 2 dari 3/)).toBeInTheDocument();
    expect(await screen.findByText(/30 Sep 2026/)).toBeInTheDocument();
    expect(calls[0]).toContain('page=2');
    expect(calls[0]).toContain('pageSize=14');
    expect(screen.getByRole('button', { name: 'Lebih baru' })).toBeEnabled();
  });

  it('tanpa data awal dari server, tabel harian tetap satu halaman tanpa tombol', async () => {
    mockApi({ ...dashboard, 'GET /program/status': { enabled: false, open: false, quota: 100, taken: 0, remaining: 100, minExercises: 5 } });
    renderApp('/admin');
    await screen.findByRole('table', { name: /Aktivitas harian/ });
    expect(screen.queryByRole('button', { name: 'Lebih lama' })).not.toBeInTheDocument();
  });

  it('hasil tes penempatan: saringan tingkat dan akun diteruskan ke server', async () => {
    const calls: string[] = [];
    const detail = {
      total: 40,
      averageScore: 7,
      withAccount: 10,
      sampled: 40,
      legacy: 0,
      levels: { Pemula: 10, Menengah: 20, Mahir: 10 },
      hardest: [],
      moduleAccuracy: [],
      weekly: [],
      matching: 0,
      recent: [],
    };
    mockApi({
      ...dashboard,
      'GET /admin/stats/placement': (url: URL) => {
        calls.push(url.search);
        return { body: { data: detail } };
      },
      'GET /program/status': { enabled: false, open: false, quota: 100, taken: 0, remaining: 100, minExercises: 5 },
    });
    renderApp('/admin');
    expect(await screen.findByText('Sebaran tingkat')).toBeInTheDocument();
    expect(screen.getByText('50% dari 40 hasil')).toBeInTheDocument(); // Menengah 20 dari 40
    await userEvent.selectOptions(screen.getByLabelText('Tingkat'), 'Menengah');
    await waitFor(() => expect(calls.some((c) => c.includes('level=Menengah'))).toBe(true));
    await userEvent.click(screen.getByLabelText('Hanya yang punya akun'));
    await waitFor(() => expect(calls.some((c) => c.includes('level=Menengah') && c.includes('account=1'))).toBe(true));
  });

  it('kartu Perintis menampilkan angka kuota ke admin walau belum ada klaim', async () => {
    mockApi({ ...dashboard, 'GET /program/status': { enabled: true, open: true, quota: 100, taken: 0, remaining: 100, minExercises: 5 } });
    renderApp('/admin');
    const card = await screen.findByRole('complementary', { name: 'Program Perintis' });
    expect(card).toHaveTextContent('0 dari 100 sertifikat sudah diklaim, tersisa 100');
    expect(card).toHaveTextContent('tidak ditampilkan ke pengunjung');
  });

  it('tetap tampil bila server lama belum mengirim sumber, fitur, dan 404', async () => {
    const { sources: _s, features: _f, notFound: _n, ...old } = USAGE;
    mockApi({ ...dashboard, 'GET /admin/stats/usage': old, 'GET /program/status': { enabled: false, open: false, quota: 100, taken: 0, remaining: 100, minExercises: 5 } });
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: /Sumber kunjungan/ })).toBeInTheDocument();
    expect(screen.getByText('Belum ada data sumber')).toBeInTheDocument();
  });
});

const NO_PAYMENTS = { items: [], page: 1, pageSize: 20, total: 0, summary: { count: 0, amount: 0, months: 0, amount30: 0 } };

describe('halaman Premium di admin', () => {
  const PREMIUM = {
    users: 50,
    active: 5,
    rate: 0.1,
    grants: 7,
    grants30: 3,
    estimatedRevenue: 203000,
    estimatedRevenue30: 87000,
    onlineOrders: 0,
    onlineRevenue: 0,
    expiring: [{ email: 'a@example.com', name: 'Ani', until: new Date(Date.now() + 5 * 86_400_000).toISOString() }],
    recent: [{ at: '2026-10-20T03:00:00.000Z', months: 12, email: 'b@example.com' }],
    note: 'Riwayat dari log admin, batas atas.',
  };

  it('menampilkan angka, yang segera habis, dan aktivasi terbaru', async () => {
    mockApi({ ...base, 'GET /admin/stats/premium': PREMIUM, 'GET /admin/payments': NO_PAYMENTS });
    renderApp('/admin/premium');
    expect(await screen.findByText('Premium aktif')).toBeInTheDocument();
    expect(screen.getByText('10% dari 50 pengguna')).toBeInTheDocument();
    expect(screen.getByText('perkiraan Rp 87.000')).toBeInTheDocument();
    expect(screen.getByText('perkiraan Rp 203.000')).toBeInTheDocument();
    expect(screen.queryByText('Pembayaran online')).not.toBeInTheDocument();
    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText('5 hari')).toBeInTheDocument();
    expect(screen.getByText('b@example.com')).toBeInTheDocument();
    expect(screen.getByText('12 bulan')).toBeInTheDocument();
    expect(screen.getByText(/batas atas/)).toBeInTheDocument();
  });

  it('pembayaran online hanya muncul bila ada', async () => {
    mockApi({ ...base, 'GET /admin/stats/premium': { ...PREMIUM, onlineOrders: 2, onlineRevenue: 58000, expiring: [], recent: [] }, 'GET /admin/payments': NO_PAYMENTS });
    renderApp('/admin/premium');
    expect(await screen.findByText('Pembayaran online')).toBeInTheDocument();
    expect(screen.getByText('Rp 58.000')).toBeInTheDocument();
    expect(screen.getByText('Belum ada yang akan habis')).toBeInTheDocument();
    expect(screen.getByText('Belum ada aktivasi tercatat')).toBeInTheDocument();
  });
});
