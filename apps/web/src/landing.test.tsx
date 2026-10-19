import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { exercises, validateSubmission } from '@excellab/shared';
import { Sheet, formatValue, indexToCol, isError } from '@excellab/spreadsheet-engine';
import { EMPTY_PROGRESS, MODULES, STUDENT, mockApi, renderApp } from './testutil';
import { ERROR_CASES, FEEDBACK_STEPS, TRY_EXPECTED, TRY_TABLE, type Row } from './features/home/landingData';

const OVERVIEW = {
  counts: { modules: 8, lessons: 30, exercises: 54, shortcuts: 53, worksheets: 10, functions: 33 },
  modules: [
    { slug: 'mengenal-excel', title: 'Mengenal Excel', summary: 'Workbook dan sel.', lessons: 3, exercises: 3 },
    { slug: 'rumus-dasar', title: 'Rumus Dasar', summary: 'SUM dan kawan-kawan.', lessons: 6, exercises: 12 },
  ],
};

const anon = {
  'GET /auth/me': { user: null, csrfToken: null },
  'GET /auth/config': { emailEnabled: false, googleClientId: null, premium: { priceLabel: 'Rp 29.000 untuk 12 bulan', contactUrl: null } },
  'GET /public/overview': OVERVIEW,
  'GET /public/lessons': [
    { slug: 'fungsi-sum', title: 'SUM: Menjumlahkan Angka', summary: 'Jumlahkan rentang', minutes: 8, moduleTitle: 'Rumus Dasar' },
  ],
  'GET /modules': MODULES,
  'POST /track': { counted: true },
};

const toCells = (table: Row[]): Record<string, string> => {
  const out: Record<string, string> = {};
  table.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== '') out[`${indexToCol(c)}${r + 1}`] = String(v);
    }),
  );
  return out;
};

const shown = (table: Row[], ref: string): string => {
  const v = new Sheet(toCells(table)).getValue(ref);
  if (isError(v)) return v.code;
  return typeof v === 'number' ? formatValue(v) : String(v ?? '');
};

describe('contoh di beranda dijalankan oleh mesin sungguhan', () => {
  it.each(ERROR_CASES.map((c) => [c.id, c] as const))('%s: hasil sebelum dan sesudah diperbaiki sesuai klaim', (_id, c) => {
    expect(shown(c.broken, c.selected)).toBe(c.brokenShows);
    expect(shown(c.fixed, c.selected)).toBe(c.fixedShows);
    expect(c.brokenShows).not.toBe(c.fixedShows);
  });

  it('pesan umpan balik persis sama dengan yang dihasilkan validator latihan sungguhan', () => {
    const ex = exercises.find((e) => e.slug === 'total-pengeluaran')!;
    for (const step of FEEDBACK_STEPS) {
      const r = validateSubmission(ex, { B7: step.formula });
      expect(r.correct, step.formula).toBe(step.ok);
      expect(r.targets[0]!.message, step.formula).toBe(step.message);
    }
  });

  it('latihan mencoba rumus: jawaban benar bernilai target, rentang yang terlewat tidak', () => {
    expect(shown(TRY_TABLE('=SUM(B2:B5)'), 'B6')).toBe(formatValue(TRY_EXPECTED));
    expect(shown(TRY_TABLE('=SUM(B2:B4)'), 'B6')).not.toBe(formatValue(TRY_EXPECTED));
  });
});

describe('beranda pengunjung', () => {
  it('memuat bagian-bagian utama dengan angka dari server, tanpa tanda pisah panjang', async () => {
    mockApi(anon);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /Hasilnya aneh/ })).toBeInTheDocument();
    for (const name of [
      /Coba satu rumus/,
      /Salah itu wajar/,
      /Dari sel pertama sampai VLOOKUP/,
      /Selain pelajaran/,
      /Coba pelajaran contoh/,
      /Yang sebaiknya kamu tahu/,
      /Belajarnya gratis/,
      /Pertanyaan yang sering muncul/,
      /Mulai dari satu rumus/,
    ])
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();

    expect(await screen.findByText(/30 pelajaran dan 54 latihan/)).toBeInTheDocument();
    expect(screen.getByText('53 shortcut')).toBeInTheDocument();
    expect(screen.getByText(/Ada 33 fungsi/)).toBeInTheDocument();
    expect(screen.getByText('Rp 29.000 untuk 12 bulan')).toBeInTheDocument();
    // Tidak ada em-dash atau en-dash di teks halaman.
    expect(document.body.textContent).not.toMatch(/[–—]/);
  });

  it('angka tidak dikarang bila server gagal: halaman tetap tampil tanpa jumlah', async () => {
    mockApi({ ...anon, 'GET /public/overview': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }) });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /Dari sel pertama sampai VLOOKUP/ })).toBeInTheDocument();
    expect(screen.queryByText(/pelajaran dan .* latihan, disusun/)).not.toBeInTheDocument();
    expect(screen.getByText(/Fungsinya terbatas/)).toBeInTheDocument();
  });

  it('lab kesalahan: ganti kasus, lihat galat, tekan Perbaiki untuk melihat hasil yang benar', async () => {
    mockApi(anon);
    renderApp('/');
    expect(await screen.findByRole('gridcell', { name: /^B6: 520\.000/ })).toBeInTheDocument();
    expect(screen.getByText(/Rentang SUM berhenti di B4/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '#N/A' }));
    expect(await screen.findByRole('gridcell', { name: /^E2: #N\/A/ })).toBeInTheDocument();
    expect(screen.getByText(/satu spasi di belakangnya/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Perbaiki' }));
    expect(await screen.findByRole('gridcell', { name: /^E2: 90/ })).toBeInTheDocument();
    expect(screen.getByText(/Hapus spasi berlebih/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan ke semula' }));
    expect(await screen.findByRole('gridcell', { name: /^E2: #N\/A/ })).toBeInTheDocument();

    // Pindah kasus mengembalikan keadaan "belum diperbaiki".
    await userEvent.click(screen.getByRole('tab', { name: 'Hasil jadi 0' }));
    expect(await screen.findByRole('gridcell', { name: /^C3: 0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perbaiki' })).toBeInTheDocument();
  });

  it('tab dapat dipindah dengan panah keyboard', async () => {
    mockApi(anon);
    renderApp('/');
    const first = await screen.findByRole('tab', { name: 'Total kurang' });
    first.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: '#N/A' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '#N/A' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('tab', { name: 'Hasil jadi 0' })).toHaveAttribute('aria-selected', 'true');
  });

  describe('coba satu rumus', () => {
    const type = async (value: string): Promise<void> => {
      const input = await screen.findByLabelText('Rumus untuk sel B6');
      await userEvent.clear(input);
      if (value) await userEvent.type(input, value);
      await userEvent.click(screen.getByRole('button', { name: 'Periksa' }));
    };

    it('SUM yang benar lolos dan mengajak daftar dengan jumlah latihan lain', async () => {
      mockApi(anon);
      renderApp('/');
      await type('=SUM(B2:B5)');
      const box = await screen.findByTestId('coba-hasil');
      expect(within(box).getByText(/Benar\. Totalnya 300\.000/)).toBeInTheDocument();
      expect(within(box).getByText(/Masih ada 53 latihan lain/)).toBeInTheDocument();
      expect(within(box).getByRole('link', { name: 'Daftar gratis' })).toHaveAttribute('href', '/daftar');
    });

    it('angka pas tetapi tanpa SUM ditolak dengan alasan', async () => {
      mockApi(anon);
      renderApp('/');
      await type('=25000+45000+150000+80000');
      expect(await screen.findByText(/latihan ini melatih fungsi SUM/)).toBeInTheDocument();
    });

    it('rentang yang terlewat memberi tahu hasil sebenarnya, bukan jawabannya', async () => {
      mockApi(anon);
      renderApp('/');
      await type('=SUM(B2:B4)');
      const msg = await screen.findByText(/menghasilkan 220\.000, tetapi itu belum sesuai/);
      expect(msg.textContent).not.toContain('300.000');
    });

    it('galat rumus dijelaskan, dan kolom kosong diminta diisi', async () => {
      mockApi(anon);
      renderApp('/');
      await type('=FOO(1)');
      expect(await within(screen.getByTestId('coba-hasil')).findByText(/#NAME\?/)).toBeInTheDocument();
      await type('');
      expect(await screen.findByText('Isi sel B6 dulu dengan sebuah rumus.')).toBeInTheDocument();
    });

    it('tabel di sebelahnya ikut berubah saat mengetik', async () => {
      mockApi(anon);
      renderApp('/');
      const input = await screen.findByLabelText('Rumus untuk sel B6');
      await userEvent.type(input, '=SUM(B2:B3)');
      expect(await screen.findByRole('gridcell', { name: /^B6: 70\.000/ })).toBeInTheDocument();
    });
  });

  it('FAQ memakai elemen details yang dapat dibuka dan ditutup', async () => {
    mockApi(anon);
    renderApp('/');
    const summary = await screen.findByText('Benar-benar gratis?');
    const details = summary.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    await userEvent.click(summary);
    expect(details).toHaveAttribute('open');
    expect(within(details).getByText(/Premium menambah solusi langsung di latihan/)).toBeInTheDocument();
  });

  it('pengguna yang sudah masuk tidak melihat beranda pengunjung', async () => {
    mockApi({
      ...anon,
      'GET /auth/me': { user: STUDENT, csrfToken: 'tok' },
      'GET /progress': EMPTY_PROGRESS,
      'GET /progress/review-due': { due: [], upcoming: 0 },
    });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Jalur belajar pemula' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Hasilnya aneh/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Mulai dari satu rumus/ })).not.toBeInTheDocument();
  });
});

describe('profil pembuat dan angka di beranda', () => {
  it('empat angka asli tampil tepat setelah hero, dengan labelnya', async () => {
    mockApi(anon);
    renderApp('/');
    for (const [n, label] of [
      ['30', 'pelajaran'],
      ['54', 'latihan'],
      ['33', 'fungsi rumus'],
      ['53', 'shortcut'],
    ] as const) {
      const term = await screen.findByText(label, { selector: 'dt' });
      expect(term.nextElementSibling).toHaveTextContent(n);
    }
  });

  it('angka tidak muncul bila server gagal (tidak ada angka karangan)', async () => {
    mockApi({ ...anon, 'GET /public/overview': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }) });
    renderApp('/');
    await screen.findByRole('heading', { name: /Hasilnya aneh/ });
    expect(screen.queryByText('fungsi rumus', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('bagian "Dibuat oleh siapa dan kenapa" memuat alasan, cara materi dijaga, dan tidak menyebut instansi mana pun', async () => {
    mockApi(anon);
    renderApp('/');
    const h = await screen.findByRole('heading', { name: 'Dibuat oleh siapa dan kenapa' });
    const section = h.closest('section')!;
    expect(within(section).getByText('Kenapa ada')).toBeInTheDocument();
    expect(within(section).getByText('Cara materi dijaga benar')).toBeInTheDocument();
    expect(within(section).getByText('Siapa di baliknya')).toBeInTheDocument();
    expect(within(section).getByText(/Seorang pengembang independen/)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Baca selengkapnya' })).toHaveAttribute('href', '/tentang');
    expect(section.textContent).not.toMatch(/Kemenkeu|DJPb|KPPN|pegawai negeri|PNS/i);
  });
});

describe('halaman Tentang', () => {
  it('memuat kenapa dibuat, siapa di baliknya, cara materi dijaga, dan angka dari server', async () => {
    mockApi({ ...anon, 'GET /public/overview': OVERVIEW });
    renderApp('/tentang');
    for (const name of [
      'Tentang Mahir Excel',
      'Kenapa dibuat',
      'Siapa di baliknya',
      'Cara materi dijaga benar',
      'Yang tersedia',
      'Batasan yang jujur',
      'Kontak',
    ])
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
    expect(await screen.findByText(/8 modul dan 30 pelajaran/)).toBeInTheDocument();
    expect(screen.getByText(/54 latihan/)).toBeInTheDocument();
    expect(screen.getByText(/Hanya 33 fungsi yang didukung/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[\u2013\u2014]/);
    expect(document.body.textContent).not.toMatch(/Kemenkeu|DJPb|KPPN/i);
  });

  it('tanpa data server, halaman tetap tampil tanpa angka', async () => {
    mockApi({ ...anon, 'GET /public/overview': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }) });
    renderApp('/tentang');
    expect(await screen.findByRole('heading', { name: 'Kenapa dibuat' })).toBeInTheDocument();
    expect(screen.getByText(/Hanya sebagian fungsi yang didukung/)).toBeInTheDocument();
  });
});
