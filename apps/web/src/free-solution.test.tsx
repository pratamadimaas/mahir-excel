import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EXERCISE, MODULES, SIGNED_IN, STUDENT, mockApi, renderApp } from './testutil';

const exercisesList = () => ({
  body: {
    data: [{ slug: EXERCISE.slug, title: EXERCISE.title, description: 'd', topic: 'rumus-dasar', difficulty: 'mudah', points: 10, lessonSlug: 'fungsi-sum' }],
    meta: { page: 1, pageSize: 100, total: 1 },
  },
});

const base = {
  ...SIGNED_IN,
  'GET /modules': MODULES,
  'GET /exercises': exercisesList,
  'GET /exercises/total-pengeluaran': EXERCISE,
};

const OPEN = { premium: false, available: true, nextFreeAt: null, unlocked: [] as string[] };
const USED = { premium: false, available: false, nextFreeAt: '2026-11-03T05:00:00.000Z', unlocked: ['latihan-lain'] };
const REVEAL = { explanation: 'SUM menjumlahkan.', solution: { B4: '=SUM(B2:B3)' }, pointsAwarded: 0, free: true, nextFreeAt: '2026-11-03T05:00:00.000Z' };

describe('solusi gratis seminggu sekali', () => {
  it('jatah tersedia: tombol menyebut gratis minggu ini, dialog menjelaskan pemakaian jatah, lalu solusi tampil', async () => {
    const reveal = vi.fn(() => ({ body: { data: REVEAL } }));
    mockApi({ ...base, 'GET /solution-quota': OPEN, 'POST /exercises/total-pengeluaran/reveal': reveal });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Lihat solusi \(gratis minggu ini\)/ }));
    expect(screen.getByText(/Ini memakai jatah solusi gratis minggu ini/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ya, tampilkan', hidden: true }));
    expect(await screen.findByText('=SUM(B2:B3)')).toBeInTheDocument();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('jatah terpakai: tombol biasa, klik menampilkan tanggal berikutnya dan ajakan Premium tanpa memanggil server', async () => {
    const reveal = vi.fn(() => ({ body: { data: REVEAL } }));
    mockApi({ ...base, 'GET /solution-quota': USED, 'POST /exercises/total-pengeluaran/reveal': reveal });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Lihat solusi' });
    await user.click(button);
    expect(await screen.findByText(/Jatah solusi gratis minggu ini sudah terpakai/)).toBeInTheDocument();
    expect(screen.getByText(/Jatah berikutnya tersedia 3 November 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lihat Premium' })).toHaveAttribute('href', '/premium');
    expect(reveal).not.toHaveBeenCalled();
  });

  it('solusi yang pernah dibuka bisa dibuka lagi saat jatah habis, tanpa peringatan pemakaian jatah', async () => {
    mockApi({
      ...base,
      'GET /solution-quota': { ...USED, unlocked: ['total-pengeluaran'] },
      'POST /exercises/total-pengeluaran/reveal': { ...REVEAL },
    });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Lihat solusi' }));
    expect(screen.queryByText(/memakai jatah/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ya, tampilkan', hidden: true }));
    expect(await screen.findByText('=SUM(B2:B3)')).toBeInTheDocument();
  });

  it('Premium: tombol biasa tanpa menanyakan jatah ke server', async () => {
    const fetchMock = mockApi({
      ...base,
      'GET /auth/me': { user: { ...STUDENT, premium: true }, csrfToken: 'tok' },
      'POST /exercises/total-pengeluaran/reveal': { ...REVEAL, free: false, nextFreeAt: null },
    });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Lihat solusi' }));
    expect(screen.queryByText(/memakai jatah/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ya, tampilkan', hidden: true }));
    expect((await screen.findAllByText('=SUM(B2:B3)')).length).toBeGreaterThan(0); // juga muncul di tabel perbandingan Premium
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/solution-quota'))).toBe(false);
  });

  it('server menolak (jatah terpakai di perangkat lain): galat tampil dan jatah dimuat ulang', async () => {
    let quotaCalls = 0;
    mockApi({
      ...base,
      'GET /solution-quota': () => ({ body: { data: ++quotaCalls === 1 ? OPEN : USED } }),
      'POST /exercises/total-pengeluaran/reveal': () => ({
        status: 402,
        body: { error: { code: 'PREMIUM_REQUIRED', message: 'Jatah solusi gratis minggu ini sudah terpakai.', details: { nextFreeAt: USED.nextFreeAt } } },
      }),
    });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Lihat solusi \(gratis minggu ini\)/ }));
    await user.click(screen.getByRole('button', { name: 'Ya, tampilkan', hidden: true }));
    expect(await screen.findByText('Jatah solusi gratis minggu ini sudah terpakai.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Lihat solusi' })).toBeInTheDocument();
    expect(quotaCalls).toBe(2);
  });
});

describe('laporkan soal', () => {
  it('formulir terkirim dengan alasan dan catatan, lalu menampilkan ucapan terima kasih', async () => {
    const bodies: unknown[] = [];
    mockApi({
      ...base,
      'GET /solution-quota': OPEN,
      'POST /exercises/total-pengeluaran/report': (_u: URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return { status: 201, body: { data: { id: 1, duplicate: false } } };
      },
    });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Laporkan soal ini/ }));
    const form = screen.getByRole('form', { name: 'Laporkan soal' });
    await user.selectOptions(within(form).getByLabelText('Apa masalahnya?'), 'jawaban-meragukan');
    await user.type(within(form).getByLabelText(/Catatan/), 'Hasilnya beda dengan Excel saya');
    await user.click(within(form).getByRole('button', { name: 'Kirim laporan' }));
    expect(await screen.findByText(/laporanmu sudah kami terima/)).toBeInTheDocument();
    expect(bodies).toEqual([{ reason: 'jawaban-meragukan', note: 'Hasilnya beda dengan Excel saya' }]);
  });

  it('laporan kembar dijawab dengan pesan yang ramah, bukan galat', async () => {
    mockApi({
      ...base,
      'GET /solution-quota': OPEN,
      'POST /exercises/total-pengeluaran/report': { id: 7, duplicate: true },
    });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Laporkan soal ini/ }));
    await user.click(within(screen.getByRole('form', { name: 'Laporkan soal' })).getByRole('button', { name: 'Kirim laporan' }));
    expect(await screen.findByText(/Kamu sudah melaporkan soal ini/)).toBeInTheDocument();
  });

  it('galat server tampil di formulir dan formulir tetap terbuka; Batal menutupnya', async () => {
    mockApi({
      ...base,
      'GET /solution-quota': OPEN,
      'POST /exercises/total-pengeluaran/report': () => ({ status: 429, body: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak laporan hari ini. Coba lagi besok.' } } }),
    });
    renderApp('/latihan/total-pengeluaran');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Laporkan soal ini/ }));
    const form = screen.getByRole('form', { name: 'Laporkan soal' });
    await user.click(within(form).getByRole('button', { name: 'Kirim laporan' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Terlalu banyak laporan hari ini');
    await user.click(within(form).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('form', { name: 'Laporkan soal' })).not.toBeInTheDocument();
  });
});

describe('halaman admin laporan', () => {
  const ADMIN = { ...STUDENT, id: 1, role: 'admin', premium: true, displayName: 'Admin' };
  const REPORTS = [
    { id: 11, reason: 'tidak-jelas', note: 'Petunjuknya membingungkan', createdAt: '2026-10-24T03:00:00.000Z', resolvedAt: null, exerciseSlug: 'total-pengeluaran', exerciseTitle: 'Total pengeluaran bulanan', email: 'a@example.com', openForExercise: 2 },
    { id: 12, reason: 'salah-ketik', note: null, createdAt: '2026-10-23T03:00:00.000Z', resolvedAt: '2026-10-24T01:00:00.000Z', exerciseSlug: 'total-harga-barang', exerciseTitle: 'Total harga barang', email: 'b@example.com', openForExercise: 0 },
  ];

  it('menampilkan laporan terbuka, menandai selesai, dan memuat ulang daftar', async () => {
    let done = false;
    const resolve = vi.fn(() => {
      done = true;
      return { body: { data: { id: 11, resolved: true } } };
    });
    mockApi({
      ...base,
      'GET /auth/me': { user: ADMIN, csrfToken: 'tok' },
      'GET /admin/reports': () => ({ body: { data: done ? [] : [REPORTS[0]] } }),
      'PUT /admin/reports/11/resolve': resolve,
    });
    renderApp('/admin/laporan');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Laporan soal' })).toBeInTheDocument();
    expect(await screen.findByText('Total pengeluaran bulanan')).toBeInTheDocument();
    expect(screen.getByText('Soal tidak jelas')).toBeInTheDocument();
    expect(screen.getByText('Petunjuknya membingungkan')).toBeInTheDocument();
    expect(screen.getByText('2 laporan terbuka')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tandai selesai: Total pengeluaran bulanan/ }));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Belum ada laporan')).toBeInTheDocument();
  });

  it('kotak centang menampilkan juga yang sudah selesai', async () => {
    mockApi({
      ...base,
      'GET /auth/me': { user: ADMIN, csrfToken: 'tok' },
      'GET /admin/reports': (u: URL) => ({ body: { data: u.searchParams.get('status') === 'all' ? REPORTS : [REPORTS[0]] } }),
    });
    renderApp('/admin/laporan');
    const user = userEvent.setup();
    await screen.findByText('Total pengeluaran bulanan');
    expect(screen.queryByText('Total harga barang')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Tampilkan yang sudah selesai/ }));
    expect(await screen.findByText('Total harga barang')).toBeInTheDocument();
    expect(screen.getByText('Selesai')).toBeInTheDocument();
  });
});
