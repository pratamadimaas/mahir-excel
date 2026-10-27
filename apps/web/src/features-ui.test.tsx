import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, type vi } from 'vitest';
import { placementOrdered, placementQuestions } from '@excellab/shared';
import { MODULES, SIGNED_IN, mockApi, renderApp } from './testutil';

const ME_NONE = { user: null, csrfToken: null };
const USER = { id: 7, email: 'budi@example.com', displayName: 'Budi', role: 'user' as const, emailVerified: false };
const PROGRESS = { completedLessons: [], exercises: {}, reviews: {}, activeDays: [], totalPoints: 0, streak: { current: 0, longest: 0 } };

const base = {
  'GET /modules': MODULES,
  'GET /exercises': () => ({
    body: {
      data: [
        {
          slug: 'total-pengeluaran',
          title: 'Total pengeluaran bulanan',
          description: 'd',
          topic: 'rumus-dasar',
          difficulty: 'mudah',
          points: 10,
          lessonSlug: null,
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1 },
    },
  }),
  'POST /track': { counted: true },
  'POST /placement': () => ({ status: 201, body: { data: { saved: true } } }),
  'GET /auth/config': { emailEnabled: true },
};

const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, path: string): Record<string, unknown> => {
  const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith(path));
  return JSON.parse((call![1] as RequestInit).body as string);
};

describe('tes penempatan', () => {
  // Menjawab soal yang sedang tampil satu per satu sampai tes selesai; `wrong` berisi id soal yang sengaja dijawab salah.
  const runTest = async (wrong: string[] = [], maxSteps = 40): Promise<number> => {
    let steps = 0;
    while (steps < maxSteps) {
      const q = placementOrdered.find((x) => document.getElementById(`${x.id}-0`));
      if (!q) break;
      const idx = wrong.includes(q.id) ? (q.answerIndex + 1) % q.options.length : q.answerIndex;
      await userEvent.click(document.getElementById(`${q.id}-${idx}`)!);
      const btn = screen.getByRole('button', { name: /^(Lanjut|Lihat hasil)$/ });
      await userEvent.click(btn);
      steps++;
    }
    return steps;
  };

  it('satu soal per layar: Lanjut nonaktif sampai ada pilihan, Kembali membuka soal sebelumnya', async () => {
    mockApi({ ...base, 'GET /auth/me': ME_NONE });
    renderApp('/tes-penempatan');
    const next = await screen.findByRole('button', { name: 'Lanjut' });
    expect(next).toBeDisabled();
    expect(screen.getByText(/Pemula: soal 1 dari 5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kembali' })).toBeDisabled();
    // Hanya soal yang sedang tampil yang ada di layar.
    expect(document.getElementById('p2-0')).toBeNull();
    await userEvent.click(document.getElementById('p1-1')!);
    expect(next).toBeEnabled();
    await userEvent.click(next);
    expect(await screen.findByText(/Pemula: soal 2 dari 5/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kembali' }));
    expect(await screen.findByText(/Pemula: soal 1 dari 5/)).toBeInTheDocument();
  });

  it('semua benar -> level Mahir, siap modul lanjutan; hasil disimpan lokal dan dikirim ke server tanpa akun', async () => {
    const fetchMock = mockApi({ ...base, 'GET /auth/me': ME_NONE });
    renderApp('/tes-penempatan');
    await screen.findByRole('button', { name: 'Lanjut' });
    expect(await runTest()).toBe(placementQuestions.length);
    expect(await screen.findByText(`Skormu ${placementQuestions.length} dari ${placementQuestions.length} pertanyaan yang kamu jawab.`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mahir' })).toBeInTheDocument();
    expect(screen.getByText('Semua jawaban benar.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('excellab.placement.v1')!).answers.p1).toBe(1);
    expect(await screen.findByText('Skormu sudah tersimpan.')).toBeInTheDocument();
    const sent = bodyOf(fetchMock, '/placement') as { answers: Record<string, number> };
    expect(Object.keys(sent.answers)).toHaveLength(placementQuestions.length);
    // Pengunjung tanpa akun diajak mendaftar, bukan diberi tautan ke materi.
    expect(screen.getByRole('link', { name: 'Daftar gratis' })).toHaveAttribute('href', '/daftar');
  });

  it('berhenti lebih awal: tiga salah di tingkat Pemula langsung menampilkan hasil Pemula', async () => {
    const fetchMock = mockApi({ ...base, 'GET /auth/me': ME_NONE });
    renderApp('/tes-penempatan');
    await screen.findByRole('button', { name: 'Lanjut' });
    const first3 = placementOrdered.slice(0, 3).map((q) => q.id);
    expect(await runTest(first3)).toBe(3);
    expect(await screen.findByRole('heading', { name: 'Pemula' })).toBeInTheDocument();
    expect(screen.getByText('0/3 benar, belum lulus')).toBeInTheDocument();
    expect(screen.getAllByText('tidak diuji')).toHaveLength(2);
    const sent = bodyOf(fetchMock, '/placement') as { answers: Record<string, number> };
    expect(Object.keys(sent.answers)).toHaveLength(3);
  });

  it('skor yang gagal dikirim tetap menampilkan hasil dan memberi tahu', async () => {
    mockApi({
      ...base,
      'GET /auth/me': ME_NONE,
      'POST /placement': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }),
    });
    renderApp('/tes-penempatan');
    await screen.findByRole('button', { name: 'Lanjut' });
    await runTest();
    expect(await screen.findByText(/Skormu belum berhasil dicatat/)).toBeInTheDocument();
    expect(screen.getByText('Semua jawaban benar.')).toBeInTheDocument();
  });

  it('jawaban salah di modul logika: saran mulai dari modul itu, pembahasan ditampilkan, dan banner di Akademi', async () => {
    const modules = [
      ...MODULES,
      {
        slug: 'logika',
        title: 'Logika',
        summary: 's',
        sortOrder: 4,
        lessons: [{ slug: 'fungsi-if', title: 'IF: Mengambil Keputusan', summary: 's', minutes: 10, sortOrder: 1, exerciseCount: 1 }],
      },
    ];
    mockApi({ ...base, ...SIGNED_IN, 'GET /modules': modules });
    renderApp('/tes-penempatan');
    await screen.findByRole('button', { name: 'Lanjut' });
    await runTest(['p6']);
    expect(await screen.findByText(/Saran: mulai dari modul “Logika”/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mulai: IF: Mengambil Keputusan/ })).toHaveAttribute('href', '/belajar/fungsi-if');
    expect(screen.getByText('Pembahasan jawaban yang belum tepat')).toBeInTheDocument();
    expect(screen.getByText('Jawaban benar: Lulus')).toBeInTheDocument();
  });

  it('Akademi mengajak tes bila belum pernah, dan menampilkan hasil bila sudah', async () => {
    mockApi({ ...base, ...SIGNED_IN });
    const first = renderApp('/belajar');
    expect(await screen.findByRole('link', { name: /Ikuti tes penempatan/ })).toHaveAttribute('href', '/tes-penempatan');
    first.unmount();
    const answers = Object.fromEntries(placementQuestions.map((q) => [q.id, q.answerIndex]));
    localStorage.setItem('excellab.placement.v1', JSON.stringify({ answers, at: new Date().toISOString() }));
    renderApp('/belajar');
    expect(await screen.findByText(/Siap ke modul lanjutan/)).toBeInTheDocument();
    expect(screen.getByText(/Level tesmu: Mahir/)).toBeInTheDocument();
  });

  it('hasil lama yang belum menjawab soal baru tidak dianggap selesai: Akademi mengajak mengulang tes', async () => {
    const old = Object.fromEntries(placementQuestions.slice(0, 12).map((q) => [q.id, q.answerIndex]));
    localStorage.setItem('excellab.placement.v1', JSON.stringify({ answers: old, at: new Date().toISOString() }));
    mockApi({ ...base, ...SIGNED_IN });
    renderApp('/belajar');
    expect(await screen.findByRole('link', { name: /Ikuti tes penempatan/ })).toHaveAttribute('href', '/tes-penempatan');
  });
});

describe('ulang terjadwal (akun)', () => {
  it('latihan yang jatuh tempo muncul di Kemajuan dan pengingat di Akademi', async () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    mockApi({
      ...base,
      ...SIGNED_IN,
      'GET /progress/review-due': {
        due: [{ slug: 'total-pengeluaran', title: 'Total pengeluaran bulanan', topic: 'rumus-dasar', box: 1, dueAt: past }],
        upcoming: 1,
      },
    });
    renderApp('/kemajuan');
    expect(await screen.findByRole('heading', { name: /Waktunya mengulang/ })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Total pengeluaran bulanan' });
    expect(link).toHaveAttribute('href', '/latihan/total-pengeluaran');
    expect(screen.getByText('tahap 1/5')).toBeInTheDocument();
  });

  it('tanpa jadwal: pesan penjelasan', async () => {
    mockApi({ ...base, ...SIGNED_IN });
    renderApp('/kemajuan');
    expect(await screen.findByText(/Tidak ada latihan yang perlu diulang sekarang/)).toBeInTheDocument();
  });
});

describe('bagikan progres dan sertifikat (akun)', () => {
  const account = {
    ...base,
    'GET /auth/me': { user: USER, csrfToken: 'tok' },
    'GET /progress': { ...PROGRESS, completedLessons: ['fungsi-sum', 'average-min-max'] },
    'GET /progress/review-due': { due: [], upcoming: 0, nextDueAt: null },
  };

  it('tanpa Premium, sertifikat mengarah ke halaman Premium (bukan unduhan)', async () => {
    mockApi({ ...account, 'GET /progress/share': { token: null } });
    renderApp('/kemajuan');
    const cert = await screen.findByRole('link', { name: /Sertifikat \(Premium\)/ });
    expect(cert).toHaveAttribute('href', '/premium');
    expect(cert).not.toHaveAttribute('download');
  });

  it('tautan sertifikat modul muncul hanya untuk modul yang selesai (Premium)', async () => {
    mockApi({
      ...account,
      'GET /auth/me': { user: { ...USER, premium: true, premiumUntil: '2027-10-19T00:00:00.000Z' }, csrfToken: 'tok' },
      'GET /progress/share': { token: null },
    });
    renderApp('/kemajuan');
    const cert = await screen.findByRole('link', { name: /^Sertifikat$/ });
    expect(cert).toHaveAttribute('href', '/api/progress/certificate?scope=rumus-dasar');
    expect(cert).toHaveAttribute('download');
  });

  it('membuat dan menonaktifkan tautan bagikan', async () => {
    const token = 'a'.repeat(32);
    const fetchMock = mockApi({
      ...account,
      'GET /progress/share': { token: null },
      'POST /progress/share': () => ({ body: { data: { token } } }),
      'DELETE /progress/share': () => ({ body: { data: { token: null } } }),
    });
    renderApp('/kemajuan');
    await userEvent.click(await screen.findByRole('button', { name: /Buat tautan bagikan/ }));
    const input = await screen.findByLabelText('Tautan bagikan');
    expect(input).toHaveValue(`${window.location.origin}/bagikan/${token}`);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/progress/share') && (c[1] as RequestInit).method === 'POST')).toBe(
      true,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nonaktifkan' }));
    expect(await screen.findByRole('button', { name: /Buat tautan bagikan/ })).toBeInTheDocument();
  });

  it('halaman publik bagikan menampilkan ringkasan; tautan mati menampilkan keadaan kosong', async () => {
    const summary = {
      displayName: 'Sari',
      totalPoints: 60,
      streak: { current: 3, longest: 5 },
      lessons: { done: 4, total: 29 },
      exercises: { done: 6, total: 54 },
      modules: [{ title: 'Rumus Dasar', done: 2, total: 6 }],
    };
    mockApi({ ...base, 'GET /auth/me': ME_NONE, [`GET /share/${'b'.repeat(32)}`]: summary });
    const r = renderApp(`/bagikan/${'b'.repeat(32)}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sari' })).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('Rumus Dasar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Belajar Excel gratis/ })).toBeInTheDocument();
    r.unmount();
    renderApp(`/bagikan/${'c'.repeat(32)}`);
    expect(await screen.findByText('Tautan tidak ditemukan')).toBeInTheDocument();
  });

  it('verifikasi sertifikat: valid dan tidak ditemukan', async () => {
    mockApi({
      ...base,
      'GET /auth/me': ME_NONE,
      'GET /certificates/ABCDEF0123456789': {
        valid: true,
        name: 'Citra Lestari',
        scope: 'modul 3: Rumus Dasar',
        issuedAt: '2026-10-17T03:00:00.000Z',
        code: 'ABCDEF0123456789',
      },
    });
    const r = renderApp('/sertifikat/ABCDEF0123456789');
    expect(await screen.findByText('Sertifikat valid.')).toBeInTheDocument();
    expect(screen.getByText('Citra Lestari')).toBeInTheDocument();
    expect(screen.getByText(/modul 3: Rumus Dasar/)).toBeInTheDocument();
    expect(screen.getByText(/Bukan sertifikasi resmi Microsoft/)).toBeInTheDocument();
    r.unmount();
    renderApp('/sertifikat/0000000000000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('tidak ditemukan');
  });
});

describe('verifikasi email (akun kata sandi)', () => {
  const profile = (verified: boolean, extra: Record<string, unknown> = {}) => ({
    ...base,
    'GET /auth/me': { user: { ...USER, emailVerified: verified }, csrfToken: 'tok' },
    'GET /progress': PROGRESS,
    'GET /progress/review-due': { due: [], upcoming: 0, nextDueAt: null },
    ...extra,
  });

  it('tidak tampil bila email sudah terverifikasi atau fitur email mati', async () => {
    mockApi(profile(true));
    const r = renderApp('/profil');
    await screen.findByRole('heading', { name: 'Profil' });
    expect(screen.queryByText('Verifikasi emailmu')).not.toBeInTheDocument();
    r.unmount();
    mockApi(profile(false, { 'GET /auth/config': { emailEnabled: false } }));
    renderApp('/profil');
    await screen.findByRole('heading', { name: 'Profil' });
    expect(screen.queryByText('Verifikasi emailmu')).not.toBeInTheDocument();
  });

  it('alur: kirim kode, isi kode, email terverifikasi', async () => {
    let verified = false;
    const fetchMock = mockApi(
      profile(false, {
        'GET /auth/me': () => ({ body: { data: { user: { ...USER, emailVerified: verified }, csrfToken: 'tok' } } }),
        'POST /auth/email/request': { sent: true, cooldownSeconds: 60 },
        'POST /auth/email/verify': () => {
          verified = true;
          return { body: { data: { verified: true } } };
        },
      }),
    );
    renderApp('/profil');
    await userEvent.click(await screen.findByRole('button', { name: 'Kirim kode verifikasi' }));
    expect(bodyOf(fetchMock, '/auth/email/request')).toEqual({ email: 'budi@example.com', purpose: 'verify' });
    await userEvent.type(await screen.findByLabelText(/Kode 6 angka yang dikirim ke budi@example.com/), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verifikasi' }));
    expect(await screen.findByText('Email berhasil diverifikasi.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/auth/email/verify')).toEqual({ email: 'budi@example.com', purpose: 'verify', code: '123456' });
    expect(screen.queryByText('Verifikasi emailmu')).not.toBeInTheDocument();
  });
});

describe('admin: CSV dan latihan sering gagal', () => {
  it('menampilkan tautan CSV dan tabel latihan bermasalah', async () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      day: `2026-10-${String(i + 1).padStart(2, '0')}`,
      visitors: 1,
      pageviews: 2,
      newUsers: 0,
      attempts: 0,
      anonAttempts: 0,
      anonCorrect: 0,
    }));
    mockApi({
      ...base,
      'GET /auth/me': { user: { id: 1, email: 'a@b.co', displayName: 'Admin', role: 'admin', emailVerified: true }, csrfToken: 'x' },
      'GET /progress': PROGRESS,
      'GET /progress/review-due': { due: [], upcoming: 0, nextDueAt: null },
      'GET /admin/stats': {
        users: 3,
        admins: 1,
        attempts: 0,
        completions: 0,
        lessonCompletions: 0,
        publishedLessons: 29,
        publishedExercises: 54,
        exerciseUsage: [],
        attemptsPerDay: [],
        note: 'n',
      },
      'GET /admin/stats/usage': {
        daily,
        today: daily[13],
        week: { visitors: 7, pageviews: 14, newUsers: 0, attempts: 0, anonAttempts: 0, anonCorrect: 0 },
        topPages: [],
        anonymousExercises: [],
        note: 'n',
      },
      'GET /admin/stats/hard': {
        hard: [{ slug: 'index-match-kiri', title: 'Cari harga di kiri kode', attempts: 12, correct: 3, rate: 0.25 }],
        note: 'Minimal 5 percobaan.',
      },
    });
    renderApp('/admin');
    const section = await screen.findByRole('heading', { name: 'Latihan yang paling sering gagal' });
    expect(section).toBeInTheDocument();
    const row = screen.getByText('index-match-kiri').closest('tr')!;
    expect(within(row).getByText('25%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Unduh statistik/ })).toHaveAttribute('href', '/api/admin/stats/usage.csv');
  });
});
