import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { Sheet, isError, parseFormula, traceFormula } from '@excellab/spreadsheet-engine';
import { AnswerCompare } from './components/spreadsheet/AnswerCompare';
import { FormulaDebugger } from './components/spreadsheet/FormulaDebugger';
import { GOALS, SAMPLE_CELLS, crit, defaultsOf, lit, validateFields } from './features/wizard/goals';
import { SIGNED_IN, STUDENT, mockApi, renderApp } from './testutil';

const PREMIUM_USER = { ...STUDENT, premium: true };
const premiumSession = { ...SIGNED_IN, 'GET /auth/me': { user: PREMIUM_USER, csrfToken: 'tok' } };

describe('wizard: tujuan dan perakit rumus', () => {
  const sheet = new Sheet(SAMPLE_CELLS);
  const expected: Record<string, string | number> = {
    jumlahkan: 23,
    'rata-rata': 115000 / 7,
    'terbesar-terkecil': 25000,
    'hitung-terisi': 7,
    'hitung-jika': 3,
    'jumlah-jika': 53000,
    'jumlah-dua-syarat': 35000,
    'jika-lalu': 'Mahal',
    'cari-vlookup': 15000,
    'cari-index-match': 22000,
    persentase: 3 / 23,
    'gabung-teks': 'Kopi susu Minuman',
    'rapikan-teks': 'Kopi susu',
    bulatkan: 18000,
    'rata-rata-jika': 13250,
    peringkat: 3,
    'ganti-teks': 'Kopi coklat',
  };

  it('setiap tujuan punya contoh jadi yang hasilnya cocok dengan hitungan manual', () => {
    expect(GOALS.map((g) => g.id).sort()).toEqual(Object.keys(expected).sort());
    for (const g of GOALS) {
      const v = defaultsOf(g);
      expect(validateFields(g, v), g.id).toBeNull();
      const f = g.build(v);
      expect(() => parseFormula(f), `${g.id}: ${f}`).not.toThrow();
      const result = traceFormula(f, sheet).result;
      expect(isError(result), `${g.id}: ${f}`).toBe(false);
      const want = expected[g.id]!;
      if (typeof want === 'number') expect(result as number).toBeCloseTo(want, 8);
      else expect(result).toBe(want);
      expect(g.explain(v).length, g.id).toBeGreaterThan(0);
    }
  });

  it('wizard gratis mencakup SUM, AVERAGE, MAX/MIN, dan COUNT saja', () => {
    expect(GOALS.filter((g) => g.free).map((g) => g.id)).toEqual(['jumlahkan', 'rata-rata', 'terbesar-terkecil', 'hitung-terisi']);
  });

  it('teks diberi tanda kutip, angka dan alamat sel tidak', () => {
    expect(lit('Mahal')).toBe('"Mahal"');
    expect(lit('15000')).toBe('15000');
    expect(lit('c2')).toBe('C2');
    expect(lit('Pak "Budi"')).toBe('"Pak ""Budi"""');
    expect(crit('>3')).toBe('">3"');
    expect(crit('Makanan')).toBe('"Makanan"');
    expect(crit('5')).toBe('5');
    expect(crit('F1')).toBe('F1');
  });

  it('menolak alamat yang salah dengan pesan yang jelas', () => {
    const g = GOALS.find((x) => x.id === 'jumlahkan')!;
    expect(validateFields(g, { range: 'D2' })).toMatch(/rentang/);
    expect(validateFields(g, { range: '' })).toMatch(/Isi/);
    const cell = GOALS.find((x) => x.id === 'bulatkan')!;
    expect(validateFields(cell, { cell: 'C2:C3', digits: '0' })).toMatch(/satu sel/);
    expect(validateFields(cell, { cell: 'C2', digits: 'x' })).toMatch(/angka/);
  });
});

describe('AnswerCompare', () => {
  const base = { A1: 'Pos', B1: 'Biaya', B2: '350000', B3: '120000', A4: 'Total' };
  const solution = { B4: '=SUM(B2:B3)' };

  it('akun gratis melihat ajakan Premium, bukan tabelnya', () => {
    render(
      <MemoryRouter>
        <AnswerCompare base={base} solution={solution} mine={{ ...base, B4: '=B2+B3' }} premium={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Bandingkan jawabanmu dengan solusi')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Premium: rumus berbeda dengan hasil sama dinyatakan cocok', () => {
    render(
      <MemoryRouter>
        <AnswerCompare base={base} solution={solution} mine={{ ...base, B4: '=B2+B3' }} premium />
      </MemoryRouter>,
    );
    const row = within(screen.getByRole('table')).getByRole('row', { name: /B4/ });
    expect(within(row).getByText('Cocok')).toBeInTheDocument();
    expect(screen.getByText(/Semua sel menghasilkan angka yang sama/)).toBeInTheDocument();
  });

  it('Premium: hasil berbeda dan sel kosong ditandai', () => {
    const { rerender } = render(
      <MemoryRouter>
        <AnswerCompare base={base} solution={solution} mine={{ ...base, B4: '=B2' }} premium />
      </MemoryRouter>,
    );
    expect(screen.getByText('Beda')).toBeInTheDocument();
    expect(screen.getByText(/1 dari 1 sel berbeda atau masih kosong/)).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <AnswerCompare base={base} solution={solution} mine={base} premium />
      </MemoryRouter>,
    );
    expect(screen.getByText('Kosong')).toBeInTheDocument();
  });
});

describe('FormulaDebugger', () => {
  const sheet = new Sheet({ A1: '10', A2: '20', B1: '=A1+A2*2' });

  it('tidak tampil untuk sel yang bukan rumus', () => {
    const { container } = render(
      <MemoryRouter>
        <FormulaDebugger raw="42" sheet={sheet} premium />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('akun gratis melihat ajakan Premium', () => {
    render(
      <MemoryRouter>
        <FormulaDebugger raw="=A1+A2*2" sheet={sheet} premium={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Lihat rumusmu dihitung pelan-pelan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Langkah berikutnya/ })).not.toBeInTheDocument();
  });

  it('Premium: langkah muncul satu per satu sampai hasil akhir', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FormulaDebugger raw="=A1+A2*2" sheet={sheet} premium />
      </MemoryRouter>,
    );
    const next = screen.getByRole('button', { name: /Langkah berikutnya/ });
    expect(screen.getByLabelText('Langkah penelusuran').querySelectorAll('li')).toHaveLength(1);
    await user.click(next);
    expect(screen.getByLabelText('Langkah penelusuran').querySelectorAll('li')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Tampilkan semua' }));
    expect(screen.getByText('Hasil akhir:')).toBeInTheDocument();
    expect(screen.getByText('Hasil akhir:').closest('p')).toHaveTextContent('50');
    expect(screen.getByRole('button', { name: /Langkah berikutnya/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Ulangi' }));
    expect(screen.queryByText('Hasil akhir:')).not.toBeInTheDocument();
  });

  it('Premium: rumus yang tidak bisa dibaca dijelaskan, bukan membuat halaman rusak', () => {
    render(
      <MemoryRouter>
        <FormulaDebugger raw="=SUM(A1" sheet={sheet} premium />
      </MemoryRouter>,
    );
    expect(screen.getByText(/belum bisa ditelusuri/)).toBeInTheDocument();
  });
});

describe('halaman Wizard rumus', () => {
  it('akun gratis: tujuan dasar menampilkan rumus dan hasil, tujuan lanjutan terkunci', async () => {
    mockApi({ ...SIGNED_IN });
    renderApp('/wizard');
    const user = userEvent.setup();
    expect(await screen.findByTestId('wizard-formula')).toHaveTextContent('=SUM(D2:D8)');
    expect(screen.getByTestId('wizard-outcome')).toHaveTextContent('23');
    await user.click(screen.getByRole('button', { name: /Menghitung yang memenuhi syarat/ }));
    expect(screen.getByText('Rumus ini khusus Premium')).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-formula')).not.toBeInTheDocument();
  });

  it('Premium: SUMIF dirakit dari isian, teks diberi tanda kutip, dan hasil dihitung', async () => {
    mockApi({ ...premiumSession });
    renderApp('/wizard');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Menjumlahkan yang memenuhi syarat/ }));
    expect(screen.getByTestId('wizard-formula')).toHaveTextContent('=SUMIF(B2:B8,"Minuman",C2:C8)');
    expect(screen.getByTestId('wizard-outcome')).toHaveTextContent('53');
    const crit = screen.getByLabelText('Syaratnya');
    await user.clear(crit);
    await user.type(crit, 'Makanan');
    expect(screen.getByTestId('wizard-formula')).toHaveTextContent('=SUMIF(B2:B8,"Makanan",C2:C8)');
    const range = screen.getByLabelText('Rentang yang diperiksa');
    await user.clear(range);
    await user.type(range, 'B2');
    expect(screen.getByText(/harus berupa rentang/)).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-formula')).not.toBeInTheDocument();
  });
});

describe('halaman Template', () => {
  const TEMPLATES = [
    { slug: 'laporan-penjualan', title: 'Laporan Penjualan', description: 'd1', category: 'Usaha', free: true, premiumOnly: false, forWho: 'u', sheets: ['Rekap'], formulas: ['SUMIFS'] },
    { slug: 'stok-barang', title: 'Stok Barang', description: 'd2', category: 'Usaha', free: false, premiumOnly: true, forWho: 'u', sheets: ['Barang'], formulas: ['SUMIF'] },
  ];
  const CHEATS = [{ slug: 'rumus-dasar', title: 'Rumus Dasar', summary: 's', lessons: 5 }];

  it('pengunjung: diajak masuk untuk mengunduh', async () => {
    mockApi({ 'GET /auth/me': { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'x' } } }, 'GET /templates': TEMPLATES });
    renderApp('/template');
    expect(await screen.findByText('Laporan Penjualan')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Masuk untuk mengunduh' })).toHaveLength(2);
  });

  it('akun gratis: gratis bisa diunduh, Premium diarahkan ke halaman Premium', async () => {
    mockApi({ ...SIGNED_IN, 'GET /templates': TEMPLATES, 'GET /cheatsheets': CHEATS });
    renderApp('/template');
    const dl = await screen.findByRole('link', { name: /Unduh \.xlsx/ });
    expect(dl).toHaveAttribute('href', '/api/templates/laporan-penjualan/download');
    const locked = screen.getAllByRole('link', { name: /Premium/ }).filter((a) => a.getAttribute('href') === '/premium');
    expect(locked.length).toBeGreaterThanOrEqual(2); // template Premium dan contekan PDF
  });

  it('akun Premium: semua bisa diunduh, termasuk contekan PDF', async () => {
    mockApi({ ...premiumSession, 'GET /templates': TEMPLATES, 'GET /cheatsheets': CHEATS });
    renderApp('/template');
    expect(await screen.findAllByRole('link', { name: /Unduh \.xlsx/ })).toHaveLength(2);
    expect(await screen.findByRole('link', { name: /Unduh PDF/ })).toHaveAttribute('href', '/api/cheatsheets/rumus-dasar/download');
  });
});

describe('halaman Laporan kemajuan', () => {
  const REPORT = {
    summary: { totalExercises: 10, completed: 3, attempts: 8, accuracy: 0.5, points: 30, activeDays: 2, streak: 1, reviewPending: 2 },
    topics: [
      { topic: 'rumus-dasar', title: 'Rumus Dasar', totalExercises: 5, completed: 1, attempts: 6, correctAttempts: 2, accuracy: 1 / 3, level: 'perlu-latihan' },
      { topic: 'logika', title: 'Logika', totalExercises: 5, completed: 2, attempts: 2, correctAttempts: 2, accuracy: 1, level: 'lumayan' },
    ],
    weakest: ['rumus-dasar'],
    recommendations: [{ slug: 'total-pengeluaran', title: 'Total pengeluaran bulanan', topic: 'rumus-dasar', topicTitle: 'Rumus Dasar', difficulty: 'mudah', reason: 'Kamu pernah salah di latihan ini. Coba lagi sekarang.' }],
  };

  it('akun gratis: ajakan Premium dan tidak memanggil laporan', async () => {
    const api = mockApi({ ...SIGNED_IN });
    renderApp('/laporan');
    expect(await screen.findByText('Laporan kemajuan khusus Premium')).toBeInTheDocument();
    expect(api.mock.calls.some((c) => String(c[0]).includes('/progress/report'))).toBe(false);
  });

  it('Premium: ringkasan, topik terlemah, dan rekomendasi tampil', async () => {
    mockApi({ ...premiumSession, 'GET /progress/report': REPORT });
    renderApp('/laporan');
    expect(await screen.findByText('Perlu latihan', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Total pengeluaran bulanan' })).toHaveAttribute('href', '/latihan/total-pengeluaran');
    expect(screen.getByText(/Topik yang paling perlu diperkuat/)).toHaveTextContent('Rumus Dasar');
  });
});
