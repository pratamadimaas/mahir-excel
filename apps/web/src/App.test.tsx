import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SpreadsheetGrid, type CellDisplay } from './components/spreadsheet/SpreadsheetGrid';
import { HeroVisual, shouldUse3D } from './scenes/hero/HeroVisual';
import { buildQuestions } from './features/shortcuts/ShortcutQuiz';
import { EXERCISE, LESSON, MODULES, EMPTY_PROGRESS, SIGNED_IN, mockApi, renderApp } from './testutil';
import type { ShortcutView } from './services/types';

const base = {
  ...SIGNED_IN,
  'GET /modules': MODULES,
  'GET /exercises': (_u: URL) => ({
    body: {
      data: [
        {
          slug: EXERCISE.slug,
          title: EXERCISE.title,
          description: 'd',
          topic: 'rumus-dasar',
          difficulty: 'mudah',
          points: 10,
          lessonSlug: 'fungsi-sum',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1 },
    },
  }),
};

describe('navigasi dan routing', () => {
  it('beranda menampilkan judul, CTA, dan navigasi utama', async () => {
    mockApi({
      ...base,
      'GET /exercises/total-harga-barang': { ...EXERCISE, slug: 'total-harga-barang' },
      'GET /shortcuts': [],
      'GET /worksheets': [],
    });
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Excel bisa dipelajari/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mulai belajar' })).toHaveAttribute('href', '/belajar');
    expect(screen.getByRole('link', { name: 'Coba latihan' })).toHaveAttribute('href', '/latihan');
    const nav = screen.getByRole('navigation', { name: 'Navigasi utama' });
    for (const label of ['Belajar', 'Latihan', 'Data Latihan', 'Worksheet'])
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
  });

  it('beranda setelah login punya panduan cara memakai: tiap kartu mengarah ke halamannya, bisa disembunyikan', async () => {
    localStorage.removeItem('xl-start-hidden');
    mockApi({
      ...base,
      'GET /exercises/total-harga-barang': { ...EXERCISE, slug: 'total-harga-barang' },
      'GET /shortcuts': [],
      'GET /worksheets': [],
    });
    renderApp('/');
    const guide = await screen.findByRole('region', { name: 'Cara memakai Mahir Excel' });
    const href = (name: string) => within(guide).getByRole('link', { name: new RegExp(`^${name}`) }).getAttribute('href');
    expect(href('Belajar')).toBe('/belajar');
    expect(href('Bidang')).toBe('/jalur');
    expect(href('Latihan')).toBe('/latihan');
    expect(href('Data Latihan')).toBe('/data-latihan');
    expect(href('Worksheet')).toBe('/worksheet');
    expect(href('Sertifikat gratis')).toBe('/program');
    expect(within(guide).getByRole('link', { name: 'Ikuti Uji Kemampuan Excel' })).toHaveAttribute('href', '/tes-penempatan');

    await userEvent.click(within(guide).getByRole('button', { name: /Sembunyikan petunjuk/ }));
    expect(screen.queryByRole('region', { name: 'Cara memakai Mahir Excel' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan cara memakai Mahir Excel' }));
    expect(screen.getByRole('region', { name: 'Cara memakai Mahir Excel' })).toBeInTheDocument();
    localStorage.removeItem('xl-start-hidden');
  });

  it('klik navigasi membuka halaman akademi', async () => {
    mockApi(base);
    renderApp('/shortcut-tidak-ada');
    expect(await screen.findByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Navigasi utama' })).getByRole('link', { name: 'Belajar' }));
    expect(await screen.findByRole('heading', { name: 'Belajar Excel dari dasar' })).toBeInTheDocument();
    expect(await screen.findByText('SUM: Menjumlahkan Angka', { exact: false })).toBeInTheDocument();
  });

  it('menu seluler dapat dibuka dan ditutup dengan atribut aksesibilitas', async () => {
    mockApi(base);
    renderApp('/tentang');
    const toggle = await screen.findByRole('button', { name: 'Buka menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Tutup menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Menu seluler' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Menu seluler' })).not.toBeInTheDocument());
  });

  it('halaman tidak dikenal menampilkan 404 yang ramah', async () => {
    mockApi(base);
    renderApp('/tidak/ada/halaman');
    expect(await screen.findByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ke beranda' })).toBeInTheDocument();
  });
});

describe('pelajaran', () => {
  it('menampilkan tujuan, sintaks, contoh, kesalahan umum, latihan, dan kuis', async () => {
    mockApi({ ...base, 'GET /lessons/fungsi-sum': LESSON });
    renderApp('/belajar/fungsi-sum');
    expect(await screen.findByRole('heading', { level: 1, name: LESSON.title })).toBeInTheDocument();
    expect(screen.getByText('Menulis SUM dengan rentang sel.')).toBeInTheDocument();
    expect(screen.getByText('=SUM(angka1; [angka2]; ...)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Contoh: Pengeluaran mingguan/ })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /Contoh: Pengeluaran mingguan/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kesalahan yang sering terjadi' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Total pengeluaran bulanan' })).toHaveAttribute('href', '/latihan/total-pengeluaran');
    expect(screen.getAllByRole('link', { name: /AVERAGE, MIN, dan MAX/ }).length).toBeGreaterThan(0);
  });

  it('kuis memberi penjelasan setelah jawaban diperiksa', async () => {
    mockApi({ ...base, 'GET /lessons/fungsi-sum': LESSON });
    renderApp('/belajar/fungsi-sum');
    await screen.findByRole('heading', { level: 1, name: LESSON.title });
    await userEvent.click(screen.getByLabelText('2'));
    await userEvent.click(screen.getByRole('button', { name: 'Periksa jawaban' }));
    expect(screen.getByText('Belum tepat.')).toBeInTheDocument();
    expect(screen.getByText('1+2=3.')).toBeInTheDocument();
  });

  it('keadaan loading lalu galat dengan tombol coba lagi', async () => {
    let fail = true;
    mockApi({
      ...base,
      'GET /lessons/fungsi-sum': () =>
        fail
          ? { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Server sedang bermasalah.' } } }
          : { body: { data: LESSON } },
    });
    renderApp('/belajar/fungsi-sum');
    expect(await screen.findByText('Memuat pelajaran…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server sedang bermasalah.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('heading', { level: 1, name: LESSON.title })).toBeInTheDocument();
  });

  it('pelajaran tidak ada -> keadaan kosong', async () => {
    mockApi({
      ...base,
      'GET /lessons/tidak-ada': () => ({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Pelajaran tidak ditemukan.' } } }),
    });
    renderApp('/belajar/tidak-ada');
    expect(await screen.findByText('Pelajaran tidak ditemukan')).toBeInTheDocument();
  });

  it('API tidak terjangkau menampilkan pesan jaringan yang jelas', async () => {
    mockApi({
      ...base,
      'GET /lessons/fungsi-sum': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderApp('/belajar/fungsi-sum');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tidak dapat terhubung');
  });

  it('akun: menandai selesai disimpan di server dan bertahan setelah render ulang', async () => {
    let done = false;
    const view = () => ({ ...EMPTY_PROGRESS, completedLessons: done ? ['fungsi-sum'] : [] });
    mockApi({
      ...base,
      'GET /lessons/fungsi-sum': LESSON,
      'GET /progress': () => ({ body: { data: view() } }),
      'PUT /progress': () => {
        done = true;
        return { body: { data: view() } };
      },
    });
    const first = renderApp('/belajar/fungsi-sum');
    await screen.findByRole('heading', { level: 1, name: LESSON.title });
    await userEvent.click(screen.getByRole('button', { name: 'Tandai pelajaran selesai' }));
    expect(await screen.findByRole('button', { name: 'Batalkan tanda selesai' })).toHaveAttribute('aria-pressed', 'true');
    first.unmount();

    renderApp('/belajar/fungsi-sum');
    expect(await screen.findByRole('button', { name: 'Batalkan tanda selesai' })).toBeInTheDocument();
    expect(screen.getByText('Pelajaran selesai')).toBeInTheDocument();
  });
});

describe('playground latihan', () => {
  const submitOk = {
    correct: true,
    message: 'Jawabanmu benar!',
    targets: [{ cell: 'B4', ok: true, message: 'ok' }],
    pointsAwarded: 0,
    alreadyCompleted: false,
    explanation: 'SUM menjumlahkan.',
    solution: { B4: '=SUM(B2:B3)' },
  };

  it('menampilkan ruang kerja: name box, formula bar, grid dengan sel yang dapat diisi', async () => {
    mockApi({ ...base, 'GET /exercises/total-pengeluaran': EXERCISE });
    renderApp('/latihan/total-pengeluaran');
    expect(await screen.findByRole('heading', { level: 1, name: EXERCISE.title })).toBeInTheDocument();
    expect(screen.getByTestId('namebox')).toHaveTextContent('B4');
    const grid = screen.getByRole('grid', { name: /Lembar kerja latihan/ });
    expect(within(grid).getByRole('gridcell', { name: /B2: 350.000, hanya baca/ })).toBeInTheDocument();
    expect(within(grid).getByRole('gridcell', { name: /B4, kosong, dapat diisi/ })).toBeInTheDocument();
    expect(grid.closest('.xl-grid-scroll')).not.toBeNull(); // kontainer gulir horizontal
  });

  it('rumus dihitung langsung, rujukan disorot, dan umpan balik salah ditampilkan', async () => {
    const submit = vi.fn(() => ({
      body: {
        data: {
          correct: false,
          message: 'Jawabanmu belum tepat.',
          targets: [{ cell: 'B4', ok: false, message: 'Sel B4 menghasilkan 350.000, tetapi itu belum sesuai.' }],
          pointsAwarded: 0,
          alreadyCompleted: false,
        },
      },
    }));
    mockApi({ ...base, 'GET /exercises/total-pengeluaran': EXERCISE, 'POST /exercises/total-pengeluaran/submit': submit });
    renderApp('/latihan/total-pengeluaran');
    await screen.findByRole('heading', { level: 1, name: EXERCISE.title });
    const input = screen.getByRole('textbox', { name: 'Isi sel B4' });
    await userEvent.type(input, '=SUM(B2:B2)');
    const grid = screen.getByRole('grid', { name: /Lembar kerja latihan/ });
    expect(within(grid).getByRole('gridcell', { name: /B4: 350.000/ })).toBeInTheDocument();
    expect(within(grid).getByRole('gridcell', { name: /B2: 350.000/ })).toHaveClass('ref');
    await userEvent.click(screen.getByRole('button', { name: /Periksa jawaban/ }));
    const fb = await screen.findByTestId('feedback');
    expect(within(fb).getByText('Belum tepat.')).toBeInTheDocument();
    expect(within(fb).getByText(/belum sesuai/)).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
    // Data yang dikirim hanya sel yang boleh diubah.
    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls.find((c) => String(c[0]).includes('/submit'))![1] as RequestInit).body as string,
    );
    expect(body).toEqual({ cells: { B4: '=SUM(B2:B2)' } });
  });

  it('jawaban benar: pesan sukses, penjelasan, solusi, poin dari server, dan tautan berikutnya', async () => {
    mockApi({
      ...base,
      'GET /exercises/total-pengeluaran': EXERCISE,
      'POST /exercises/total-pengeluaran/submit': { ...submitOk, pointsAwarded: 10, totalPoints: 10 },
    });
    renderApp('/latihan/total-pengeluaran');
    await screen.findByRole('heading', { level: 1, name: EXERCISE.title });
    await userEvent.type(screen.getByRole('textbox', { name: 'Isi sel B4' }), '=SUM(B2:B3)');
    await userEvent.click(screen.getByRole('button', { name: /Periksa jawaban/ }));
    const fb = await screen.findByTestId('feedback');
    expect(await within(fb).findByText('Benar!')).toBeInTheDocument();
    expect(within(fb).getByText(/\+10 poin/)).toBeInTheDocument();
    expect(within(fb).getByText('SUM menjumlahkan.')).toBeInTheDocument();
    expect(within(fb).getByLabelText('Jawaban acuan')).toHaveTextContent('=SUM(B2:B3)');
  });

  it('mengirim ulang jawaban benar tidak menambah poin', async () => {
    let calls = 0;
    mockApi({
      ...base,
      'GET /exercises/total-pengeluaran': EXERCISE,
      'POST /exercises/total-pengeluaran/submit': () => ({
        body: {
          data:
            ++calls === 1
              ? { ...submitOk, pointsAwarded: 10, totalPoints: 10 }
              : { ...submitOk, pointsAwarded: 0, alreadyCompleted: true, totalPoints: 10 },
        },
      }),
    });
    renderApp('/latihan/total-pengeluaran');
    await screen.findByRole('heading', { level: 1, name: EXERCISE.title });
    await userEvent.type(screen.getByRole('textbox', { name: 'Isi sel B4' }), '=SUM(B2:B3)');
    const btn = screen.getByRole('button', { name: /Periksa jawaban/ });
    await userEvent.click(btn);
    await screen.findByText(/\+10 poin/);
    await userEvent.click(btn);
    await screen.findByText(/tidak ada poin tambahan/);
  });

  it('petunjuk terbuka bertahap dan reset mengembalikan data awal', async () => {
    mockApi({ ...base, 'GET /exercises/total-pengeluaran': EXERCISE });
    renderApp('/latihan/total-pengeluaran');
    await screen.findByRole('heading', { level: 1, name: EXERCISE.title });
    const hintBtn = screen.getByRole('button', { name: /Petunjuk \(0\/2\)/ });
    await userEvent.click(hintBtn);
    expect(screen.getByText('Awali dengan =SUM(')).toBeInTheDocument();
    expect(screen.queryByText('Rentang B2:B3')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Petunjuk \(1\/2\)/ }));
    expect(screen.getByText('Rentang B2:B3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Petunjuk \(2\/2\)/ })).toBeDisabled();

    const input = screen.getByRole('textbox', { name: 'Isi sel B4' });
    await userEvent.type(input, '=1+1');
    expect(input).toHaveValue('=1+1');
    await userEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(screen.getByRole('textbox', { name: 'Isi sel B4' })).toHaveValue('');
  });

  it('sel soal bersifat hanya baca dan memberi tahu pengguna', async () => {
    mockApi({ ...base, 'GET /exercises/total-pengeluaran': EXERCISE });
    renderApp('/latihan/total-pengeluaran');
    await screen.findByRole('heading', { level: 1, name: EXERCISE.title });
    const grid = screen.getByRole('grid', { name: /Lembar kerja latihan/ });
    const ro = within(grid).getByRole('gridcell', { name: /B2: 350.000/ });
    await userEvent.click(ro);
    expect(screen.getByRole('textbox', { name: 'Isi sel B2' })).toBeDisabled();
    await userEvent.dblClick(ro);
    expect(screen.getByText(/adalah data soal dan tidak dapat diubah/)).toBeInTheDocument();
  });

  it('fungsi tidak didukung memperlihatkan galat #NAME? yang dijelaskan', async () => {
    mockApi({ ...base, 'GET /exercises/total-pengeluaran': EXERCISE });
    renderApp('/latihan/total-pengeluaran');
    await screen.findByRole('heading', { level: 1, name: EXERCISE.title });
    await userEvent.type(screen.getByRole('textbox', { name: 'Isi sel B4' }), '=UNIQUE(B2:B3)');
    expect(screen.getAllByText('#NAME?').length).toBeGreaterThan(0);
    expect(screen.getByText(/tidak dikenal atau belum didukung/)).toBeInTheDocument();
  });

  it('galat jaringan saat submit ditampilkan tanpa merusak halaman', async () => {
    mockApi({
      ...base,
      'GET /exercises/total-pengeluaran': EXERCISE,
      'POST /exercises/total-pengeluaran/submit': () => ({
        status: 429,
        body: { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan.' } },
      }),
    });
    renderApp('/latihan/total-pengeluaran');
    await screen.findByRole('heading', { level: 1, name: EXERCISE.title });
    await userEvent.click(screen.getByRole('button', { name: /Periksa jawaban/ }));
    expect(await screen.findByText('Terlalu banyak permintaan.')).toBeInTheDocument();
  });
});

describe('SpreadsheetGrid', () => {
  const display = (text: string): CellDisplay => ({ text, kind: text ? 'text' : 'empty' });
  function setup() {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const onReadOnly = vi.fn();
    render(
      <SpreadsheetGrid
        label="uji"
        rows={3}
        cols={3}
        getRaw={() => ''}
        getDisplay={() => display('')}
        editable={new Set(['B2'])}
        selected="A1"
        onSelect={onSelect}
        onChange={onChange}
        onReadOnlyAttempt={onReadOnly}
      />,
    );
    return { onSelect, onChange, onReadOnly };
  }

  it('navigasi keyboard dengan tombol panah', async () => {
    const { onSelect } = setup();
    const cell = screen.getByRole('gridcell', { name: /^A1/ });
    cell.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenLastCalledWith('B1');
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('A2');
  });

  it('mengetik pada sel hanya baca memicu pemberitahuan dan tidak mengubah isi', async () => {
    const { onChange, onReadOnly } = setup();
    screen.getByRole('gridcell', { name: /^A1/ }).focus();
    await userEvent.keyboard('x');
    expect(onReadOnly).toHaveBeenCalledWith('A1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('header kolom dan baris tersedia dengan scope', () => {
    setup();
    expect(
      screen
        .getAllByRole('columnheader')
        .map((h) => h.textContent)
        .filter(Boolean),
    ).toEqual(['A', 'B', 'C']);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['1', '2', '3']);
  });
});

describe('hero 3D', () => {
  it('tanpa WebGL (jsdom) memakai fallback CSS dan tidak memuat canvas', async () => {
    expect(shouldUse3D()).toBe(false);
    const { container } = render(<HeroVisual />);
    expect(screen.getByRole('img', { name: /Ilustrasi tiga lembar kerja Excel/ })).toBeInTheDocument();
    expect(container.querySelector('.xl-hero-fallback')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 400));
    expect(container.querySelector('canvas')).toBeNull();
    // Rumus overlay dihitung oleh mesin spreadsheet.
    expect(container.querySelector('.xl-hero-formula')).toHaveTextContent('=SUM(B2:B6)');
    expect(container.querySelector('.xl-hero-formula')).toHaveTextContent('1.020.000');
  });

  it('visual dekoratif tidak menangkap fokus keyboard', () => {
    const { container } = render(<HeroVisual />);
    expect(container.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
  });
});

describe('kuis shortcut', () => {
  const sc = (slug: string, win: string | null, mac: string | null): ShortcutView => ({
    id: 1,
    slug,
    action: slug,
    keysWindows: win,
    keysMac: mac,
    category: 'data',
    explanation: 'x',
    verification: 'v',
  });
  const list = [
    sc('a', 'Ctrl + A', '⌘ + A'),
    sc('b', 'Ctrl + B', '⌘ + B'),
    sc('c', 'Ctrl + C', null),
    sc('d', 'Ctrl + D', '⌘ + D'),
    sc('e', 'Ctrl + E', '⌘ + E'),
    sc('dup', 'Ctrl + A', '⌘ + Z'),
  ];

  it('setiap soal memuat jawaban benar dan pilihan unik', () => {
    const qs = buildQuestions(list, 'windows');
    expect(qs.length).toBe(6);
    for (const q of qs) {
      expect(q.options.some((o) => o.slug === q.item.slug)).toBe(true);
      const keys = q.options.map((o) => o.keysWindows);
      expect(new Set(keys).size).toBe(keys.length);
      expect(q.options.length).toBeLessThanOrEqual(4);
    }
  });

  it('hanya memakai shortcut yang tersedia untuk platform', () => {
    const qs = buildQuestions(list, 'mac');
    expect(qs.every((q) => q.item.keysMac)).toBe(true);
    expect(qs.some((q) => q.item.slug === 'c')).toBe(false);
  });
});

describe('akses tanpa akun', () => {
  it.each(['/belajar', '/latihan', '/latihan/total-pengeluaran', '/shortcut', '/worksheet', '/tantangan', '/kemajuan'])(
    '%s mengarahkan pengunjung ke halaman masuk tanpa meminta materi ke server',
    async (path) => {
      const fetchMock = mockApi({ ...base, 'GET /auth/me': { user: null, csrfToken: null }, 'GET /auth/config': { emailEnabled: false } });
      renderApp(path);
      expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument();
      const asked = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(
        asked.some((u) =>
          ['/modules', '/lessons', '/exercises', '/shortcuts', '/worksheets', '/challenges'].some((r) => u.includes(`/api${r}`)),
        ),
      ).toBe(false);
    },
  );

  it('tes penempatan dan beranda tetap terbuka', async () => {
    mockApi({ ...base, 'GET /auth/me': { user: null, csrfToken: null } });
    renderApp('/tes-penempatan');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mulai dari mana?' })).toBeInTheDocument();
  });
});

describe('pelajaran contoh untuk pengunjung', () => {
  const anon = { ...base, 'GET /auth/me': { user: null, csrfToken: null }, 'GET /auth/config': { emailEnabled: false } };

  it('pelajaran contoh terbuka tanpa login, dengan ajakan daftar dan tanpa tautan latihan atau tombol selesai', async () => {
    const fetchMock = mockApi({ ...anon, 'GET /lessons/fungsi-sum': LESSON });
    renderApp('/belajar/fungsi-sum');
    expect(await screen.findByRole('heading', { level: 1, name: LESSON.title })).toBeInTheDocument();
    expect(screen.getByText('Ini pelajaran contoh.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Daftar gratis' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Total pengeluaran bulanan' })).not.toBeInTheDocument();
    expect(screen.getByText('Total pengeluaran bulanan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tandai pelajaran selesai' })).not.toBeInTheDocument();
    // Pelajaran berikutnya bukan pelajaran contoh: tidak ditautkan.
    expect(screen.queryByRole('link', { name: /AVERAGE, MIN, dan MAX/ })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/lessons/fungsi-sum'))).toBe(true);
  });

  it('pelajaran non-contoh menampilkan ajakan masuk tanpa meminta materi ke server', async () => {
    const fetchMock = mockApi(anon);
    renderApp('/belajar/index-match');
    expect(await screen.findByText('Pelajaran ini untuk anggota')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Masuk' }).every((a) => a.getAttribute('href') === '/masuk')).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/lessons/'))).toBe(false);
  });

  it('beranda menampilkan daftar pelajaran contoh dari server untuk pengunjung', async () => {
    mockApi({
      ...anon,
      'GET /public/lessons': [
        { slug: 'fungsi-sum', title: 'SUM: Menjumlahkan Angka', summary: 'Jumlahkan rentang', minutes: 8, moduleTitle: 'Rumus Dasar' },
      ],
    });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Baca satu pelajaran dulu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /SUM: Menjumlahkan Angka/ })).toHaveAttribute('href', '/belajar/fungsi-sum');
  });
});
