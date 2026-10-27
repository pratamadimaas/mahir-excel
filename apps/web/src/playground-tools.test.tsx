import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { shiftFormula } from '@excellab/spreadsheet-engine';
import { MODULES, SIGNED_IN, mockApi, renderApp } from './testutil';
import { filterRows, parseDataRange, sortRows } from './components/spreadsheet/dataOps';

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

describe('alat Urutkan dan Filter', () => {
  it('mengurutkan seluruh baris sehingga nilai tetap berpasangan, kosong selalu terakhir', async () => {
    mockApi({ ...base, 'GET /exercises/uji-sort': SORT_EX });
    renderApp('/latihan/uji-sort');
    await screen.findByRole('group', { name: 'Alat data: urutkan dan filter' });
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

  it('filter menyembunyikan baris, melaporkan jumlah, dan dapat dihapus', async () => {
    mockApi({ ...base, 'GET /exercises/uji-sort': SORT_EX });
    renderApp('/latihan/uji-sort');
    await screen.findByRole('group', { name: 'Alat data: urutkan dan filter' });
    await userEvent.selectOptions(screen.getByLabelText('Kolom', { selector: '#filter-col' }), '1'); // Kota
    await userEvent.type(screen.getByLabelText('Nilai'), 'bandung');
    await userEvent.click(screen.getByRole('button', { name: /Terapkan/ }));
    expect(screen.getByText('2 dari 4 baris ditemukan.')).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: /^A3: Ani/ })).not.toBeInTheDocument();
    expect(cell(/^A2: Citra/)).toBeInTheDocument();
    expect(cell(/^A4: Beni/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Hapus filter/ }));
    expect(cell(/^A3: Ani/)).toBeInTheDocument();
  });

  it('filter angka "lebih besar dari" dan reset mengembalikan data awal', async () => {
    mockApi({ ...base, 'GET /exercises/uji-sort': SORT_EX });
    renderApp('/latihan/uji-sort');
    await screen.findByRole('group', { name: 'Alat data: urutkan dan filter' });
    await userEvent.selectOptions(screen.getByLabelText('Kolom', { selector: '#filter-col' }), '2');
    await userEvent.selectOptions(screen.getByLabelText('Syarat'), 'lebih-besar');
    await userEvent.type(screen.getByLabelText('Nilai'), '75');
    await userEvent.click(screen.getByRole('button', { name: /Terapkan/ }));
    expect(screen.getByText('2 dari 4 baris ditemukan.')).toBeInTheDocument(); // 90 dan 80

    await userEvent.click(screen.getByRole('button', { name: /Urutkan|Turun/ }));
    await userEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(cell(/^A2: Citra/)).toBeInTheDocument();
    expect(cell(/^A3: Ani/)).toBeInTheDocument();
  });

  it('logika murni: parseDataRange, sortRows, dan filterRows', () => {
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
    const f = filterRows(range, 1, 'lebih-kecil', '3', valueOf);
    expect([...f.hidden]).toEqual([2]);
    expect(f.visible).toBe(2);
    expect(filterRows(range, 0, 'sama', '', valueOf).hidden.size).toBe(0);
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
