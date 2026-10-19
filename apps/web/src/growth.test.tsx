import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { placementQuestions } from '@excellab/shared';
import { EMPTY_PROGRESS, MODULES, STUDENT, mockApi, renderApp } from './testutil';

const ANON = { 'GET /auth/me': { user: null, csrfToken: null } };
const CONFIG = {
  emailEnabled: false,
  googleClientId: 'klien-uji.apps.googleusercontent.com',
  premium: { priceLabel: 'Rp 29.000 untuk 12 bulan', contactUrl: 'https://wa.me/6281234567890' },
};
const base = {
  'GET /modules': MODULES,
  'POST /track': { counted: true },
  'POST /placement': () => ({ status: 201, body: { data: { saved: true } } }),
  'GET /progress': EMPTY_PROGRESS,
  'GET /progress/review-due': { due: [], upcoming: 0 },
};

afterEach(() => {
  delete (window as { google?: unknown }).google;
  vi.unstubAllGlobals();
});

describe('login dengan Google', () => {
  const stubGoogle = () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    (window as { google?: unknown }).google = { accounts: { id: { initialize, renderButton } } };
    return { initialize, renderButton };
  };

  it('tombol tampil di halaman masuk dan daftar bila server mengirim Client ID', async () => {
    const g = stubGoogle();
    mockApi({ ...base, ...ANON, 'GET /auth/config': CONFIG });
    const login = renderApp('/masuk');
    await screen.findByTestId('google-signin');
    await waitFor(() => expect(g.renderButton).toHaveBeenCalled());
    expect(g.initialize.mock.calls[0]![0].client_id).toBe(CONFIG.googleClientId);
    login.unmount();

    renderApp('/daftar');
    await screen.findByTestId('google-signin');
  });

  it('tanpa Client ID tombol tidak tampil dan form email/kata sandi tetap ada', async () => {
    stubGoogle();
    mockApi({ ...base, ...ANON, 'GET /auth/config': { ...CONFIG, googleClientId: null } });
    renderApp('/masuk');
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByTestId('google-signin')).not.toBeInTheDocument();
  });

  it('token dikirim ke server dan pengguna masuk ke halaman Kemajuan', async () => {
    const g = stubGoogle();
    const fetchMock = mockApi({
      ...base,
      ...ANON,
      'GET /auth/config': CONFIG,
      'POST /auth/google': () => ({ body: { data: { user: STUDENT, csrfToken: 'tok', isNew: false } } }),
    });
    renderApp('/masuk');
    await waitFor(() => expect(g.initialize).toHaveBeenCalled());
    g.initialize.mock.calls.at(-1)![0].callback({ credential: 'token-dari-google' });
    expect(await screen.findByRole('heading', { name: 'Kemajuan belajarmu' }, { timeout: 10000 })).toBeInTheDocument();
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/auth/google'))!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ credential: 'token-dari-google' });
  });

  it('galat dari server ditampilkan tanpa masuk', async () => {
    const g = stubGoogle();
    mockApi({
      ...base,
      ...ANON,
      'GET /auth/config': CONFIG,
      'POST /auth/google': () => ({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'x' } } }),
    });
    renderApp('/masuk');
    await waitFor(() => expect(g.initialize).toHaveBeenCalled());
    g.initialize.mock.calls.at(-1)![0].callback({ credential: 'rusak' });
    expect(await screen.findByText(/Login dengan Google gagal/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kemajuan belajarmu' })).not.toBeInTheDocument();
  });
});

describe('halaman Premium', () => {
  const free = { ...base, 'GET /auth/config': CONFIG, 'GET /auth/me': { user: STUDENT, csrfToken: 'tok' } };

  it('pengunjung diajak masuk dulu', async () => {
    mockApi({ ...base, ...ANON, 'GET /auth/config': CONFIG });
    renderApp('/premium');
    expect(await screen.findByText(/Masuk dulu agar Premium bisa dikaitkan/)).toBeInTheDocument();
    expect(screen.getByText('Rp 29.000 untuk 12 bulan')).toBeInTheDocument();
  });

  it('pengguna gratis melihat cara aktivasi dengan emailnya dan tautan WhatsApp berisi pesan', async () => {
    mockApi(free);
    renderApp('/premium');
    expect(await screen.findByText(STUDENT.email)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Hubungi pengelola' });
    const href = link.getAttribute('href')!;
    expect(href).toContain('https://wa.me/6281234567890?text=');
    expect(decodeURIComponent(href)).toContain(STUDENT.email);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/Belum ada pembayaran otomatis/)).toBeInTheDocument();
  });

  it('tanpa kontak dikonfigurasi, ada petunjuk umum', async () => {
    mockApi({ ...free, 'GET /auth/config': { ...CONFIG, premium: { priceLabel: '', contactUrl: null } } });
    renderApp('/premium');
    expect(await screen.findByText(/Hubungi pengelola lewat saluran/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hubungi pengelola' })).not.toBeInTheDocument();
  });

  it('pengguna Premium melihat status aktif dan tanggal berakhir', async () => {
    mockApi({
      ...free,
      'GET /auth/me': { user: { ...STUDENT, premium: true, premiumUntil: '2027-10-19T03:00:00.000Z' }, csrfToken: 'tok' },
    });
    renderApp('/premium');
    expect(await screen.findByText('Premium aktif')).toBeInTheDocument();
    expect(screen.getByText(/19 Oktober 2027/)).toBeInTheDocument();
    expect(screen.queryByText('Cara mengaktifkan')).not.toBeInTheDocument();
  });

  it('kunci jawaban worksheet mengarah ke Premium untuk pengguna gratis', async () => {
    const ws = {
      slug: 'anggaran-bulanan',
      title: 'Anggaran Pribadi Bulanan',
      description: 'd',
      objective: 'o',
      difficulty: 'mudah',
      skills: ['SUM'],
      instructions: ['Isi'],
      fileSize: 1000,
      available: true,
      keyAvailable: true,
      keySize: 2000,
      preview: null,
    };
    mockApi({ ...free, 'GET /worksheets/anggaran-bulanan': ws });
    renderApp('/worksheet/anggaran-bulanan');
    const key = await screen.findByRole('link', { name: /Kunci jawaban \(Premium\)/ });
    expect(key).toHaveAttribute('href', '/premium');
    expect(key).not.toHaveAttribute('download');
  });
});

describe('bagikan hasil tes penempatan', () => {
  const answerAll = async (wrong: string[] = []): Promise<void> => {
    for (const q of placementQuestions) {
      const idx = wrong.includes(q.id) ? (q.answerIndex + 1) % q.options.length : q.answerIndex;
      await userEvent.click(document.getElementById(`${q.id}-${idx}`)!);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Lihat hasil' }));
  };

  it('menampilkan level dan tautan WhatsApp berisi skor dan level, tanpa nama', async () => {
    mockApi({ ...base, ...ANON });
    renderApp('/tes-penempatan');
    await screen.findByRole('button', { name: 'Lihat hasil' });
    await answerAll(['p6']); // salah di modul logika -> Menengah
    const panel = await screen.findByLabelText('Bagikan hasil');
    expect(within(panel).getByText(/Level kamu: Menengah/)).toBeInTheDocument();
    const wa = within(panel).getByRole('link', { name: 'Bagikan ke WhatsApp' });
    const href = wa.getAttribute('href')!;
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(href.replace('https://wa.me/?text=', ''));
    expect(text).toContain(`${placementQuestions.length - 1}/${placementQuestions.length}`);
    expect(text).toContain('level Menengah');
    expect(text).toContain('/tes-penempatan');
    expect(wa).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('semua benar = Mahir; tombol salin menaruh teks di clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    mockApi({ ...base, ...ANON });
    renderApp('/tes-penempatan');
    await screen.findByRole('button', { name: 'Lihat hasil' });
    await answerAll();
    expect(await screen.findByText(/Level kamu: Mahir/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salin teks' }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]![0]).toContain('level Mahir');
    expect(await screen.findByRole('button', { name: 'Tersalin' })).toBeInTheDocument();
  });
});

describe('admin: aktivasi Premium', () => {
  it('tombol +12 bln memanggil API dan memuat ulang daftar', async () => {
    const admin = { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin', emailVerified: true, premium: true };
    let premium = false;
    const user = () => ({
      id: 9,
      email: 'siswa@example.com',
      displayName: 'Siswa',
      role: 'user',
      createdAt: '2026-10-01T00:00:00.000Z',
      lastLoginAt: null,
      emailVerified: true,
      hasPassword: true,
      points: 0,
      exercisesDone: 0,
      lessonsDone: 0,
      lastActive: null,
      premium,
      premiumUntil: premium ? '2027-10-19T00:00:00.000Z' : null,
    });
    const fetchMock = mockApi({
      ...base,
      'GET /auth/me': { user: admin, csrfToken: 'x' },
      'GET /admin/users': () => ({ body: { data: [user()], meta: { page: 1, pageSize: 25, total: 1 } } }),
      'PUT /admin/users/9/premium': () => {
        premium = true;
        return { body: { data: { premiumUntil: '2027-10-19T00:00:00.000Z' } } };
      },
    });
    renderApp('/admin/pengguna');
    await userEvent.click(await screen.findByRole('button', { name: /Aktifkan Premium 12 bulan untuk siswa@example.com/ }));
    expect(await screen.findByRole('button', { name: /Cabut Premium siswa@example.com/ })).toBeInTheDocument();
    const put = fetchMock.mock.calls.find((c) => String(c[0]).includes('/premium'))!;
    expect(JSON.parse((put[1] as RequestInit).body as string)).toEqual({ months: 12 });
  });
});
