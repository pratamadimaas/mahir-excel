import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Worksheet } from 'exceljs';
import type { PublicExercise } from '@excellab/shared';
import { shiftFormula } from '@excellab/spreadsheet-engine';
import { MODULES, SIGNED_IN, mockApi, renderApp } from './testutil';
import { currentRegion, distinctTexts, hiddenByFilters, parseDataRange, sortRows } from './components/spreadsheet/dataOps';
import { SHEET_NAME, buildExerciseWorkbook } from './components/spreadsheet/excelFile';

const base = {
  ...SIGNED_IN,
  'GET /modules': MODULES,
  'GET /exercises': () => ({ body: { data: [], meta: { page: 1, pageSize: 100, total: 0 } } }),
  'POST /track': { counted: true },
};

const SORT_EX = {
  slug: 'uji-sort',
  title: 'Uji sort dan filter',
  description: 'd',
  topic: 'mengolah-data',
  difficulty: 'mudah',
  rows: 7,
  cols: 4,
  cells: {
    A1: 'Nama',
    B1: 'Kota',
    C1: 'Nilai',
    A2: 'Citra',
    B2: 'Bandung',
    C2: '70',
    A3: 'Ani',
    B3: 'Jakarta',
    C3: '90',
    A4: 'Beni',
    B4: 'Bandung',
    C4: '80',
    A5: 'Dedi',
    B5: 'Surabaya',
    C5: '',
  },
  editable: ['A2:C5'],
  task: 'Urutkan.',
  hints: ['h1', 'h2'],
  points: 10,
  lessonSlug: null,
  targetCells: ['A2'],
  tools: { sort: { range: 'A1:C5' }, filter: { range: 'A1:C5' } },
};

const FILL_EX = {
  slug: 'uji-isi',
  title: 'Uji isi otomatis',
  description: 'd',
  topic: 'rumus-dasar',
  difficulty: 'mudah',
  rows: 6,
  cols: 4,
  cells: { A1: 'Harga', B1: 'Pajak', A2: '100', A3: '200', A4: '300', E1: '0.1' },
  editable: ['B2:B4'],
  task: 'Isi.',
  hints: ['h1', 'h2'],
  points: 10,
  lessonSlug: null,
  targetCells: ['B2'],
  tools: null,
};

const cell = (name: RegExp) => screen.getByRole('gridcell', { name });

describe('alat Urutkan dan Filter (panah di judul kolom)', () => {
  it('mengurutkan seluruh baris sehingga nilai tetap berpasangan, kosong selalu terakhir', async () => {
    mockApi({ ...base, 'GET /exercises/uji-sort': SORT_EX });
    renderApp('/latihan/uji-sort');
    await screen.findByRole('group', { name: 'Alat data: urutkan' });
    await userEvent.selectOptions(screen.getByLabelText('Kolom', { selector: '#sort-col' }), '2'); // Nilai
    await userEvent.click(screen.getByRole('button', { name: /Turun/ }));
    expect(cell(/^A2: Ani/)).toBeInTheDocument();
    expect(cell(/^B2: Jakarta/)).toBeInTheDocument(); // pasangan ikut pindah
    expect(cell(/^C2: 90/)).toBeInTheDocument();
    expect(cell(/^A3: Beni/)).toBeInTheDocument();
    expect(cell(/^A4: Citra/)).toBeInTheDocument();
    expect(cell(/^A5: Dedi/)).toBeInTheDocument(); // nilai kosong di akhir
    expect(screen.getByText(/Data diurutkan menurut “Nilai”/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Naik/ }));
    expect(cell(/^A2: Citra/)).toBeInTheDocument();
    expect(cell(/^A5: Dedi/)).toBeInTheDocument(); // tetap terakhir saat naik
  });

  const filterBtn = (col: string) => screen.getByRole('button', { name: new RegExp(`^Filter kolom ${col}`) });
  const menu = (col: string) => within(screen.getByRole('dialog', { name: `Filter kolom ${col}` }));

  it('panah filter di judul kolom membuka daftar centang; OK menyembunyikan baris, melaporkan jumlah, dan dapat dihapus', async () => {
    mockApi({ ...base, 'GET /exercises/uji-sort': SORT_EX });
    renderApp('/latihan/uji-sort');
    await screen.findByRole('group', { name: 'Alat data: urutkan' });
    await userEvent.click(filterBtn('Kota'));
    expect(menu('Kota').getByRole('checkbox', { name: /Bandung/ })).toBeChecked();
    await userEvent.click(menu('Kota').getByRole('checkbox', { name: /Pilih Semua/ })); // kosongkan semua
    await userEvent.click(menu('Kota').getByRole('checkbox', { name: /Bandung/ }));
    await userEvent.click(menu('Kota').getByRole('button', { name: 'OK' }));
    expect(screen.getByText('2 dari 4 baris ditemukan.')).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: /^A3: Ani/ })).not.toBeInTheDocument();
    expect(cell(/^A2: Citra/)).toBeInTheDocument();
    expect(cell(/^A4: Beni/)).toBeInTheDocument();
    expect(filterBtn('Kota')).toHaveAccessibleName(/aktif/);

    await userEvent.click(filterBtn('Kota'));
    await userEvent.click(menu('Kota').getByRole('button', { name: 'Hapus filter' }));
    expect(cell(/^A3: Ani/)).toBeInTheDocument();
    expect(screen.queryByText(/baris ditemukan/)).not.toBeInTheDocument();
  });

  it('kotak cari menyaring daftar, dan filter dua kolom bekerja bersama; Reset mengembalikan semuanya', async () => {
    mockApi({ ...base, 'GET /exercises/uji-sort': SORT_EX });
    renderApp('/latihan/uji-sort');
    await screen.findByRole('group', { name: 'Alat data: urutkan' });
    await userEvent.click(filterBtn('Nilai'));
    await userEvent.click(menu('Nilai').getByRole('checkbox', { name: /Pilih Semua/ }));
    await userEvent.click(menu('Nilai').getByRole('checkbox', { name: '80' }));
    await userEvent.click(menu('Nilai').getByRole('checkbox', { name: '90' }));
    await userEvent.click(menu('Nilai').getByRole('button', { name: 'OK' }));
    expect(screen.getByText('2 dari 4 baris ditemukan.')).toBeInTheDocument(); // Ani 90 dan Beni 80

    await userEvent.click(filterBtn('Kota'));
    await userEvent.type(menu('Kota').getByRole('searchbox', { name: 'Cari nilai' }), 'jak');
    expect(menu('Kota').queryByRole('checkbox', { name: /Bandung/ })).not.toBeInTheDocument();
    expect(menu('Kota').getByRole('checkbox', { name: /Jakarta/ })).toBeInTheDocument();
    await userEvent.click(menu('Kota').getByRole('checkbox', { name: /Pilih Semua Hasil Pencarian/ })); // matikan Jakarta
    await userEvent.click(menu('Kota').getByRole('button', { name: 'OK' }));
    expect(screen.getByText('1 dari 4 baris ditemukan.')).toBeInTheDocument(); // hanya Beni (Bandung, 80)
    expect(cell(/^A4: Beni/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(cell(/^A2: Citra/)).toBeInTheDocument();
    expect(cell(/^A3: Ani/)).toBeInTheDocument();
    expect(screen.queryByText(/baris ditemukan/)).not.toBeInTheDocument();
  });

  it('latihan tanpa alat filter punya tombol Filter yang menyalakan panah di tabelnya', async () => {
    const ex = { ...SORT_EX, slug: 'uji-tanpa-alat', tools: null };
    mockApi({ ...base, 'GET /exercises/uji-tanpa-alat': ex });
    renderApp('/latihan/uji-tanpa-alat');
    await screen.findByRole('heading', { level: 1, name: ex.title });
    expect(screen.queryByRole('button', { name: /^Filter kolom/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(filterBtn('Kota'));
    await userEvent.click(menu('Kota').getByRole('checkbox', { name: /Pilih Semua/ }));
    await userEvent.click(menu('Kota').getByRole('checkbox', { name: /Jakarta/ }));
    await userEvent.click(menu('Kota').getByRole('button', { name: 'OK' }));
    expect(screen.getByText('1 dari 4 baris ditemukan.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' })); // matikan: filter ikut hilang
    expect(screen.queryByRole('button', { name: /^Filter kolom/ })).not.toBeInTheDocument();
    expect(cell(/^A4: Beni/)).toBeInTheDocument();
  });

  it('SUBTOTAL ikut menyaring: hanya menjumlah baris yang tampil, SUM tetap semuanya', async () => {
    const ex = {
      ...SORT_EX,
      slug: 'uji-subtotal',
      rows: 7,
      cells: { ...SORT_EX.cells, C5: '60', E1: 'Total', E2: '=SUBTOTAL(9,C2:C5)', E4: '=SUM(C2:C5)' },
      cols: 5,
      editable: ['A2:C5'],
    };
    mockApi({ ...base, 'GET /exercises/uji-subtotal': ex });
    renderApp('/latihan/uji-subtotal');
    await screen.findByRole('group', { name: 'Alat data: urutkan' });
    expect(cell(/^E2: 300/)).toBeInTheDocument(); // 70+90+80+60
    await userEvent.click(filterBtn('Kota'));
    await userEvent.click(menu('Kota').getByRole('checkbox', { name: /Pilih Semua/ }));
    await userEvent.click(menu('Kota').getByRole('checkbox', { name: /Bandung/ }));
    await userEvent.click(menu('Kota').getByRole('button', { name: 'OK' }));
    expect(cell(/^E2: 150/)).toBeInTheDocument(); // Citra 70 + Beni 80
    expect(cell(/^E4: 300/)).toBeInTheDocument(); // baris 4 tetap tampil
  });

  it('logika murni: parseDataRange, sortRows, currentRegion, distinctTexts, dan hiddenByFilters', () => {
    const range = parseDataRange('A1:B4')!;
    expect(range).toEqual({ top: 1, bottom: 4, left: 0, right: 1 });
    const cells = { A1: 'N', B1: 'V', A2: 'x', B2: '3', A3: 'y', B3: '1', A4: 'z', B4: '2' };
    const valueOf = (ref: string) => {
      const raw = (cells as Record<string, string>)[ref];
      return raw === undefined ? null : /^\d+$/.test(raw) ? Number(raw) : raw;
    };
    const asc = sortRows(cells, range, 1, 'asc', valueOf);
    expect([asc.A2, asc.A3, asc.A4]).toEqual(['y', 'z', 'x']);
    expect(asc.A1).toBe('N'); // judul tidak ikut terurut

    const textOf = (ref: string) => (cells as Record<string, string>)[ref] ?? '';
    expect(distinctTexts(range, 1, textOf)).toEqual(['1', '2', '3']);
    const hidden = hiddenByFilters(range, new Map([[1, new Set(['1', '2'])]]), textOf);
    expect([...hidden]).toEqual([2]);
    expect(hiddenByFilters(range, new Map(), textOf).size).toBe(0);
    // dua kolom: baris tampil hanya bila lolos di keduanya
    expect([...hiddenByFilters(range, new Map([[0, new Set(['y', 'z'])], [1, new Set(['1'])]]), textOf)].sort()).toEqual([2, 4]);
  });

  it('currentRegion mengambil blok tabel dari sel berisi pertama dan mengabaikan sel terpisah', () => {
    const cells = { A1: 'Nama', B1: 'Nilai', A2: 'x', B2: '1', A3: 'y', B3: '2', E1: '0.1' };
    expect(currentRegion(cells, 6, 6)).toEqual({ top: 1, bottom: 3, left: 0, right: 1 }); // E1 terpisah: tidak ikut
    expect(currentRegion({ A1: 'a', A2: 'b' }, 4, 4)).toBeNull(); // terlalu kecil untuk disaring
    expect(currentRegion({}, 4, 4)).toBeNull();
  });

  it('sort menggeser referensi relatif rumus mengikuti barisnya', () => {
    const range = parseDataRange('A1:B3')!;
    const cells = { A1: 'N', B1: 'Total', A2: '5', B2: '=A2*2', A3: '1', B3: '=A3*2' };
    const valueOf = (ref: string) => (ref === 'A2' ? 5 : ref === 'A3' ? 1 : null);
    const out = sortRows(cells, range, 0, 'asc', valueOf);
    expect(out.A2).toBe('1');
    expect(out.B2).toBe('=A2*2');
    expect(out.B3).toBe('=A3*2');
  });
});

describe('isi otomatis (fill)', () => {
  it('tombol Isi ke bawah menyalin rumus dengan referensi relatif bergeser dan absolut tetap', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(screen.getByRole('textbox', { name: 'Isi sel B2' }), '=A2*$E$1');
    expect(cell(/^B2: 10/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Isi ke bawah/ }));
    expect(cell(/^B3: 20/)).toBeInTheDocument();
    expect(cell(/^B4: 30/)).toBeInTheDocument();
    await userEvent.click(cell(/^B4: 30/));
    expect(screen.getByRole('textbox', { name: 'Isi sel B4' })).toHaveValue('=A4*$E$1');
  });

  it('Ctrl+D menyalin dari sel di atas ke sel terpilih', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(screen.getByRole('textbox', { name: 'Isi sel B2' }), '=A2+1');
    const b3 = cell(/^B3, kosong/);
    await userEvent.click(b3);
    b3.focus();
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(cell(/^B3: 201/)).toBeInTheDocument();
  });

  it('tombol Isi ke bawah dinonaktifkan pada sel kosong atau hanya baca', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    expect(screen.getByRole('button', { name: /Isi ke bawah/ })).toBeDisabled(); // B2 kosong
    await userEvent.click(cell(/^A2: 100/));
    expect(screen.getByRole('button', { name: /Isi ke bawah/ })).toBeDisabled(); // data soal
  });

  it('pengisian melewati sel yang bukan area jawaban dan memberi tahu', async () => {
    const ex = { ...FILL_EX, slug: 'uji-isi2', editable: ['B2:B3'] };
    mockApi({ ...base, 'GET /exercises/uji-isi2': ex });
    renderApp('/latihan/uji-isi2');
    await screen.findByRole('heading', { level: 1, name: ex.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(screen.getByRole('textbox', { name: 'Isi sel B2' }), '=A2');
    await userEvent.click(screen.getByRole('button', { name: /Isi ke bawah/ }));
    expect(cell(/^B3: 200/)).toBeInTheDocument();
    expect(within(cell(/^B4/)).queryByText('300')).not.toBeInTheDocument(); // B4 bukan area jawaban
  });

  it('shiftFormula konsisten dengan perilaku Excel pada rentang campuran', () => {
    expect(shiftFormula('=SUMIFS($C$2:$C$9,$A$2:$A$9,$E2,$B$2:$B$9,F$1)', 1, 1)).toBe('=SUMIFS($C$2:$C$9,$A$2:$A$9,$E3,$B$2:$B$9,G$1)');
  });
});

describe('mode tunjuk sel', () => {
  const bar = () => screen.getByRole('textbox', { name: /Isi sel B2/ });

  it('klik sel setelah = di formula bar menyisipkan alamatnya dan sel terpilih tidak pindah', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(bar(), '=');
    await userEvent.click(cell(/^A2: 100/));
    expect(bar()).toHaveValue('=A2');
    expect(screen.getByTestId('namebox')).toHaveTextContent('B2');
    await userEvent.type(bar(), '*');
    await userEvent.click(cell(/^A3: 200/));
    expect(bar()).toHaveValue('=A2*A3');
    expect(cell(/^B2: 20.000/)).toBeInTheDocument();
  });

  it('klik kedua langsung mengganti alamat yang baru disisipkan', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(bar(), '=SUM(');
    await userEvent.click(cell(/^A2: 100/));
    await userEvent.click(cell(/^A3: 200/));
    expect(bar()).toHaveValue('=SUM(A3');
  });

  it('seret dari satu sel ke sel lain menyisipkan rentang', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(bar(), '=SUM(');
    fireEvent.mouseDown(cell(/^A2: 100/), { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(cell(/^A3: 200/), { clientX: 10, clientY: 40 });
    fireEvent.mouseEnter(cell(/^A4: 300/), { clientX: 10, clientY: 70 });
    fireEvent.mouseUp(window);
    expect(bar()).toHaveValue('=SUM(A2:A4');
    await userEvent.type(bar(), ')');
    expect(cell(/^B2: 600/)).toBeInTheDocument();
  });

  it('sel yang "masuk" karena tata letak bergeser di bawah kursor yang diam tidak memperluas rentang', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(bar(), '=');
    fireEvent.mouseDown(cell(/^A3: 200/), { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(cell(/^A2: 100/), { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window);
    expect(bar()).toHaveValue('=A3');
  });

  it('di dalam sel: klik menyisipkan alamat, dan setelah operand klik biasa memindahkan sel', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.dblClick(cell(/^B2, kosong/));
    const inCell = () => document.querySelector<HTMLInputElement>('td[data-ref="B2"] input')!;
    await userEvent.type(inCell(), '=');
    await userEvent.click(cell(/^A2: 100/));
    expect(inCell()).toHaveValue('=A2');
    await userEvent.keyboard('{Enter}');
    expect(cell(/^B2: 100/)).toBeInTheDocument();
  });

  it('Enter di formula bar menyelesaikan rumus dan pindah ke sel di bawahnya', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(bar(), '=');
    await userEvent.click(cell(/^A2: 100/));
    await userEvent.keyboard('{Enter}');
    expect(cell(/^B2: 100/)).toBeInTheDocument();
    expect(screen.getByTestId('namebox')).toHaveTextContent('B3');
    await userEvent.click(cell(/^B4, kosong/)); // klik biasa setelah selesai tidak menyentuh rumus B2
    expect(cell(/^B2: 100/)).toBeInTheDocument();
  });

  it('F4 mengunci referensi di kursor', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(bar(), '=A2*E1');
    await userEvent.keyboard('{F4}');
    expect(bar()).toHaveValue('=A2*$E$1');
    await userEvent.keyboard('{F4}');
    expect(bar()).toHaveValue('=A2*E$1');
  });

  it('tanpa operator di depan, klik sel tetap memindahkan sel terpilih', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(cell(/^B2, kosong/));
    await userEvent.type(bar(), '=A2');
    await userEvent.click(cell(/^B3, kosong/));
    expect(screen.getByTestId('namebox')).toHaveTextContent('B3');
  });
});

describe('mode Excel: unduh soal dan unggah jawaban', { timeout: 30_000 }, () => {
  const asExercise = FILL_EX as unknown as PublicExercise;
  const uploadInput = () => screen.getByLabelText('Pilih file jawaban .xlsx');
  const goodSubmit = {
    correct: true,
    message: 'Jawabanmu benar!',
    targets: [{ cell: 'B2', ok: true, message: 'ok' }],
    pointsAwarded: 10,
    alreadyCompleted: false,
    totalPoints: 10,
    explanation: 'Dikali dua.',
    solution: { B2: '=A2*2' },
  };

  afterEach(() => {
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
    vi.restoreAllMocks();
  });

  async function answerFile(edit: (ws: Worksheet) => void, name = 'jawaban.xlsx'): Promise<File> {
    const wb = await buildExerciseWorkbook(asExercise);
    edit(wb.getWorksheet(SHEET_NAME)!);
    return new File([await wb.xlsx.writeBuffer()], name);
  }

  const submittedBody = () =>
    JSON.parse((vi.mocked(globalThis.fetch).mock.calls.find((c) => String(c[0]).includes('/submit'))![1] as RequestInit).body as string);

  it('Kerjakan di Excel mengunduh file .xlsx dan menampilkan langkah selanjutnya', async () => {
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX });
    const created: Blob[] = [];
    Object.assign(URL, { createObjectURL: (b: Blob) => (created.push(b), 'blob:uji'), revokeObjectURL: () => undefined });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.click(screen.getByRole('button', { name: /Kerjakan di Excel/ }));
    expect(await screen.findByText(/File terunduh/)).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(created[0]!.type).toContain('spreadsheetml');
    expect(created[0]!.size).toBeGreaterThan(1000);
  });

  it('mengunggah jawaban: isi sel masuk ke grid, dikirim ke penilai yang sama, dan hasilnya tampil', async () => {
    const submit = vi.fn(() => ({ body: { data: goodSubmit } }));
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX, 'POST /exercises/uji-isi/submit': submit });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    const file = await answerFile((ws) => {
      for (const r of [2, 3, 4]) ws.getCell(`B${r}`).value = { formula: `A${r}*2` };
    });
    await userEvent.upload(uploadInput(), file);
    const fb = await screen.findByTestId('feedback');
    expect(await within(fb).findByText('Benar!')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submittedBody()).toEqual({ cells: { B2: '=A2*2', B3: '=A3*2', B4: '=A4*2' } });
    expect(cell(/^B3: 400/)).toBeInTheDocument(); // jawaban dari Excel tampil di grid
  });

  it('data soal yang diubah di Excel diberi tahu, dan yang dikirim tetap hanya sel jawaban', async () => {
    const submit = vi.fn(() => ({ body: { data: goodSubmit } }));
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX, 'POST /exercises/uji-isi/submit': submit });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    const file = await answerFile((ws) => {
      ws.getCell('A2').value = 999999;
      ws.getCell('B2').value = { formula: 'A2*2' };
    });
    await userEvent.upload(uploadInput(), file);
    expect(await screen.findByText(/Data soal di A2 berbeda dari aslinya/)).toBeInTheDocument();
    expect(Object.keys(submittedBody().cells).sort()).toEqual(['B2', 'B3', 'B4']);
    expect(cell(/^A2: 100/)).toBeInTheDocument(); // data soal di grid tetap asli
  });

  it('format selain .xlsx ditolak tanpa mengirim apa pun', async () => {
    const submit = vi.fn(() => ({ body: { data: goodSubmit } }));
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX, 'POST /exercises/uji-isi/submit': submit });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.upload(uploadInput(), new File(['a,b'], 'jawaban.csv', { type: 'text/csv' }), { applyAccept: false });
    expect(await screen.findByText(/Pilih file berformat \.xlsx/)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('file rusak menampilkan pesan yang jelas dan tidak mengirim apa pun', async () => {
    const submit = vi.fn(() => ({ body: { data: goodSubmit } }));
    mockApi({ ...base, 'GET /exercises/uji-isi': FILL_EX, 'POST /exercises/uji-isi/submit': submit });
    renderApp('/latihan/uji-isi');
    await screen.findByRole('heading', { level: 1, name: FILL_EX.title });
    await userEvent.upload(uploadInput(), new File(['bukan excel'], 'rusak.xlsx'));
    expect(await screen.findByText(/Berkas tidak bisa dibaca/)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
});
