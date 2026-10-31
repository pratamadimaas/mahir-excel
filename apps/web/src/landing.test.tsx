import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { vi } from 'vitest';
import { exercises, modules, paths, validateSubmission } from '@excellab/shared';
import { Sheet, formatValue, indexToCol, isError } from '@excellab/spreadsheet-engine';
import { EMPTY_PROGRESS, MODULES, STUDENT, mockApi, renderApp } from './testutil';
import { AUDIENCE, ERROR_CASES, FEEDBACK_STEPS, MODULE_OUTCOMES, TRY_EXPECTED, TRY_TABLE, type Row } from './features/home/landingData';

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
    expect(await screen.findByRole('heading', { name: /Mahir Excel untuk siapa/ })).toBeInTheDocument();
    for (const name of [
      /Cara kerja latihannya/,
      /Coba sebelum daftar/,
      /Jumlahkan semua biaya di sel B6/,
      /Pilih bidang yang dekat dengan kerjaanmu/,
      /Baca satu pelajaran dulu/,
      /Selain pelajaran/,
      /Belajar gratis\. Premium/,
      /Pertanyaan yang sering muncul/,
      /Dibuat oleh siapa dan kenapa/,
      /Mulai dari satu rumus/,
    ])
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();

    expect(await screen.findByText(/30 pelajaran dan 54 latihan/)).toBeInTheDocument();
    expect(screen.getByText('50 file data latihan')).toBeInTheDocument();
    expect(screen.getByText(/dengan 33 fungsi/)).toBeInTheDocument();
    expect(screen.getByText('Rp 29.000 untuk 12 bulan')).toBeInTheDocument();
    // Tidak ada em-dash atau en-dash di teks halaman.
    expect(document.body.textContent).not.toMatch(/[–—]/);
  });

  it('angka tidak dikarang bila server gagal: halaman tetap tampil tanpa jumlah', async () => {
    mockApi({ ...anon, 'GET /public/overview': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }) });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /Pilih bidang yang dekat dengan kerjaanmu/ })).toBeInTheDocument();
    expect(screen.queryByText(/pelajaran dan .* latihan, disusun/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dengan \d+ fungsi/)).not.toBeInTheDocument();
  });

  it('lab kesalahan: ganti kasus, lihat galat, tekan Perbaiki untuk melihat hasil yang benar', async () => {
    mockApi(anon);
    renderApp('/');
    await userEvent.click(await screen.findByRole('tab', { name: 'Hasilnya aneh?' }));
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
    await userEvent.click(await screen.findByRole('tab', { name: 'Hasilnya aneh?' }));
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
    expect(within(details).getByText(/Premium menambah pemeriksaan berkas yang kamu unggah/)).toBeInTheDocument();
  });

  it('pengguna yang sudah masuk tidak melihat beranda pengunjung', async () => {
    mockApi({
      ...anon,
      'GET /auth/me': { user: STUDENT, csrfToken: 'tok' },
      'GET /progress': EMPTY_PROGRESS,
      'GET /progress/review-due': { due: [], upcoming: 0 },
    });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Urutan belajar pemula' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Hasilnya aneh/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Mulai dari satu rumus/ })).not.toBeInTheDocument();
  });
});

describe('susunan beranda yang baru', () => {
  it('setiap modul punya satu kalimat hasil nyata', () => {
    for (const m of modules) expect(MODULE_OUTCOMES[m.slug], m.slug).toBeTruthy();
    expect(Object.keys(MODULE_OUTCOMES).sort()).toEqual(modules.map((m) => m.slug).sort());
  });

  it('urutan bagian: cara kerja, untuk siapa, bidang, pelajaran contoh, demo, alat, harga, FAQ, pembuat', async () => {
    mockApi(anon);
    renderApp('/');
    await screen.findByRole('heading', { name: /Mahir Excel untuk siapa/ });
    const order = [
      /Cara kerja latihannya/,
      /Mahir Excel untuk siapa/,
      /Pilih bidang yang dekat dengan kerjaanmu/,
      /Baca satu pelajaran dulu/,
      /Coba sebelum daftar/,
      /Selain pelajaran/,
      /Belajar gratis\. Premium/,
      /Pertanyaan yang sering muncul/,
      /Dibuat oleh siapa/,
    ];
    const all = [...document.querySelectorAll('main h2')].map((h) => h.textContent ?? '');
    const positions = order.map((re) => all.findIndex((t) => re.test(t)));
    for (const p of positions) expect(p).toBeGreaterThanOrEqual(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('bagian untuk siapa menyebut tiga kelompok pembaca dan menautkan uji kemampuan Excel', async () => {
    mockApi(anon);
    renderApp('/');
    const h = await screen.findByRole('heading', { name: /Mahir Excel untuk siapa/ });
    const section = h.closest('section')!;
    for (const t of AUDIENCE) expect(within(section).getByText(t.title)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Ikuti Uji Kemampuan Excel' })).toHaveAttribute('href', '/tes-penempatan');
  });

  it('kurikulum menampilkan hasil nyata tiap modul dan menjadi tujuan tautan #belajar', async () => {
    mockApi(anon);
    renderApp('/');
    expect(await screen.findByText(/Hasilnya: Menjumlahkan dan merata-ratakan data dengan rumus/)).toBeInTheDocument();
    expect(document.getElementById('belajar')).not.toBeNull();
    expect(document.getElementById('harga')).not.toBeNull();
    expect(document.getElementById('faq')).not.toBeNull();
  });

  it('cara kerja latihan: tiga langkah unduh, kerjakan, unggah, dengan dua catatan yang bisa dibuktikan', async () => {
    mockApi(anon);
    renderApp('/');
    const section = (await screen.findByRole('heading', { name: /Cara kerja latihannya/ })).closest('section')!;
    const steps = within(within(section).getByRole('list', { name: 'Tiga langkah mengerjakan latihan' })).getAllByRole('listitem');
    expect(steps.map((s) => s.querySelector('h3')?.textContent)).toEqual(['Unduh berkasnya', 'Kerjakan di Excel', 'Unggah kembali']);
    expect(within(section).getByText(/Yang dinilai adalah rumusnya, bukan hanya angkanya/)).toBeInTheDocument();
    expect(within(section).getByText(/Petunjuk dibuka satu per satu/)).toBeInTheDocument();
  });

  it('bidang: empat kartu yang menuju halamannya, dan daftar modul yang dilipat', async () => {
    mockApi(anon);
    renderApp('/');
    const section = (await screen.findByRole('heading', { name: /Pilih bidang yang dekat dengan kerjaanmu/ })).closest('section')!;
    const beds = paths.map((p) => within(section).getByRole('link', { name: new RegExp(p.title) }));
    expect(beds.map((a) => a.getAttribute('href'))).toEqual(paths.map((p) => `/jalur/${p.slug}`));
    expect(paths.map((p) => p.slug)).toEqual(['perkantoran-admin', 'admin-hrd', 'jualan-usaha', 'keuangan-dasar']);
    expect(within(section).getByRole('link', { name: 'Ikuti Uji Kemampuan Excel' })).toHaveAttribute('href', '/tes-penempatan');

    const fold = section.querySelector('details')!;
    expect(fold).not.toHaveAttribute('open');
    expect(within(fold).getByText(/Isi lengkap: 2 modul/)).toBeInTheDocument();
    await userEvent.click(within(fold).getByText(/Lihat semua modul/));
    expect(fold).toHaveAttribute('open');
  });

  it('tiga demo menjadi satu bagian bertab, dan tab bisa dipindah dengan panah', async () => {
    mockApi(anon);
    renderApp('/');
    const user = userEvent.setup();
    const tabs = await screen.findByRole('tablist', { name: 'Pilih contoh' });
    const rumus = within(tabs).getByRole('tab', { name: 'Coba satu rumus' });
    expect(rumus).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /Jumlahkan semua biaya di sel B6/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Hasilnya aneh/ })).not.toBeInTheDocument();

    rumus.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(tabs).getByRole('tab', { name: 'Hasilnya aneh?' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: /Hasilnya aneh/ })).toBeInTheDocument();

    await user.click(within(tabs).getByRole('tab', { name: 'Salah itu wajar' }));
    expect(await screen.findByRole('heading', { name: /Salah itu wajar/ })).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getByText(FEEDBACK_STEPS[0]!.formula)).toBeInTheDocument();
  });

  it('Sprint hanya satu kartu di kotak alat, dan bagian sertifikat serta batasan tidak ada lagi', async () => {
    mockApi(anon);
    renderApp('/');
    const sprint = await screen.findByRole('heading', { name: 'Sprint 60 detik' });
    expect(within(sprint.closest('article')!).getByRole('link', { name: /Main sekarang/ })).toHaveAttribute('href', '/sprint');
    expect(screen.queryByRole('img', { name: /Contoh sertifikat/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Bukti belajar yang bisa diperiksa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Yang sebaiknya kamu tahu/ })).not.toBeInTheDocument();
  });

  it('hero: satu tombol utama, cek level hanya tautan teks, dan navbar pengunjung memuat Bidang dan tiga tautan bagian', async () => {
    mockApi(anon);
    renderApp('/');
    const hero = (await screen.findByRole('heading', { level: 1, name: /Latihan Excel yang langsung dinilai/ })).closest('section')!;
    expect(within(hero).getByRole('link', { name: 'Daftar gratis' })).toHaveClass('btn-primary');
    const link = within(hero).getByRole('link', { name: 'Cek levelmu terlebih dahulu (16 soal)' });
    expect(link).toHaveAttribute('href', '/tes-penempatan');
    expect(link).not.toHaveClass('btn');

    const nav = screen.getByRole('navigation', { name: 'Navigasi utama' });
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Bidang', '/jalur'],
      ['Belajar', '/#belajar'],
      ['Data Latihan', '/data-latihan'],
      ['Harga', '/#harga'],
      ['FAQ', '/#faq'],
    ]);
  });

  it('membuka /#harga menggulir ke bagian harga', async () => {
    // test-setup.ts sudah mengganti scrollIntoView dengan vi.fn() di HTMLElement.prototype.
    const spy = HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    spy.mockClear();
    mockApi(anon);
    renderApp('/#harga');
    await screen.findByRole('heading', { name: /Belajar gratis\. Premium/ });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect((spy.mock.contexts[0] as HTMLElement).id).toBe('harga');
  });
});

describe('profil pembuat dan angka di beranda', () => {
  it('tabel paket memuat angka asli dari server dan harga dari konfigurasi', async () => {
    mockApi(anon);
    renderApp('/');
    const table = await screen.findByRole('table', { name: 'Perbandingan paket Gratis dan Premium' });
    expect(within(table).getByRole('rowheader', { name: 'Semua pelajaran (30) dan latihan (54)' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: '10 worksheet .xlsx dan 50 file data latihan' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Periksa berkas hasil kerjamu: unggah, sistem menilai per tugas' })).toBeInTheDocument();
    expect(within(table).getByText('Rp 29.000 untuk 12 bulan')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Daftar gratis' })).toHaveAttribute('href', '/daftar');
    expect(within(table).getByRole('link', { name: 'Lihat Premium' })).toHaveAttribute('href', '/premium');
  });

  it('angka tidak dikarang di tabel paket bila server gagal', async () => {
    mockApi({ ...anon, 'GET /public/overview': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }) });
    renderApp('/');
    const table = await screen.findByRole('table', { name: 'Perbandingan paket Gratis dan Premium' });
    expect(within(table).getByRole('rowheader', { name: 'Semua pelajaran dan latihan' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Worksheet dan data latihan (.xlsx, .csv)' })).toBeInTheDocument();
  });

  it('bagian "Dibuat oleh siapa dan kenapa" memuat alasan, cara materi dijaga, dan tidak menyebut instansi mana pun', async () => {
    mockApi(anon);
    renderApp('/');
    const h = await screen.findByRole('heading', { name: 'Dibuat oleh siapa dan kenapa' });
    const section = h.closest('section')!;
    expect(within(section).getByText('Kenapa ada')).toBeInTheDocument();
    expect(within(section).getByText('Cara materi dijaga')).toBeInTheDocument();
    expect(within(section).getByText('Siapa di baliknya')).toBeInTheDocument();
    expect(within(section).getByText(/Satu orang yang membangun dan merawatnya sendiri/)).toBeInTheDocument();
    expect(within(section).queryByText(/belum diverifikasi/)).not.toBeInTheDocument();
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
