import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, STUDENT, mockApi, renderApp } from './testutil';

const TOKEN = 'a'.repeat(48);

const q = (index: number, extra: Record<string, unknown> = {}) => ({
  index,
  kind: 'hasil',
  prompt: 'Berapa hasil rumus ini?',
  table: [[10], [20], [30]],
  formula: '=SUM(A1:A3)',
  options: ['60', '30', '20', '90'],
  ...extra,
});

const board = (entries: { rank: number; name: string; score: number; correct: number; wrong: number; at: string }[]) => ({
  period: 'today',
  entries,
  players: entries.length,
  durationSeconds: 60,
});

const ENTRIES = [
  { rank: 1, name: 'Andi', score: 150, correct: 10, wrong: 1, at: '2026-10-19T03:00:00.000Z' },
  { rank: 2, name: 'Sari', score: 120, correct: 9, wrong: 2, at: '2026-10-19T03:05:00.000Z' },
];

const anon = {
  'GET /auth/me': { user: null, csrfToken: null },
  'POST /track': { counted: true },
  'GET /sprint/leaderboard': () => ({ body: { data: board(ENTRIES) } }),
};

const START = {
  token: TOKEN,
  durationMs: 60_000,
  endsAtMs: Date.now() + 60_000,
  serverNowMs: Date.now(),
  question: q(0),
};

const bodyOf = (fetchMock: { mock: { calls: unknown[][] } }, suffix: string): Record<string, unknown> => {
  const call = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith(suffix)).at(-1)!;
  return JSON.parse((call[1] as RequestInit).body as string);
};

describe('halaman Sprint', () => {
  it('tampilan awal: aturan, tombol mulai, dan papan peringkat; bisa dibuka tanpa akun', async () => {
    mockApi(anon);
    renderApp('/sprint');
    expect(await screen.findByRole('heading', { level: 1, name: /Sprint/ })).toBeInTheDocument();
    expect(screen.getByText(/Salah -5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mulai/ })).toBeEnabled();
    expect(await screen.findByText('Andi')).toBeInTheDocument();
    expect(screen.getByText('Sari')).toBeInTheDocument();
  });

  it('papan peringkat mengganti periode dan meminta data yang sesuai', async () => {
    const fetchMock = mockApi(anon);
    renderApp('/sprint');
    await screen.findByText('Andi');
    await userEvent.click(screen.getByRole('button', { name: 'Sepanjang masa' }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('period=all'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Sepanjang masa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('papan kosong menampilkan ajakan menjadi yang pertama', async () => {
    mockApi({ ...anon, 'GET /sprint/leaderboard': () => ({ body: { data: board([]) } }) });
    renderApp('/sprint');
    expect(await screen.findByText('Belum ada skor')).toBeInTheDocument();
  });

  it('bermain: soal dan tabel tampil, kunci tidak ada di halaman, jawaban lewat klik dan tombol 1-4, skor mengikuti server', async () => {
    const fetchMock = mockApi({
      ...anon,
      'POST /sprint/start': () => ({ status: 201, body: { data: START } }),
      [`POST /sprint/${TOKEN}/answer`]: () => ({
        body: {
          data: {
            accepted: true,
            correct: true,
            correctIndex: 0,
            delta: 10,
            score: 10,
            streak: 1,
            finished: false,
            question: q(1, { formula: '=MAX(A1:A3)', options: ['30', '60', '10', '20'] }),
          },
        },
      }),
    });
    renderApp('/sprint');
    await userEvent.click(await screen.findByRole('button', { name: /Mulai/ }));
    expect(await screen.findByText('=SUM(A1:A3)')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Data untuk soal ini' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^\d/ })).toHaveLength(4);
    expect(document.body.textContent).not.toMatch(/correctIndex|answerIndex/);
    expect(screen.getByTestId('skor')).toHaveTextContent('0');

    await userEvent.click(screen.getByRole('button', { name: '60' }));
    expect(await screen.findByText('=MAX(A1:A3)')).toBeInTheDocument();
    expect(screen.getByTestId('skor')).toHaveTextContent('10');
    expect(bodyOf(fetchMock, '/answer')).toEqual({ q: 0, choice: 0 });
    expect(screen.getByText(/Benar, \+10/)).toBeInTheDocument();

    await userEvent.keyboard('3');
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/answer'))).toHaveLength(2));
    expect(bodyOf(fetchMock, '/answer')).toEqual({ q: 1, choice: 2 });
  });

  it('jawaban salah menampilkan jawaban yang benar dan pengurangan poin', async () => {
    mockApi({
      ...anon,
      'POST /sprint/start': () => ({ status: 201, body: { data: START } }),
      [`POST /sprint/${TOKEN}/answer`]: () => ({
        body: {
          data: { accepted: true, correct: false, correctIndex: 0, delta: -5, score: 0, streak: 0, finished: false, question: q(1) },
        },
      }),
    });
    renderApp('/sprint');
    await userEvent.click(await screen.findByRole('button', { name: /Mulai/ }));
    await userEvent.click(await screen.findByRole('button', { name: '30' }));
    expect(await screen.findByText(/Salah, -5/)).toBeInTheDocument();
    expect(screen.getByText(/Jawabannya 60/)).toBeInTheDocument();
  });

  it('terlalu cepat (429) hanya memberi peringatan dan soal tetap bisa dijawab', async () => {
    let calls = 0;
    mockApi({
      ...anon,
      'POST /sprint/start': () => ({ status: 201, body: { data: START } }),
      [`POST /sprint/${TOKEN}/answer`]: () => {
        calls++;
        return calls === 1
          ? { status: 429, body: { error: { code: 'RATE_LIMITED', message: 'Terlalu cepat.' } } }
          : {
              body: {
                data: { accepted: true, correct: true, correctIndex: 0, delta: 10, score: 10, streak: 1, finished: false, question: q(1) },
              },
            };
      },
    });
    renderApp('/sprint');
    await userEvent.click(await screen.findByRole('button', { name: /Mulai/ }));
    const first = await screen.findByRole('button', { name: '60' });
    await userEvent.click(first);
    expect(await screen.findByText(/Terlalu cepat, baca soalnya dulu/)).toBeInTheDocument();
    expect(screen.getByTestId('skor')).toHaveTextContent('0');
    await userEvent.click(screen.getByRole('button', { name: '60' }));
    await waitFor(() => expect(screen.getByTestId('skor')).toHaveTextContent('10'));
  });

  it('ronde selesai: ringkasan, isi nama, simpan, dan papan dimuat ulang dengan nama disorot', async () => {
    let saved = false;
    const fetchMock = mockApi({
      ...anon,
      'GET /sprint/leaderboard': () => ({
        body: {
          data: board(
            saved
              ? [{ rank: 1, name: 'Budi Cepat', score: 42, correct: 3, wrong: 0, at: '2026-10-19T03:10:00.000Z' }, ...ENTRIES.slice(1)]
              : ENTRIES,
          ),
        },
      }),
      'POST /sprint/start': () => ({ status: 201, body: { data: START } }),
      [`POST /sprint/${TOKEN}/answer`]: () => ({
        body: { data: { accepted: true, correct: true, correctIndex: 0, delta: 10, score: 42, streak: 3, finished: true, question: null } },
      }),
      [`POST /sprint/${TOKEN}/finish`]: () => ({
        body: { data: { score: 42, correct: 3, wrong: 0, rankToday: 3, rankAll: 5, canSubmit: true, submitted: false } },
      }),
      [`POST /sprint/${TOKEN}/submit`]: () => {
        saved = true;
        return { status: 201, body: { data: { saved: true, name: 'Budi Cepat', rankToday: 1, rankAll: 1 } } };
      },
    });
    renderApp('/sprint');
    await userEvent.click(await screen.findByRole('button', { name: /Mulai/ }));
    await userEvent.click(await screen.findByRole('button', { name: '60' }));
    expect(await screen.findByTestId('skor-akhir')).toHaveTextContent('42');
    expect(screen.getByText(/3 benar, 0 salah/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Nama untuk papan peringkat'), 'Budi Cepat');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan skor' }));
    expect(await screen.findByText(/Tersimpan sebagai/)).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/submit')).toEqual({ name: 'Budi Cepat' });
    const row = (await screen.findByText('Budi Cepat', { selector: '.name' })).closest('li')!;
    expect(row).toHaveClass('me');
    expect(within(row).getByText('42')).toBeInTheDocument();
    expect(localStorage.getItem('excellab.sprint.name')).toBe('Budi Cepat');
    // Tombol simpan hilang agar tidak tersimpan dua kali; main lagi tersedia.
    expect(screen.queryByRole('button', { name: 'Simpan skor' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main lagi' })).toBeInTheDocument();
  });

  it('nama ditolak server: pesan tampil di bawah kolom dan skor tidak dianggap tersimpan', async () => {
    mockApi({
      ...anon,
      'POST /sprint/start': () => ({ status: 201, body: { data: START } }),
      [`POST /sprint/${TOKEN}/answer`]: () => ({
        body: { data: { accepted: true, correct: true, correctIndex: 0, delta: 10, score: 10, streak: 1, finished: true, question: null } },
      }),
      [`POST /sprint/${TOKEN}/finish`]: () => ({
        body: { data: { score: 10, correct: 1, wrong: 0, rankToday: 1, rankAll: 1, canSubmit: true, submitted: false } },
      }),
      [`POST /sprint/${TOKEN}/submit`]: () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: 'Nama 2 sampai 20 karakter, tanpa tautan.' } },
      }),
    });
    renderApp('/sprint');
    await userEvent.click(await screen.findByRole('button', { name: /Mulai/ }));
    await userEvent.click(await screen.findByRole('button', { name: '60' }));
    await userEvent.type(await screen.findByLabelText('Nama untuk papan peringkat'), 'https://jahat.com');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan skor' }));
    expect(await screen.findByText(/tanpa tautan/)).toBeInTheDocument();
    expect(screen.queryByText(/Tersimpan sebagai/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan skor' })).toBeEnabled();
  });

  it('skor 0 tidak menawarkan penyimpanan', async () => {
    mockApi({
      ...anon,
      'POST /sprint/start': () => ({ status: 201, body: { data: START } }),
      [`POST /sprint/${TOKEN}/answer`]: () => ({
        body: { data: { accepted: true, correct: false, correctIndex: 1, delta: 0, score: 0, streak: 0, finished: true, question: null } },
      }),
      [`POST /sprint/${TOKEN}/finish`]: () => ({
        body: { data: { score: 0, correct: 0, wrong: 1, rankToday: 1, rankAll: 1, canSubmit: false, submitted: false } },
      }),
    });
    renderApp('/sprint');
    await userEvent.click(await screen.findByRole('button', { name: /Mulai/ }));
    await userEvent.click(await screen.findByRole('button', { name: '60' }));
    expect(await screen.findByText(/Skor 0 tidak masuk papan peringkat/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nama untuk papan peringkat')).not.toBeInTheDocument();
  });

  it('galat saat memulai ditampilkan dan tombol mulai bisa dicoba lagi', async () => {
    mockApi({
      ...anon,
      'POST /sprint/start': () => ({ status: 429, body: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak ronde dimulai.' } } }),
    });
    renderApp('/sprint');
    await userEvent.click(await screen.findByRole('button', { name: /Mulai/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Terlalu banyak ronde dimulai.');
    expect(screen.getByRole('button', { name: /Mulai/ })).toBeEnabled();
  });
});

describe('Sprint di beranda dan admin', () => {
  it('beranda pengunjung memuat sel Sprint di kotak alat dengan tautan main', async () => {
    mockApi({
      ...anon,
      'GET /auth/config': { emailEnabled: false, googleClientId: null, premium: { priceLabel: '', contactUrl: null } },
      'GET /public/overview': { counts: { modules: 1, lessons: 1, exercises: 1, shortcuts: 1, worksheets: 1, functions: 33 }, modules: [] },
      'GET /public/lessons': [],
    });
    renderApp('/');
    const h = await screen.findByRole('heading', { name: 'Sprint 60 detik' });
    const cell = h.closest('article')!;
    expect(within(cell).getByRole('link', { name: 'Main sekarang' })).toHaveAttribute('href', '/sprint');
    // Papan peringkat tidak dipajang di beranda pengunjung supaya halaman tidak terlihat kosong.
    expect(screen.queryByText('Belum ada skor')).not.toBeInTheDocument();
  });

  it('beranda anggota juga punya tautan ke Sprint', async () => {
    mockApi({
      ...anon,
      'GET /auth/me': { user: STUDENT, csrfToken: 'tok' },
      'GET /progress': EMPTY_PROGRESS,
      'GET /progress/review-due': { due: [], upcoming: 0 },
      'GET /modules': [],
    });
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Main sekarang' })).toHaveAttribute('href', '/sprint');
  });

  it('admin: daftar skor, sembunyikan, dan tampilkan kembali', async () => {
    const admin = { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin', emailVerified: true, premium: true };
    let hidden = false;
    const fetchMock = mockApi({
      ...anon,
      'GET /auth/me': { user: admin, csrfToken: 'x' },
      'GET /admin/sprint': () => ({
        body: {
          data: {
            total: 1,
            hidden: hidden ? 1 : 0,
            entries: [{ id: 7, name: 'Nama Nakal', score: 99, correct: 8, wrong: 1, hidden, at: '2026-10-19T03:00:00.000Z', email: null }],
          },
        },
      }),
      'PUT /admin/sprint/7': (_u: URL, init?: RequestInit) => {
        hidden = (JSON.parse(init!.body as string) as { hidden: boolean }).hidden;
        return { body: { data: { id: 7, hidden } } };
      },
    });
    renderApp('/admin/sprint');
    await userEvent.click(await screen.findByRole('button', { name: 'Sembunyikan skor Nama Nakal' }));
    expect(await screen.findByRole('button', { name: 'Tampilkan skor Nama Nakal' })).toBeInTheDocument();
    expect(
      JSON.parse((fetchMock.mock.calls.find((c) => String(c[0]).includes('/admin/sprint/7'))![1] as RequestInit).body as string),
    ).toEqual({ hidden: true });
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan skor Nama Nakal' }));
    expect(await screen.findByRole('button', { name: 'Sembunyikan skor Nama Nakal' })).toBeInTheDocument();
  });
});
