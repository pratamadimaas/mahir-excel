import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_PROGRESS, mockApi, renderApp } from './testutil';

const ADMIN = { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin', emailVerified: true, premium: true };
const base = {
  'GET /auth/me': { user: ADMIN, csrfToken: 'x' },
  'GET /progress': EMPTY_PROGRESS,
  'GET /progress/review-due': { due: [], upcoming: 0 },
};

const NO_PAYMENTS = { items: [], page: 1, pageSize: 20, total: 0, summary: { count: 0, amount: 0, months: 0, amount30: 0 } };

describe('catatan pembayaran manual di halaman Premium', () => {
  const PREMIUM_BASE = {
    users: 50, active: 5, rate: 0.1, grants: 7, grants30: 3, estimatedRevenue: 203000, estimatedRevenue30: 87000,
    onlineOrders: 0, onlineRevenue: 0, expiring: [], recent: [], note: 'Catatan.',
  };
  const PAYMENTS = {
    items: [
      { id: 7, payer: 'ani@example.com', amount: 49000, months: 12, paidOn: '2026-10-24', note: 'transfer BCA', linkedEmail: 'ani@example.com', createdAt: '2026-10-24T03:00:00.000Z' },
      { id: 6, payer: 'Budi (WA 0812)', amount: 29000, months: 12, paidOn: '2026-10-20', note: null, linkedEmail: null, createdAt: '2026-10-20T03:00:00.000Z' },
    ],
    page: 1, pageSize: 20, total: 2,
    summary: { count: 2, amount: 78000, months: 24, amount30: 78000 },
  };

  it('menampilkan angka nyata dan daftar, terpisah dari perkiraan', async () => {
    mockApi({ ...base, 'GET /admin/stats/premium': PREMIUM_BASE, 'GET /admin/payments': PAYMENTS });
    renderApp('/admin/premium');
    const section = (await screen.findByRole('heading', { name: 'Catatan pembayaran' })).closest('section')!;
    expect(await within(section).findByText('Budi (WA 0812)')).toBeInTheDocument();
    expect(within(section).getByText('Tercatat total').parentElement).toHaveTextContent('Rp 78.000');
    expect(within(section).getByText('Tercatat total').parentElement).toHaveTextContent('2 pembayaran');
    expect(within(section).getByText('Perkiraan dari log').parentElement).toHaveTextContent('Rp 203.000');
    expect(within(section).getByText('Budi (WA 0812)')).toBeInTheDocument();
    expect(within(section).getByText('transfer BCA')).toBeInTheDocument();
    expect(within(section).getAllByText('12 bulan')).toHaveLength(2);
  });

  it('mengirim pembayaran yang diisi, mengosongkan form, dan menampilkan hasilnya', async () => {
    const posts: unknown[] = [];
    mockApi({
      ...base,
      'GET /admin/stats/premium': PREMIUM_BASE,
      'GET /admin/payments': NO_PAYMENTS,
      'POST /admin/payments': (_url: URL, init?: RequestInit) => {
        posts.push(JSON.parse(String(init?.body)));
        return { status: 201, body: { data: { id: 8 } } };
      },
    });
    renderApp('/admin/premium');
    await screen.findByRole('heading', { name: 'Catatan pembayaran' });
    await userEvent.type(screen.getByLabelText('Pembayar (email akun atau nama)'), 'ani@example.com');
    await userEvent.type(screen.getByLabelText('Nominal (Rp)'), '49000');
    await userEvent.type(screen.getByLabelText('Catatan (opsional)'), 'transfer BCA');
    await userEvent.click(screen.getByLabelText('Aktifkan Premium akun ini sekarang'));
    await userEvent.click(screen.getByRole('button', { name: 'Catat pembayaran' }));
    expect(await screen.findByText('Pembayaran dicatat dan Premium diaktifkan.')).toBeInTheDocument();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ payer: 'ani@example.com', amount: 49000, months: 12, note: 'transfer BCA', activate: true });
    expect((posts[0] as { paidOn: string }).paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByLabelText('Pembayar (email akun atau nama)')).toHaveValue('');
    expect(screen.getByLabelText('Aktifkan Premium akun ini sekarang')).not.toBeChecked();
  });

  it('menampilkan alasan penolakan dari server dan mempertahankan isian', async () => {
    mockApi({
      ...base,
      'GET /admin/stats/premium': PREMIUM_BASE,
      'GET /admin/payments': NO_PAYMENTS,
      'POST /admin/payments': () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: 'Untuk mengaktifkan Premium, isi pembayar dengan email akun yang terdaftar.' } },
      }),
    });
    renderApp('/admin/premium');
    await screen.findByRole('heading', { name: 'Catatan pembayaran' });
    await userEvent.type(screen.getByLabelText('Pembayar (email akun atau nama)'), 'Budi');
    await userEvent.type(screen.getByLabelText('Nominal (Rp)'), '29000');
    await userEvent.click(screen.getByLabelText('Aktifkan Premium akun ini sekarang'));
    await userEvent.click(screen.getByRole('button', { name: 'Catat pembayaran' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('isi pembayar dengan email akun yang terdaftar');
    expect(screen.getByLabelText('Pembayar (email akun atau nama)')).toHaveValue('Budi');
  });

  it('menghapus catatan hanya setelah dikonfirmasi', async () => {
    const calls: string[] = [];
    mockApi({
      ...base,
      'GET /admin/stats/premium': PREMIUM_BASE,
      'GET /admin/payments': PAYMENTS,
      'DELETE /admin/payments/6': () => {
        calls.push('hapus 6');
        return { body: { data: { deleted: true } } };
      },
    });
    renderApp('/admin/premium');
    const section = (await screen.findByRole('heading', { name: 'Catatan pembayaran' })).closest('section')!;
    const rowOfBudi = (await within(section).findByText('Budi (WA 0812)')).closest('tr')!;
    await userEvent.click(within(rowOfBudi).getByRole('button', { name: 'Hapus' }));
    const dialog = (await screen.findByText('Hapus catatan pembayaran?', { selector: 'h2' })).closest('dialog')!;
    expect(dialog).toHaveTextContent('Rp 29.000');
    expect(calls).toEqual([]); // belum dikonfirmasi
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hapus', hidden: true }));
    await vi.waitFor(() => expect(calls).toEqual(['hapus 6']));
  });
});

describe('halaman Pertumbuhan', () => {
  const GROWTH = {
    funnel: [
      { key: 'registered', label: 'Mendaftar', count: 40 },
      { key: 'tried', label: 'Mencoba latihan', count: 30 },
      { key: 'solved1', label: 'Menyelesaikan 1 latihan', count: 24 },
      { key: 'solved5', label: 'Menyelesaikan 5 latihan', count: 10 },
      { key: 'lesson', label: 'Menyelesaikan 1 pelajaran', count: 12 },
      { key: 'premium', label: 'Premium aktif', count: 2 },
    ],
    cohorts: [
      { day: '2026-10-24', signups: 7, day1: null, week1: null },
      { day: '2026-10-22', signups: 12, day1: 6, week1: null },
      { day: '2026-10-19', signups: 4, day1: 1, week1: 3 },
    ],
    note: 'Corong menghitung akun, bukan pengunjung.',
  };

  it('menampilkan corong dengan persen dari yang mendaftar dan dari tahap sebelumnya', async () => {
    mockApi({ ...base, 'GET /admin/stats/growth': GROWTH });
    renderApp('/admin/pertumbuhan');
    const list = await screen.findByRole('list', { name: 'Corong akun' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('Mendaftar');
    expect(items[0]).toHaveTextContent('40');
    expect(items[1]).toHaveTextContent('75% dari yang mendaftar'); // 30 dari 40
    expect(items[1]).toHaveTextContent('75% dari tahap sebelumnya');
    expect(items[3]).toHaveTextContent('25% dari yang mendaftar'); // 10 dari 40
    expect(items[3]).toHaveTextContent('42% dari tahap sebelumnya'); // 10 dari 24
    expect(items[5]).toHaveTextContent('5% dari yang mendaftar'); // 2 dari 40
    expect(items[5]).not.toHaveTextContent('tahap sebelumnya'); // bukan urutan linear
    expect(screen.getByText(/bukan pengunjung/)).toBeInTheDocument();
  });

  it('tabel retensi memakai tanda - bila jendela waktunya belum lewat', async () => {
    mockApi({ ...base, 'GET /admin/stats/growth': GROWTH });
    renderApp('/admin/pertumbuhan');
    const table = await screen.findByRole('table', { name: /Retensi per hari pendaftaran/ });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(within(rows[1]!).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Sab, 24 Okt 2026', '7', '-', '-']);
    expect(within(rows[2]!).getAllByRole('cell')[2]).toHaveTextContent('6 (50%)');
    expect(within(rows[2]!).getAllByRole('cell')[3]).toHaveTextContent('-');
    expect(within(rows[3]!).getAllByRole('cell')[2]).toHaveTextContent('1 (25%)');
    expect(within(rows[3]!).getAllByRole('cell')[3]).toHaveTextContent('3 (75%)');
  });

  it('keadaan kosong: belum ada akun dan belum ada pendaftar baru', async () => {
    mockApi({ ...base, 'GET /admin/stats/growth': { funnel: [{ key: 'registered', label: 'Mendaftar', count: 0 }], cohorts: [], note: 'x' } });
    renderApp('/admin/pertumbuhan');
    expect(await screen.findByText('Belum ada akun terdaftar')).toBeInTheDocument();
    expect(screen.getByText('Belum ada pendaftar dalam 3 minggu terakhir')).toBeInTheDocument();
  });

  it('tab Pertumbuhan ada di navigasi admin', async () => {
    mockApi({ ...base, 'GET /admin/stats/growth': GROWTH });
    renderApp('/admin/pertumbuhan');
    await screen.findByRole('list', { name: 'Corong akun' });
    expect(screen.getByRole('link', { name: 'Pertumbuhan' })).toHaveAttribute('href', '/admin/pertumbuhan');
  });
});
