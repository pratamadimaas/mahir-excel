import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, type vi } from 'vitest';
import { MODULES, mockApi, renderApp } from './testutil';

const ME_NONE = { user: null, csrfToken: null };
const USER = { id: 7, email: 'budi@example.com', displayName: 'Budi', role: 'user' as const };
const ADMIN = { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin' as const };
const PROGRESS = { completedLessons: [], exercises: {}, reviews: {}, activeDays: [], totalPoints: 0, streak: { current: 0, longest: 0 } };

const base = {
  'GET /modules': MODULES,
  'GET /exercises': () => ({ body: { data: [], meta: { page: 1, pageSize: 100, total: 0 } } }),
  'POST /track': { counted: true },
};

const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, path: string): Record<string, unknown> => {
  const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith(path));
  return JSON.parse((call![1] as RequestInit).body as string);
};

describe('login: kata sandi dan kode email', () => {
  it('bila email dinonaktifkan di server hanya form kata sandi yang tampil', async () => {
    mockApi({ ...base, 'GET /auth/me': ME_NONE, 'GET /auth/config': { emailEnabled: false } });
    renderApp('/masuk');
    expect(await screen.findByRole('form', { name: 'Form masuk dengan kata sandi' })).toBeInTheDocument();
    expect(await screen.findByText(/belum tersedia/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Kode lewat email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lupa kata sandi?' })).not.toBeInTheDocument();
  });

  it('bila email aktif: tab kode, alur dua langkah, lalu masuk dan akun baru dibuat', async () => {
    const fetchMock = mockApi({
      ...base,
      'GET /auth/me': ME_NONE,
      'GET /auth/config': { emailEnabled: true },
      'POST /auth/email/request': { sent: true, cooldownSeconds: 60 },
      'POST /auth/email/verify': { user: USER, csrfToken: 'tok', isNew: true },
      'GET /progress': PROGRESS,
    });
    renderApp('/masuk');
    const tab = await screen.findByRole('tab', { name: 'Kode lewat email' });
    expect(screen.getByRole('link', { name: 'Lupa kata sandi?' })).toHaveAttribute('href', '/lupa-sandi');
    await userEvent.click(tab);
    expect(tab).toHaveAttribute('aria-selected', 'true');

    // Validasi inline email.
    await userEvent.type(screen.getByLabelText('Email'), 'bukan-email');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByText('Masukkan alamat email yang valid.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/auth/email/request'))).toBe(false);

    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), 'budi@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByRole('form', { name: 'Masukkan kode dari email' })).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/auth/email/request')).toEqual({ email: 'budi@example.com', purpose: 'login' });
    expect(screen.getByRole('button', { name: /Kirim ulang kode \(\d+ dtk\)/ })).toBeDisabled();

    // Kode bukan 6 angka ditolak di klien.
    await userEvent.type(screen.getByLabelText('Kode 6 angka'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('Kode terdiri dari 6 angka.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Kode 6 angka'));
    await userEvent.type(screen.getByLabelText('Kode 6 angka'), '123abc456');
    expect(screen.getByLabelText('Kode 6 angka')).toHaveValue('123456'); // hanya angka, maksimal 6
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByRole('heading', { name: 'Cara memakai Mahir Excel' })).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/auth/email/verify')).toEqual({ email: 'budi@example.com', purpose: 'login', code: '123456' });
  });

  it('kode salah menampilkan pesan dari server dan tetap di langkah kode', async () => {
    mockApi({
      ...base,
      'GET /auth/me': ME_NONE,
      'GET /auth/config': { emailEnabled: true },
      'POST /auth/email/request': { sent: true, cooldownSeconds: 60 },
      'POST /auth/email/verify': () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: 'Kode salah atau sudah kedaluwarsa. Minta kode baru bila perlu.' } },
      }),
    });
    renderApp('/masuk?metode=kode');
    await userEvent.type(await screen.findByLabelText('Email'), 'budi@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim kode' }));
    await userEvent.type(await screen.findByLabelText('Kode 6 angka'), '999999');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText(/Kode salah atau sudah kedaluwarsa/)).toBeInTheDocument();
    expect(screen.getByLabelText('Kode 6 angka')).toBeInTheDocument();
  });

  it('galat dari server saat meminta kode ditampilkan (mis. dibatasi laju)', async () => {
    mockApi({
      ...base,
      'GET /auth/me': ME_NONE,
      'GET /auth/config': { emailEnabled: true },
      'POST /auth/email/request': () => ({
        status: 429,
        body: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.' } },
      }),
    });
    renderApp('/masuk?metode=kode');
    await userEvent.type(await screen.findByLabelText('Email'), 'budi@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Terlalu banyak percobaan');
  });
});

describe('lupa kata sandi', () => {
  it('meminta kode lalu mengirim kata sandi baru', async () => {
    const fetchMock = mockApi({
      ...base,
      'GET /auth/me': ME_NONE,
      'GET /auth/config': { emailEnabled: true },
      'POST /auth/email/request': { sent: true, cooldownSeconds: 60 },
      'POST /auth/email/verify': { user: USER, csrfToken: 'tok', isNew: false },
      'GET /progress': PROGRESS,
    });
    renderApp('/lupa-sandi');
    await userEvent.type(await screen.findByLabelText('Email'), 'budi@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim kode' }));
    expect(bodyOf(fetchMock, '/auth/email/request')).toEqual({ email: 'budi@example.com', purpose: 'reset' });

    await userEvent.type(await screen.findByLabelText('Kode 6 angka'), '654321');
    await userEvent.type(screen.getByLabelText('Kata sandi baru'), 'pendek');
    await userEvent.click(screen.getByRole('button', { name: 'Atur ulang dan masuk' }));
    expect(await screen.findByText('Kata sandi minimal 8 karakter.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Kata sandi baru'));
    await userEvent.type(screen.getByLabelText('Kata sandi baru'), 'sandi-baru-456');
    await userEvent.click(screen.getByRole('button', { name: 'Atur ulang dan masuk' }));
    await screen.findByRole('heading', { name: 'Cara memakai Mahir Excel' });
    expect(bodyOf(fetchMock, '/auth/email/verify')).toEqual({
      email: 'budi@example.com',
      purpose: 'reset',
      code: '654321',
      newPassword: 'sandi-baru-456',
    });
  });

  it('menampilkan peringatan bila fitur email belum aktif', async () => {
    mockApi({ ...base, 'GET /auth/me': ME_NONE, 'GET /auth/config': { emailEnabled: false } });
    renderApp('/lupa-sandi');
    expect(await screen.findByText(/belum tersedia/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kirim kode' })).not.toBeInTheDocument();
  });
});

describe('pencatatan kunjungan dari klien', () => {
  it('mengirim path halaman, tidak untuk area admin', async () => {
    const fetchMock = mockApi({ ...base, 'GET /auth/me': ME_NONE, 'GET /auth/config': { emailEnabled: false } });
    renderApp('/masuk');
    await screen.findByRole('form', { name: 'Form masuk dengan kata sandi' });
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/track'))).toBe(true));
    expect(bodyOf(fetchMock, '/track')).toEqual({ path: '/masuk' });
  });

  it('halaman admin tidak dilacak', async () => {
    const fetchMock = mockApi({
      ...base,
      'GET /auth/me': { user: ADMIN, csrfToken: 'x' },
      'GET /progress': PROGRESS,
      'GET /admin/users': () => ({ body: { data: [], meta: { page: 1, pageSize: 25, total: 0 } } }),
    });
    renderApp('/admin/pengguna');
    await screen.findByText('Belum ada pengguna terdaftar');
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/track'))).toBe(false);
  });
});

describe('admin: statistik dan pengguna', () => {
  const day = (offset: number): string => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const daily = Array.from({ length: 14 }, (_, i) => ({
    day: day(13 - i),
    visitors: i === 13 ? 12 : i,
    pageviews: i * 2,
    newUsers: i === 13 ? 3 : 0,
    attempts: 1,
    anonAttempts: 2,
    anonCorrect: 1,
  }));

  it('dasbor menampilkan pengunjung, pendaftar, halaman populer, dan hasil uji kemampuan Excel', async () => {
    mockApi({
      ...base,
      'GET /auth/me': { user: ADMIN, csrfToken: 'x' },
      'GET /progress': PROGRESS,
      'GET /admin/stats': {
        users: 42,
        admins: 1,
        attempts: 100,
        completions: 30,
        lessonCompletions: 20,
        publishedLessons: 13,
        publishedExercises: 24,
        exerciseUsage: [{ slug: 'total-pengeluaran', title: 'Total pengeluaran bulanan', attempts: 10, correct: 5 }],
        attemptsPerDay: [],
        note: 'Statistik akun.',
      },
      'GET /admin/stats/usage': {
        daily,
        today: daily[13],
        week: { visitors: 80, pageviews: 300, newUsers: 5, attempts: 7, anonAttempts: 14, anonCorrect: 7 },
        topPages: [{ page: '/belajar/fungsi-sum', views: 55 }],
        anonymousExercises: [{ slug: 'status-kelulusan', attempts: 9, correct: 4 }],
        note: 'Pengunjung unik dihitung per hari tanpa cookie.',
      },
      'GET /admin/stats/placement': {
        total: 3,
        averageScore: 9.5,
        withAccount: 1,
        sampled: 3,
        legacy: 1,
        levels: { Pemula: 1, Menengah: 1, Mahir: 1 },
        hardest: [{ id: 'p9', question: 'Pada SUMIFS, argumen yang ditulis paling awal adalah…', module: 'fungsi-bersyarat', asked: 3, wrong: 2 }],
        moduleAccuracy: [{ module: 'logika', correct: 4, total: 6 }],
        weekly: [{ week: '2026-10-12', count: 3, avgPercent: 72 }],
        matching: 2,
        recent: [
          { id: 3, score: 11, total: 12, level: 'Mahir', legacy: true, startModule: 'logika', at: '2026-10-18T03:00:00.000Z', user: null },
          {
            id: 2,
            score: 3,
            total: 5,
            level: 'Pemula',
            legacy: false,
            startModule: null,
            at: '2026-10-17T03:00:00.000Z',
            user: { displayName: 'Budi', email: 'budi@example.com' },
          },
        ],
      },
    });
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument();
    const stats = screen.getAllByRole('definition').map((d) => d.textContent);
    expect(stats).toEqual(expect.arrayContaining(['42', '80', '300']));
    expect(screen.getByText('Pengunjung hari ini')).toBeInTheDocument();
    expect(screen.getByText('/belajar/fungsi-sum')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Uji Kemampuan Excel' })).toBeInTheDocument();
    expect(await screen.findByText('Budi (budi@example.com)')).toBeInTheDocument();
    expect(screen.getAllByText('Tanpa akun').length).toBeGreaterThan(0);
    expect(screen.getByText('Sebaran tingkat')).toBeInTheDocument();
    expect(screen.getByText('Soal yang paling sering salah')).toBeInTheDocument();
    expect(screen.getByText('67% (2 dari 3)')).toBeInTheDocument();
    expect(screen.getByText('(lama)')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Aktivitas harian/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pengguna' })).toHaveAttribute('href', '/admin/pengguna');
  });

  it('daftar pengguna: baris, metode masuk, pencarian, dan paginasi', async () => {
    const calls: string[] = [];
    mockApi({
      ...base,
      'GET /auth/me': { user: ADMIN, csrfToken: 'x' },
      'GET /progress': PROGRESS,
      'GET /admin/users': (url: URL) => {
        calls.push(url.search);
        const q = url.searchParams.get('q');
        const rows = [
          {
            id: 3,
            email: 'sari@example.com',
            displayName: 'Sari',
            role: 'user',
            createdAt: '2026-10-01T03:00:00.000Z',
            lastLoginAt: '2026-10-05T03:00:00.000Z',
            emailVerified: true,
            hasPassword: false,
            points: 30,
            exercisesDone: 2,
            lessonsDone: 4,
            lastActive: '2026-10-05',
          },
          {
            id: 2,
            email: 'andi@example.com',
            displayName: 'Andi',
            role: 'user',
            createdAt: '2026-09-20T03:00:00.000Z',
            lastLoginAt: null,
            emailVerified: false,
            hasPassword: true,
            points: 0,
            exercisesDone: 0,
            lessonsDone: 0,
            lastActive: null,
          },
        ].filter((r) => !q || r.email.includes(q));
        return { body: { data: rows, meta: { page: 1, pageSize: 25, total: rows.length } } };
      },
    });
    renderApp('/admin/pengguna');
    const table = await screen.findByRole('table', { name: 'Daftar pengguna terdaftar' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText('sari@example.com')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Kode email atau Google')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/terverifikasi/)).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Kata sandi')).toBeInTheDocument();
    expect(screen.getByText('Pengguna terdaftar (2)')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Cari nama atau email'), 'andi');
    await userEvent.click(screen.getByRole('button', { name: 'Cari' }));
    await waitFor(() => expect(screen.getByText('Pengguna terdaftar (1)')).toBeInTheDocument());
    expect(calls.at(-1)).toContain('q=andi');
    expect(screen.getByText('Halaman 1 dari 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeDisabled();
  });

  it('pengguna biasa tidak melihat panel admin', async () => {
    mockApi({ ...base, 'GET /auth/me': { user: USER, csrfToken: 'x' }, 'GET /progress': PROGRESS });
    renderApp('/admin');
    expect(await screen.findByText('Halaman ini hanya untuk administrator.')).toBeInTheDocument();
  });
});
