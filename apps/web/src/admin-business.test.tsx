import { screen, within } from '@testing-library/react';
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
    mockApi({ ...base, 'GET /admin/stats/premium': PREMIUM });
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
    mockApi({ ...base, 'GET /admin/stats/premium': { ...PREMIUM, onlineOrders: 2, onlineRevenue: 58000, expiring: [], recent: [] } });
    renderApp('/admin/premium');
    expect(await screen.findByText('Pembayaran online')).toBeInTheDocument();
    expect(screen.getByText('Rp 58.000')).toBeInTheDocument();
    expect(screen.getByText('Belum ada yang akan habis')).toBeInTheDocument();
    expect(screen.getByText('Belum ada aktivasi tercatat')).toBeInTheDocument();
  });
});
