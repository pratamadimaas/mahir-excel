import type { ModuleDef } from '../types';

export const modules: ModuleDef[] = [
  {
    slug: 'mengenal-excel',
    title: 'Mengenal Excel',
    summary: 'Workbook, worksheet, sel, rentang, memasukkan data, format angka, dan referensi sel dasar.',
    sortOrder: 1,
  },
  {
    slug: 'mengolah-data',
    title: 'Mengolah Data',
    summary: 'Mengurutkan, menyaring, membekukan baris judul, merapikan tabel, dan menemukan data yang tidak konsisten.',
    sortOrder: 2,
  },
  {
    slug: 'rumus-dasar',
    title: 'Rumus Dasar',
    summary: 'SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, MEDIAN, LARGE, SMALL, RANK, pembulatan, serta referensi relatif dan absolut.',
    sortOrder: 3,
  },
  {
    slug: 'logika',
    title: 'Logika',
    summary: 'IF, AND, OR, IFERROR, IFS, SWITCH, dan IF bertingkat setelah konsep dasarnya dipahami.',
    sortOrder: 4,
  },
  {
    slug: 'fungsi-bersyarat',
    title: 'Fungsi Bersyarat',
    summary: 'COUNTIF, COUNTIFS, SUMIF, SUMIFS, AVERAGEIF, dan SUMPRODUCT untuk meringkas data berdasarkan syarat.',
    sortOrder: 5,
  },
  {
    slug: 'fungsi-pencarian',
    title: 'Fungsi Pencarian',
    summary: 'VLOOKUP, HLOOKUP, XLOOKUP, serta INDEX dan MATCH untuk mengambil data dari tabel acuan.',
    sortOrder: 6,
  },
  {
    slug: 'teks-tanggal',
    title: 'Teks dan Tanggal',
    summary: 'Merapikan dan menyambung teks (LEFT, RIGHT, MID, TRIM, PROPER, SUBSTITUTE, FIND, TEXTJOIN, TEXT) dan menghitung dengan tanggal (DATE, DATEDIF, EOMONTH, NETWORKDAYS).',
    sortOrder: 7,
  },
  {
    slug: 'rapi-dan-aman',
    title: 'Rapi, Aman, dan Ringkas',
    summary: 'Aturan Data Validation dan Conditional Formatting, serta meringkas data seperti PivotTable.',
    sortOrder: 8,
  },
];
