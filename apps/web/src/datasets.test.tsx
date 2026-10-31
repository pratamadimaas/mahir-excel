import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readDatasetAnswers, readWorksheetCells } from './features/datasets/answers';
import { SIGNED_IN, STUDENT, mockApi, renderApp } from './testutil';

const CATALOG = [
  {
    slug: 'kas-kecil',
    title: 'Kas Kecil',
    field: 'keuangan',
    blurb: 'Buku kas kecil kantor.',
    mess: 'Kolom saldo kosong.',
    rows: 140,
    cols: 5,
    tasks: ['Berapa total penerimaan?', 'Berapa saldo kas kecil?', 'Berapa total pengeluaran untuk "Parkir"?'],
  },
  {
    slug: 'absensi-karyawan-bulanan',
    title: 'Absensi Karyawan Satu Bulan',
    field: 'hrd',
    blurb: 'Jam masuk dan pulang.',
    mess: 'Ada yang lupa absen pulang.',
    rows: 528,
    cols: 5,
    tasks: ['Berapa kali terlambat?', 'Berapa kali lupa absen?', 'Berapa total jam kerja?'],
  },
  {
    slug: 'stok-gudang',
    title: 'Stok Gudang',
    field: 'admin',
    blurb: 'Barang di gudang.',
    mess: 'Ada stok minus.',
    rows: 160,
    cols: 6,
    tasks: ['a?', 'b?', 'c?'],
  },
];

const anon = { 'GET /auth/me': { user: null, csrfToken: null }, 'GET /datasets': CATALOG, 'POST /track': { counted: true } };
const premium = {
  ...SIGNED_IN,
  'GET /auth/me': { user: { ...STUDENT, premium: true }, csrfToken: 'tok' },
  'GET /datasets': CATALOG,
  'POST /track': { counted: true },
};
const free = { ...SIGNED_IN, 'GET /datasets': CATALOG, 'POST /track': { counted: true } };

/** Berkas hasil unduhan yang sudah dikerjakan: sheet Jawaban terisi, penanda tersembunyi ada. */
async function answeredFile(opts: { mark?: boolean } = {}): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const data = wb.addWorksheet('Data');
  data.addRow([10]);
  data.addRow([32]);
  const ans = wb.addWorksheet('Jawaban');
  ans.getCell('C2').value = { formula: 'SUM(Data!A1:A2)', result: 42 };
  ans.getCell('C3').value = 7;
  const mark = wb.addWorksheet('_mahirexcel', { state: 'veryHidden' });
  if (opts.mark !== false) {
    mark.getCell('A1').value = 'mahir-excel-data';
    mark.getCell('A2').value = 'kas-kecil';
  }
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], 'hasil.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('membaca berkas jawaban', () => {
  it('data latihan: nilai hasil rumus, penanda rumus, dan sel kosong', async () => {
    const r = await readDatasetAnswers(await answeredFile());
    expect(r.slug).toBe('kas-kecil');
    expect(r.answers).toEqual([
      { value: 42, formula: true },
      { value: 7, formula: false },
      { value: null, formula: false },
    ]);
  });

  it('berkas tanpa penanda ditolak dengan pesan yang jelas', async () => {
    await expect(readDatasetAnswers(await answeredFile({ mark: false }))).rejects.toThrow(/bukan unduhan dari halaman Data Latihan/);
  });

  it('berkas yang bukan xlsx ditolak', async () => {
    await expect(readDatasetAnswers(new File(['bukan excel'], 'a.xlsx'))).rejects.toThrow(/tidak bisa dibaca/);
  });

  it('worksheet: sel yang diminta dibaca, sheet atau sel yang tidak ada dianggap kosong', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Latihan');
    ws.getCell('E2').value = { formula: 'C2*D2', result: 204000 };
    ws.getCell('H1').value = 'teks';
    const file = new File([await wb.xlsx.writeBuffer()], 'ws.xlsx');
    const cells = await readWorksheetCells(file, [
      { sheet: 'Latihan', ref: 'E2' },
      { sheet: 'Latihan', ref: 'H1' },
      { sheet: 'Latihan', ref: 'Z9' },
      { sheet: 'Tidak Ada', ref: 'A1' },
    ]);
    expect(cells.map(({ ref, value, formula }) => [ref, value, formula])).toEqual([
      ['E2', 204000, true],
      ['H1', 'teks', false],
      ['Z9', null, false],
      ['A1', null, false],
    ]);
  });
});

describe('halaman Data Latihan', () => {
  it('terbuka tanpa login: katalog, tautan unduh xlsx dan csv, dan penyaring bidang', async () => {
    mockApi(anon);
    renderApp('/data-latihan');
    expect(await screen.findByRole('heading', { level: 1, name: 'Data Latihan' })).toBeInTheDocument();
    expect(await screen.findByText('Menampilkan 3 dari 3 file')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unduh Kas Kecil (.xlsx)' })).toHaveAttribute('href', '/api/datasets/kas-kecil/download');
    expect(screen.getByRole('link', { name: 'Unduh Kas Kecil (.csv)' })).toHaveAttribute(
      'href',
      '/api/datasets/kas-kecil/download?format=csv',
    );
    expect(screen.getByText('528 baris · 5 kolom')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Bidang'), 'hrd');
    expect(await screen.findByText('Menampilkan 1 dari 3 file')).toBeInTheDocument();
    expect(screen.getByText('Absensi Karyawan Satu Bulan')).toBeInTheDocument();
    expect(screen.queryByText('Kas Kecil')).not.toBeInTheDocument();
  });

  it('pencarian memeriksa judul dan uraian; hasil kosong ditampilkan dengan jelas', async () => {
    mockApi(anon);
    renderApp('/data-latihan');
    await screen.findByText('Menampilkan 3 dari 3 file');
    await userEvent.type(screen.getByLabelText('Cari data'), 'stok minus');
    expect(await screen.findByText('Menampilkan 1 dari 3 file')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Cari data'));
    await userEvent.type(screen.getByLabelText('Cari data'), 'tidak-ada-data-ini');
    expect(await screen.findByText('Data tidak ditemukan')).toBeInTheDocument();
  });

  it('tugas yang disarankan bisa dibuka dan memuat tiga tugas', async () => {
    mockApi(anon);
    renderApp('/data-latihan');
    const row = (await screen.findByText('Kas Kecil')).closest('tr')!;
    expect(within(row).getAllByRole('listitem')).toHaveLength(3);
    expect(within(row).getByText('Berapa saldo kas kecil?')).toBeInTheDocument();
  });

  it('tab Cek hasil: pengunjung diajak masuk', async () => {
    mockApi(anon);
    renderApp('/data-latihan?tab=cek');
    expect(await screen.findByText(/dulu untuk memeriksa hasilmu. Pemeriksaan khusus anggota Premium/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Berkas hasil kerjamu/)).not.toBeInTheDocument();
  });

  it('tab Cek hasil: akun gratis melihat ajakan Premium, bukan formulir unggah', async () => {
    mockApi(free);
    renderApp('/data-latihan?tab=cek');
    expect(await screen.findByText('Pemeriksaan hasil khusus Premium')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lihat Premium' })).toHaveAttribute('href', '/premium');
    expect(screen.queryByLabelText(/Berkas hasil kerjamu/)).not.toBeInTheDocument();
  });

  it('Premium: berkas dibaca di browser, hanya nilai sel yang dikirim, hasil per tugas tampil dengan petunjuk', async () => {
    const fetchMock = mockApi({
      ...premium,
      'POST /datasets/kas-kecil/check': () => ({
        body: {
          data: {
            slug: 'kas-kecil',
            total: 3,
            correct: 1,
            items: [
              { no: 1, ask: 'Berapa total penerimaan? Angka teks diabaikan.', verdict: 'benar' },
              {
                no: 2,
                ask: 'Berapa saldo kas kecil?',
                verdict: 'tanpa-rumus',
                hint: 'Nilainya sudah cocok, tetapi kamu mengetiknya langsung.',
              },
              { no: 3, ask: 'Berapa total untuk "Parkir"?', verdict: 'salah', hint: 'Bersihkan dengan TRIM.', expected: 1250000 },
            ],
          },
        },
      }),
    });
    renderApp('/data-latihan?tab=cek');
    const input = await screen.findByLabelText(/Berkas hasil kerjamu/);
    await userEvent.upload(input, await answeredFile());
    await userEvent.click(screen.getByRole('button', { name: 'Periksa hasilku' }));

    expect(await screen.findByText('1 dari 3 benar.')).toBeInTheDocument();
    expect(screen.getByText(/Tugas 1: Berapa total penerimaan\?/)).toBeInTheDocument();
    expect(screen.getByText('Nilainya cocok, tapi belum memakai rumus')).toBeInTheDocument();
    expect(screen.getByText('Nilainya sudah cocok, tetapi kamu mengetiknya langsung.')).toBeInTheDocument();
    expect(screen.getByText('Bersihkan dengan TRIM.')).toBeInTheDocument();
    expect(screen.getByText('1.250.000')).toBeInTheDocument();
    expect(screen.getByText(/Hasil pemeriksaan: Kas Kecil/)).toBeInTheDocument();

    const call = fetchMock.mock.calls.find(
      ([u, init]) => String(u).endsWith('/datasets/kas-kecil/check') && (init as RequestInit)?.method === 'POST',
    )!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      answers: [
        { value: 42, formula: true },
        { value: 7, formula: false },
        { value: null, formula: false },
      ],
    });
  });

  it('Premium: berkas yang bukan unduhan halaman ini ditolak sebelum dikirim ke server', async () => {
    const fetchMock = mockApi(premium);
    renderApp('/data-latihan?tab=cek');
    await userEvent.upload(await screen.findByLabelText(/Berkas hasil kerjamu/), await answeredFile({ mark: false }));
    await userEvent.click(screen.getByRole('button', { name: 'Periksa hasilku' }));
    expect(await screen.findByText(/bukan unduhan dari halaman Data Latihan/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/check'))).toBe(false));
  });

  it('Premium: tanpa memilih berkas, pengguna diminta memilih dulu', async () => {
    mockApi(premium);
    renderApp('/data-latihan?tab=cek');
    await userEvent.click(await screen.findByRole('button', { name: 'Periksa hasilku' }));
    expect(await screen.findByText('Pilih berkas .xlsx hasil kerjamu dulu.')).toBeInTheDocument();
  });

  it('menu: Data Latihan menggantikan Shortcut di navigasi pengguna masuk', async () => {
    mockApi(premium);
    renderApp('/data-latihan');
    const nav = await screen.findByRole('navigation', { name: 'Navigasi utama' });
    expect(within(nav).getByRole('link', { name: 'Data Latihan' })).toHaveAttribute('href', '/data-latihan');
    expect(within(nav).queryByRole('link', { name: 'Shortcut' })).not.toBeInTheDocument();
  });
});

describe('worksheet: periksa hasil', () => {
  const WS = {
    slug: 'rekap-penjualan',
    title: 'Rekap Transaksi Penjualan',
    description: 'd',
    objective: 'o',
    difficulty: 'mudah',
    skills: ['SUM'],
    instructions: ['Hitung total.'],
    premiumOnly: false,
    fileType: 'xlsx',
    fileSize: 9000,
    available: true,
    keyAvailable: true,
    keySize: 9000,
    preview: { sheet: 'Latihan', rows: [['A', 'B']] },
    answerCells: [{ sheet: 'Latihan', ref: 'H1' }],
  };

  it('akun gratis: semua worksheet bisa diunduh, pemeriksaan menampilkan ajakan Premium', async () => {
    mockApi({ ...free, 'GET /worksheets/rekap-penjualan': WS });
    renderApp('/worksheet/rekap-penjualan');
    expect(await screen.findByRole('heading', { name: 'Periksa hasilmu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Unduh worksheet/ })).toHaveAttribute('href', '/api/worksheets/rekap-penjualan/download');
    expect(screen.getByText('Pemeriksaan hasil khusus Premium')).toBeInTheDocument();
  });

  it('Premium: berkas dikirim sebagai nilai sel dan hasil tiap sel tampil', async () => {
    const fetchMock = mockApi({
      ...premium,
      'GET /worksheets/rekap-penjualan': WS,
      'POST /worksheets/rekap-penjualan/check': () => ({
        body: {
          data: {
            slug: 'rekap-penjualan',
            total: 1,
            correct: 0,
            items: [{ sheet: 'Latihan', ref: 'H1', verdict: 'salah', expected: 1234567, hint: undefined }],
          },
        },
      }),
    });
    renderApp('/worksheet/rekap-penjualan');
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Latihan').getCell('H1').value = { formula: 'SUM(E2:E11)', result: 1 };
    await userEvent.upload(await screen.findByLabelText(/Berkas hasil kerjamu/), new File([await wb.xlsx.writeBuffer()], 'ws.xlsx'));
    await userEvent.click(screen.getByRole('button', { name: 'Periksa hasilku' }));
    expect(await screen.findByText('0 dari 1 benar.')).toBeInTheDocument();
    expect(screen.getByText('Sel H1')).toBeInTheDocument();
    expect(screen.getByText('1.234.567')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/worksheets/rekap-penjualan/check'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      cells: [{ sheet: 'Latihan', ref: 'H1', value: 1, formula: true }],
    });
  });
});
