import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_PROGRESS, MODULES, STUDENT, mockApi, renderApp } from './testutil';

const ANON = { 'GET /auth/me': { user: null, csrfToken: null } };
const base = {
  'GET /modules': MODULES,
  'POST /track': { counted: true },
  'GET /progress': EMPTY_PROGRESS,
  'GET /progress/review-due': { due: [], upcoming: 0 },
  'GET /auth/config': { emailEnabled: false, googleClientId: null, premium: { priceLabel: '', contactUrl: null } },
};
const pub = { enabled: true, open: true, quota: 100, taken: 37, remaining: 63, minExercises: 5 };
const reqs = (done: [boolean, boolean, boolean], have = 2) => [
  { key: 'placement', label: 'Selesaikan tes penempatan saat masuk akun', done: done[0], to: '/tes-penempatan' },
  { key: 'sprint', label: 'Selesaikan satu ronde Sprint 60 detik saat masuk akun', done: done[1], to: '/sprint' },
  { key: 'exercises', label: 'Selesaikan 5 latihan', done: done[2], progress: { have, need: 5 }, to: '/latihan' },
];
const loggedIn = { ...base, 'GET /auth/me': { user: STUDENT, csrfToken: 'tok' } };

afterEach(() => vi.unstubAllGlobals());

describe('halaman Program Perintis', () => {
  it('pengunjung melihat kuota dan syarat, diajak daftar, tanpa tombol klaim', async () => {
    mockApi({ ...base, ...ANON, 'GET /program/status': pub });
    renderApp('/program');
    expect(await screen.findByRole('heading', { name: /100 sertifikat gratis/ })).toBeInTheDocument();
    expect(screen.getByText(/37 dari 100 sertifikat sudah diklaim/)).toBeInTheDocument();
    expect(screen.getByText('63')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Kuota/ })).toHaveAttribute('aria-valuenow', '37');
    expect(screen.getByRole('link', { name: 'Daftar gratis' })).toHaveAttribute('href', '/daftar');
    expect(screen.queryByRole('button', { name: /Klaim sertifikat/ })).not.toBeInTheDocument();
  });

  it('pengguna melihat syarat yang belum selesai dengan tautan mengerjakan, dan klaim dinonaktifkan', async () => {
    mockApi({ ...loggedIn, 'GET /program/status': { ...pub, requirements: reqs([true, false, false]), eligible: false, claim: null } });
    renderApp('/program');
    const list = await screen.findByRole('list', { name: '' }).catch(() => null);
    void list;
    expect(await screen.findByText(/Selesaikan satu ronde Sprint/)).toBeInTheDocument();
    expect(screen.getByText('2 dari 5')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Kerjakan' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/sprint', '/latihan']);
    expect(screen.getByRole('button', { name: /Klaim sertifikat/ })).toBeDisabled();
  });

  it('semua syarat terpenuhi: klaim berhasil lalu muncul nomor Perintis dan tautan unduh', async () => {
    let claimed = false;
    const claim = { slot: 38, code: 'ABCDEF0123456789', claimedAt: '2026-10-21T03:00:00.000Z' };
    const fetchMock = mockApi({
      ...loggedIn,
      'GET /program/status': () => ({
        body: { data: { ...pub, taken: claimed ? 38 : 37, requirements: reqs([true, true, true], 5), eligible: true, claim: claimed ? claim : null } },
      }),
      'POST /program/claim': () => {
        claimed = true;
        return { body: { data: {} } };
      },
    });
    renderApp('/program');
    const btn = await screen.findByRole('button', { name: /Klaim sertifikat/ });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(await screen.findByText(/kamu Perintis ke-38/)).toBeInTheDocument();
    const dl = screen.getByRole('link', { name: /Unduh sertifikat/ });
    expect(dl).toHaveAttribute('href', '/api/program/certificate');
    expect(dl).toHaveAttribute('download');
    expect(screen.getByRole('link', { name: 'Halaman verifikasi' })).toHaveAttribute('href', `/sertifikat/${claim.code}`);
    expect(screen.queryByRole('button', { name: /Klaim sertifikat/ })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/program/claim') && (c[1] as RequestInit).method === 'POST')).toBe(true);
  });

  it('galat dari server (mis. kuota habis saat klaim) ditampilkan', async () => {
    mockApi({
      ...loggedIn,
      'GET /program/status': { ...pub, requirements: reqs([true, true, true], 5), eligible: true, claim: null },
      'POST /program/claim': () => ({ status: 409, body: { error: { code: 'CONFLICT', message: 'Kuota Program Perintis sudah habis.' } } }),
    });
    renderApp('/program');
    await userEvent.click(await screen.findByRole('button', { name: /Klaim sertifikat/ }));
    expect(await screen.findByText('Kuota Program Perintis sudah habis.')).toBeInTheDocument();
  });

  it('kuota habis: pesan jelas dan tidak ada tombol klaim bagi yang belum klaim', async () => {
    mockApi({
      ...loggedIn,
      'GET /program/status': { ...pub, open: false, taken: 100, remaining: 0, requirements: reqs([true, true, true], 5), eligible: true, claim: null },
    });
    renderApp('/program');
    expect(await screen.findByText(/Kuota sudah habis, terima kasih/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Klaim sertifikat/ })).not.toBeInTheDocument();
  });

  it('yang sudah klaim tetap bisa mengunduh walau kuota sudah habis', async () => {
    mockApi({
      ...loggedIn,
      'GET /program/status': {
        ...pub,
        open: false,
        taken: 100,
        remaining: 0,
        requirements: reqs([true, true, true], 5),
        eligible: true,
        claim: { slot: 12, code: 'AAAABBBBCCCCDDDD', claimedAt: '2026-10-21T03:00:00.000Z' },
      },
    });
    renderApp('/program');
    expect(await screen.findByText(/kamu Perintis ke-12/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Unduh sertifikat/ })).toBeInTheDocument();
    expect(screen.queryByText(/Kuota sudah habis, terima kasih/)).not.toBeInTheDocument();
  });
});

describe('banner Program Perintis di beranda', () => {
  const home = {
    ...base,
    ...ANON,
    'GET /public/overview': {
      counts: { modules: 8, lessons: 30, exercises: 54, shortcuts: 53, worksheets: 10, functions: 33 },
      modules: [
        { slug: 'mengenal-excel', title: 'Mengenal Excel', summary: 'Workbook dan sel.', lessons: 3, exercises: 3 },
        { slug: 'rumus-dasar', title: 'Rumus Dasar', summary: 'SUM dan kawan-kawan.', lessons: 6, exercises: 12 },
      ],
    },
    'GET /public/lessons': [
      { slug: 'fungsi-sum', title: 'SUM: Menjumlahkan Angka', summary: 'Jumlahkan rentang', minutes: 8, moduleTitle: 'Rumus Dasar' },
    ],
  };

  it('tampil dengan sisa kuota dan tautan ke halaman program selama kuota masih ada', async () => {
    mockApi({ ...home, 'GET /program/status': pub });
    renderApp('/');
    const banner = await screen.findByRole('complementary', { name: 'Program Perintis' });
    expect(within(banner).getByText(/Sertifikat gratis untuk 100 pengguna pertama/)).toBeInTheDocument();
    expect(within(banner).getByText('63')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Lihat syarat' })).toHaveAttribute('href', '/program');
  });

  it('hilang ketika kuota habis', async () => {
    mockApi({ ...home, 'GET /program/status': { ...pub, open: false, taken: 100, remaining: 0 } });
    renderApp('/');
    // Beranda sudah selesai dimuat bila kartu paket tampil; banner tidak boleh ada setelahnya.
    await waitFor(() => expect(screen.getByRole('heading', { name: /Belajarnya gratis/ })).toBeInTheDocument());
    expect(screen.queryByRole('complementary', { name: 'Program Perintis' })).not.toBeInTheDocument();
  });

  it('ada tautan "Sertifikat gratis" di menu utama', async () => {
    mockApi({ ...home, 'GET /program/status': pub });
    renderApp('/tentang');
    const nav = await screen.findByRole('navigation', { name: 'Navigasi utama' }).catch(() => null);
    void nav;
    const links = await screen.findAllByRole('link', { name: 'Sertifikat gratis' });
    expect(links[0]).toHaveAttribute('href', '/program');
  });
});
