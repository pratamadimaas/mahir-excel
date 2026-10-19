import type { ExerciseDef } from '../types';
import { POINTS, g, type Spec } from './exercises';

const SALES = [
  ['Sales', 'Kota', 'Penjualan'],
  ['Budi', 'Bandung', 7500000],
  ['Sari', 'Jakarta', 9200000],
  ['Dewi', 'Surabaya', 5100000],
  ['Andi', 'Bandung', 6400000],
  ['Rina', 'Jakarta', 8100000],
  ['Tono', 'Surabaya', 4300000],
  ['Maya', 'Bandung', 6900000],
];

const sortedByRevenue = [
  ['Sari', 'Jakarta', 9200000],
  ['Rina', 'Jakarta', 8100000],
  ['Budi', 'Bandung', 7500000],
  ['Maya', 'Bandung', 6900000],
  ['Andi', 'Bandung', 6400000],
  ['Dewi', 'Surabaya', 5100000],
  ['Tono', 'Surabaya', 4300000],
];

const cols = ['A', 'B', 'C'];
const sortedTargets = sortedByRevenue.flatMap((row, r) => row.map((v, c) => ({ cell: `${cols[c]}${r + 2}`, solution: String(v) })));

const PRICE_TABLE = [
  ['Kode', 'Nama', 'Harga'],
  ['BRS', 'Beras', 68000],
  ['GLA', 'Gula', 16000],
  ['TLR', 'Telur', 28000],
  ['MNY', 'Minyak', 36000],
  ['KPI', 'Kopi', 22000],
];

/** Gabungkan blok-blok data menjadi satu peta sel dengan offset kolom. */
function place(rows: (string | number)[][], colStart: number, rowStart = 1): Record<string, string> {
  const out: Record<string, string> = {};
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== '') out[`${String.fromCharCode(65 + colStart + c)}${rowStart + r}`] = String(v);
    }),
  );
  return out;
}

const specs: Spec[] = [
  // ------------------------------------------------------------ Mengolah Data: sort dan filter
  {
    slug: 'urutkan-penjualan',
    title: 'Urutkan penjualan dari yang terbesar',
    description: 'Pakai alat Urutkan, lalu baca hasilnya.',
    topic: 'mengolah-data',
    difficulty: 'sedang',
    rows: 10,
    cols: 4,
    cells: g(SALES),
    editable: ['A2:C8'],
    tools: { sort: { range: 'A1:C8' } },
    task: 'Urutkan tabel berdasarkan kolom Penjualan dari yang terbesar ke terkecil memakai panel Urutkan di atas grid (kolom Penjualan, tombol Turun). Pastikan nama dan angkanya tetap berpasangan.',
    hints: [
      'Pilih kolom "Penjualan" pada panel Urutkan.',
      'Tekan tombol "Turun" supaya angka terbesar ada di baris paling atas.',
      'Sari (9.200.000) harus berada di baris 2 dan Tono (4.300.000) di baris 8.',
    ],
    explanation:
      'Sort memindahkan seluruh baris sekaligus sehingga Sales, Kota, dan Penjualan tetap berpasangan. Mengurutkan satu kolom saja akan mengacaukan pasangan data.',
    lessonSlug: 'mengurutkan-menyaring-tabel',
    validation: { targets: sortedTargets },
  },
  {
    slug: 'filter-kota-bandung',
    title: 'Filter kota Bandung',
    description: 'Pakai alat Filter dan baca jumlah baris yang ditemukan.',
    topic: 'mengolah-data',
    difficulty: 'mudah',
    rows: 10,
    cols: 6,
    cells: { ...g(SALES), E1: 'Baris Bandung:' },
    editable: ['F1'],
    tools: { filter: { range: 'A1:C8' } },
    task: 'Saring kolom Kota dengan syarat "sama dengan" Bandung memakai panel Filter. Lihat jumlah baris yang ditemukan, lalu ketik angkanya di sel F1.',
    hints: [
      'Pilih kolom Kota, syarat "sama dengan", nilai Bandung, lalu Terapkan.',
      'Status di kanan panel menampilkan "n dari 7 baris ditemukan".',
      'Ketik angka itu di F1.',
    ],
    explanation: 'Tiga baris berkota Bandung: Budi, Andi, dan Maya. Filter hanya menyembunyikan baris lain; datanya tetap ada.',
    lessonSlug: 'mengurutkan-menyaring-tabel',
    validation: { targets: [{ cell: 'F1', solution: '3' }] },
  },
  {
    slug: 'filter-penjualan-besar',
    title: 'Filter penjualan di atas 6 juta',
    description: 'Filter dengan syarat angka "lebih besar dari".',
    topic: 'mengolah-data',
    difficulty: 'mudah',
    rows: 10,
    cols: 6,
    cells: { ...g(SALES), E1: 'Baris > 6 juta:' },
    editable: ['F1'],
    tools: { filter: { range: 'A1:C8' } },
    task: 'Saring kolom Penjualan dengan syarat "lebih besar dari" 6000000. Berapa baris yang ditemukan? Ketik jawabannya di F1.',
    hints: [
      'Pilih kolom Penjualan dan syarat "lebih besar dari".',
      'Tulis nilai 6000000 tanpa titik.',
      'Baca jumlah baris di status panel.',
    ],
    explanation: 'Lima baris melebihi 6.000.000: Budi, Sari, Andi, Rina, dan Maya.',
    lessonSlug: 'mengurutkan-menyaring-tabel',
    validation: { targets: [{ cell: 'F1', solution: '5' }] },
  },

  // ------------------------------------------------------------ ROUND dan isi otomatis
  {
    slug: 'bulatkan-rata-rata',
    title: 'Rata-rata dibulatkan satu desimal',
    description: 'Gabungkan AVERAGE dan ROUND.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 8,
    cols: 4,
    cells: g([['Siswa', 'Nilai'], ['Ani', 85], ['Beni', 78], ['Citra', 90], ['', ''], ['Rata-rata (1 desimal)']]),
    editable: ['B6'],
    task: 'Isi B6 dengan rata-rata B2:B4 yang dibulatkan ke satu desimal. Bungkus AVERAGE dengan ROUND.',
    hints: ['Mulai dari =AVERAGE(B2:B4).', 'Bungkus dengan ROUND, digit 1 untuk satu desimal.', '=ROUND(AVERAGE(B2:B4),1)'],
    explanation: '(85 + 78 + 90) / 3 = 84,333…, dibulatkan satu desimal menjadi 84,3. ROUND mengubah nilainya, bukan hanya tampilannya.',
    lessonSlug: 'round-pembulatan',
    validation: {
      targets: [{ cell: 'B6', solution: '=ROUND(AVERAGE(B2:B4),1)', requireFunction: 'ROUND' }],
      variants: [{ B2: '86' }, { B3: '91', B4: '70' }],
      requirePatterns: [{ pattern: 'AVERAGE', message: 'Hitung rata-ratanya dengan AVERAGE di dalam ROUND.' }],
    },
  },
  {
    slug: 'bulatkan-ribuan',
    title: 'Bulatkan harga ke ribuan',
    description: 'Digit negatif membulatkan ke kiri titik desimal.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 7,
    cols: 4,
    cells: g([
      ['Barang', 'Harga', 'Harga bulat'],
      ['Beras', 15250],
      ['Gula', 14480],
      ['Minyak', 18999],
      ['Telur', 27500],
    ]),
    editable: ['C2:C5'],
    task: 'Isi C2 sampai C5 dengan harga yang dibulatkan ke ribuan terdekat memakai ROUND.',
    hints: ['Ribuan berarti digit negatif.', 'ROUND(B2,-3) membulatkan ke ribuan.', 'C2 =ROUND(B2,-3), C3 =ROUND(B3,-3), …'],
    explanation:
      '15.250 menjadi 15.000, 14.480 menjadi 14.000, 18.999 menjadi 19.000, dan 27.500 menjadi 28.000 (setengah dibulatkan ke atas).',
    lessonSlug: 'round-pembulatan',
    validation: {
      targets: [2, 3, 4, 5].map((r) => ({ cell: `C${r}`, solution: `=ROUND(B${r},-3)`, requireFunction: 'ROUND' })),
      variants: [
        { B2: '15500', B3: '14999' },
        { B4: '18400', B5: '27499' },
      ],
    },
  },
  {
    slug: 'diskon-dibulatkan',
    title: 'Diskon dibulatkan ke rupiah',
    description: 'ROUND dengan referensi absolut untuk tarif diskon.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 7,
    cols: 5,
    cells: g([
      ['Barang', 'Harga', 'Diskon', 'Tarif diskon:', 0.15],
      ['Beras', 12500],
      ['Gula', 33333],
      ['Kopi', 9990],
    ]),
    editable: ['C2:C4'],
    task: 'Isi C2 sampai C4 dengan diskon = harga × tarif di E1, dibulatkan ke rupiah (tanpa desimal). Kunci sel tarif dengan $.',
    hints: ['Hitung dulu B2*$E$1.', 'Bungkus dengan ROUND dan digit 0.', '=ROUND(B2*$E$1,0)'],
    explanation:
      '12.500 × 15% = 1.875; 33.333 × 15% = 4.999,95 menjadi 5.000; 9.990 × 15% = 1.498,5 menjadi 1.499 (setengah dibulatkan ke atas).',
    lessonSlug: 'round-pembulatan',
    validation: {
      targets: [2, 3, 4].map((r) => ({ cell: `C${r}`, solution: `=ROUND(B${r}*$E$1,0)`, requireFunction: 'ROUND' })),
      requirePatterns: [{ pattern: '\\$E\\$1', message: 'Kunci sel tarif dengan $E$1 supaya aman disalin.' }],
      variants: [{ E1: '0.1' }, { B2: '10000', E1: '0.25' }],
    },
  },
  {
    slug: 'salin-rumus-ke-bawah',
    title: 'Salin rumus komisi ke bawah',
    description: 'Tulis satu rumus lalu isi otomatis ke bawah dengan gagang isi.',
    topic: 'rumus-dasar',
    difficulty: 'sedang',
    rows: 9,
    cols: 5,
    cells: g([
      ['Barang', 'Harga', 'Komisi', 'Tarif komisi:', 0.05],
      ['Beras', 68000],
      ['Gula', 16000],
      ['Telur', 28000],
      ['Minyak', 36000],
      ['Kopi', 22000],
    ]),
    editable: ['C2:C6'],
    task: 'Tulis rumus komisi di C2 (harga × tarif di E1), lalu salin ke C3:C6 dengan menyeret gagang di sudut sel, tombol "Isi ke bawah", atau Ctrl+D di tiap sel. Pastikan tarif tetap menunjuk E1.',
    hints: [
      'Tulis di C2: harga (B2) dikali tarif, dan kunci tarif dengan $.',
      'Pilih C2 lalu tekan "Isi ke bawah" atau seret gagang kecil di pojok kanan bawah sel ke C6.',
      '=B2*$E$1 di C2; setelah disalin C3 menjadi =B3*$E$1, dan seterusnya.',
    ],
    explanation:
      'Saat disalin ke bawah, B2 relatif berubah menjadi B3, B4, … sedangkan $E$1 tetap. Inilah alasan sel tetap dikunci dengan $.',
    lessonSlug: 'referensi-relatif-absolut',
    validation: {
      targets: [2, 3, 4, 5, 6].map((r) => ({ cell: `C${r}`, solution: `=B${r}*$E$1` })),
      requirePatterns: [
        { pattern: '\\$E\\$1', message: 'Kunci sel tarif dengan $E$1; tanpa $ rumus yang disalin menunjuk sel yang salah.' },
      ],
      variants: [{ E1: '0.1' }, { B3: '20000', E1: '0.02' }],
    },
  },

  // ------------------------------------------------------------ Fungsi Pencarian
  {
    slug: 'harga-dari-kode',
    title: 'Ambil harga dari kode barang',
    description: 'VLOOKUP persis dengan tabel acuan yang dikunci.',
    topic: 'fungsi-pencarian',
    difficulty: 'sedang',
    rows: 8,
    cols: 8,
    cells: {
      ...place(
        [
          ['Kode', 'Jumlah', 'Harga', 'Total'],
          ['GLA', 10],
          ['BRS', 2],
          ['KPI', 6],
          ['TLR', 4],
        ],
        0,
      ),
      ...place(PRICE_TABLE, 5),
    },
    editable: ['C2:D5'],
    task: 'Isi kolom Harga (C2:C5) dengan harga dari tabel acuan F1:H6 berdasarkan kode di kolom A memakai VLOOKUP (pencocokan persis, kunci tabel dengan $). Isi kolom Total (D2:D5) dengan harga × jumlah.',
    hints: [
      'Cari kode (A2) di kolom pertama tabel acuan F2:H6 dan ambil kolom ke-3.',
      'Gunakan FALSE untuk pencocokan persis dan kunci tabel: $F$2:$H$6.',
      '=VLOOKUP(A2,$F$2:$H$6,3,FALSE) di C2, dan =B2*C2 di D2.',
    ],
    explanation:
      'GLA → 16.000 (total 160.000), BRS → 68.000 (136.000), KPI → 22.000 (132.000), TLR → 28.000 (112.000). Tabel dikunci agar aman disalin.',
    lessonSlug: 'vlookup-dasar',
    validation: {
      targets: [
        ...[2, 3, 4, 5].map((r) => ({ cell: `C${r}`, solution: `=VLOOKUP(A${r},$F$2:$H$6,3,FALSE)`, requireFunction: 'VLOOKUP' })),
        ...[2, 3, 4, 5].map((r) => ({ cell: `D${r}`, solution: `=B${r}*C${r}` })),
      ],
      requirePatterns: [
        {
          pattern: '\\$F\\$2:\\$H\\$6',
          message: 'Kunci tabel acuan dengan $F$2:$H$6 agar tidak bergeser saat rumus disalin.',
          cells: ['C2:C5'],
        },
      ],
      variants: [
        { H2: '70000', A3: 'TLR' },
        { B2: '3', A5: 'MNY' },
      ],
      rules: [{ pattern: 'VLOOKUP\\([^)]*\\)\\s*$', message: 'Pastikan argumen terakhir FALSE agar pencocokannya persis.' }],
    },
  },
  {
    slug: 'grade-vlookup',
    title: 'Grade dari tabel batas nilai',
    description: 'VLOOKUP pencocokan perkiraan pada tabel terurut.',
    topic: 'fungsi-pencarian',
    difficulty: 'sedang',
    rows: 8,
    cols: 6,
    cells: {
      ...place(
        [
          ['Siswa', 'Nilai', 'Grade'],
          ['Ani', 85],
          ['Beni', 59],
          ['Citra', 70],
          ['Dedi', 93],
          ['Eka', 61],
        ],
        0,
      ),
      ...place(
        [
          ['Batas', 'Grade'],
          [0, 'E'],
          [60, 'D'],
          [70, 'C'],
          [80, 'B'],
          [90, 'A'],
        ],
        4,
      ),
    },
    editable: ['C2:C6'],
    task: 'Isi C2:C6 dengan grade dari tabel batas E2:F6 memakai VLOOKUP pencocokan perkiraan (TRUE atau argumen terakhir dikosongkan). Kunci tabel dengan $.',
    hints: [
      'Pencocokan perkiraan mengambil baris dengan batas terbesar yang tidak melebihi nilai.',
      'Tabel batas sudah terurut naik, syarat pencocokan perkiraan.',
      '=VLOOKUP(B2,$E$2:$F$6,2,TRUE)',
    ],
    explanation:
      '85 berada di batas 80 (B), 59 di 0 (E), tepat 70 adalah C, 93 adalah A, dan 61 adalah D. Pencocokan perkiraan hanya benar bila kolom pertama terurut naik.',
    lessonSlug: 'vlookup-dasar',
    validation: {
      targets: [2, 3, 4, 5, 6].map((r) => ({ cell: `C${r}`, solution: `=VLOOKUP(B${r},$E$2:$F$6,2,TRUE)`, requireFunction: 'VLOOKUP' })),
      requirePatterns: [{ pattern: '\\$E\\$2:\\$F\\$6', message: 'Kunci tabel batas dengan $E$2:$F$6.' }],
      variants: [
        { B2: '55', B3: '99' },
        { B4: '80', B5: '89', B6: '60' },
      ],
      rules: [
        { pattern: 'FALSE|,\\s*0\\s*\\)', message: 'Untuk tabel batas, pakai pencocokan perkiraan (TRUE atau dikosongkan), bukan FALSE.' },
      ],
    },
  },
  {
    slug: 'xlookup-stok',
    title: 'Cek stok dengan XLOOKUP',
    description: 'XLOOKUP dengan pesan bila kode tidak ada.',
    topic: 'fungsi-pencarian',
    difficulty: 'sedang',
    rows: 7,
    cols: 6,
    cells: {
      ...place(
        [
          ['Kode', 'Stok'],
          ['BRS', 40],
          ['GLA', 25],
          ['TLR', 12],
          ['MNY', 18],
        ],
        0,
      ),
      ...place([['Dicari', 'Stok'], ['GLA'], ['XYZ'], ['TLR']], 3),
    },
    editable: ['E2:E4'],
    task: 'Isi E2:E4 dengan stok dari B2:B5 berdasarkan kode di kolom D memakai XLOOKUP. Bila kode tidak ada, tampilkan teks "Tidak ada".',
    hints: [
      'XLOOKUP(dicari; rentang_cari; rentang_hasil; jika_tidak_ada).',
      'Rentang cari A2:A5, rentang hasil B2:B5, pesan "Tidak ada".',
      '=XLOOKUP(D2,A2:A5,B2:B5,"Tidak ada")',
    ],
    explanation: 'GLA → 25, XYZ tidak ada sehingga tampil "Tidak ada", TLR → 12. Argumen keempat menggantikan #N/A dengan pesanmu.',
    lessonSlug: 'xlookup-fleksibel',
    validation: {
      targets: [2, 3, 4].map((r) => ({
        cell: `E${r}`,
        solution: `=XLOOKUP(D${r},$A$2:$A$5,$B$2:$B$5,"Tidak ada")`,
        requireFunction: 'XLOOKUP',
      })),
      variants: [
        { D2: 'BRS', D4: 'ZZZ' },
        { B3: '99', D3: 'MNY' },
      ],
    },
  },
  {
    slug: 'index-match-kiri',
    title: 'Cari harga yang berada di kiri kode',
    description: 'INDEX-MATCH untuk pencarian ke kiri.',
    topic: 'fungsi-pencarian',
    difficulty: 'sulit',
    rows: 7,
    cols: 6,
    cells: {
      ...place(
        [
          ['Harga', 'Kode'],
          [68000, 'BRS'],
          [16000, 'GLA'],
          [28000, 'TLR'],
          [36000, 'MNY'],
        ],
        0,
      ),
      ...place([['Dicari', 'Harga'], ['TLR'], ['BRS'], ['MNY']], 3),
    },
    editable: ['E2:E4'],
    task: 'Harga ada di kolom A dan kode di kolom B (kiri kunci). Isi E2:E4 dengan harga untuk kode di kolom D memakai INDEX dan MATCH (pencocokan persis).',
    hints: [
      'MATCH(D2; B2:B5; 0) mencari urutan kode.',
      'INDEX(A2:A5; urutan) mengambil harga pada urutan itu.',
      '=INDEX(A2:A5,MATCH(D2,B2:B5,0))',
    ],
    explanation:
      'MATCH("TLR") menghasilkan 3, INDEX mengambil sel ke-3 di A2:A5: 28.000. BRS → 68.000 dan MNY → 36.000. VLOOKUP tidak bisa melihat ke kiri; INDEX-MATCH bisa.',
    lessonSlug: 'index-match',
    validation: {
      targets: [2, 3, 4].map((r) => ({ cell: `E${r}`, solution: `=INDEX($A$2:$A$5,MATCH(D${r},$B$2:$B$5,0))`, requireFunction: 'INDEX' })),
      requirePatterns: [{ pattern: 'MATCH', message: 'Gunakan MATCH di dalam INDEX untuk mencari urutan kodenya.' }],
      variants: [
        { A3: '17000', D2: 'GLA' },
        { B5: 'KPI', D4: 'KPI' },
      ],
    },
  },
  {
    slug: 'diskon-member-vlookup',
    title: 'Diskon member dengan penanganan galat',
    description: 'VLOOKUP dibungkus IFERROR untuk level yang tidak terdaftar.',
    topic: 'fungsi-pencarian',
    difficulty: 'sulit',
    rows: 8,
    cols: 6,
    cells: {
      ...place(
        [
          ['Pelanggan', 'Level', 'Diskon'],
          ['Ani', 'Gold'],
          ['Beni', 'Bronze'],
          ['Citra', 'Platinum'],
          ['Dedi', 'Silver'],
        ],
        0,
      ),
      ...place(
        [
          ['Level', 'Diskon'],
          ['Gold', 0.15],
          ['Silver', 0.1],
          ['Bronze', 0.05],
        ],
        4,
      ),
    },
    editable: ['C2:C5'],
    task: 'Isi C2:C5 dengan diskon dari tabel E2:F4 sesuai level. Bila level tidak terdaftar (mis. Platinum), diskonnya 0. Gunakan VLOOKUP dan IFERROR.',
    hints: [
      'VLOOKUP pencocokan persis menghasilkan #N/A bila level tidak ada.',
      'Bungkus dengan IFERROR dan nilai pengganti 0.',
      '=IFERROR(VLOOKUP(B2,$E$2:$F$4,2,FALSE),0)',
    ],
    explanation:
      'Gold 0,15, Bronze 0,05, Silver 0,1. Platinum tidak ada di tabel sehingga VLOOKUP menghasilkan #N/A dan IFERROR menggantinya dengan 0.',
    lessonSlug: 'vlookup-dasar',
    validation: {
      targets: [2, 3, 4, 5].map((r) => ({
        cell: `C${r}`,
        solution: `=IFERROR(VLOOKUP(B${r},$E$2:$F$4,2,FALSE),0)`,
        requireFunction: 'IFERROR',
      })),
      requirePatterns: [{ pattern: 'VLOOKUP', message: 'Gunakan VLOOKUP di dalam IFERROR.' }],
      variants: [
        { B4: 'Gold', B5: 'Emas' },
        { F2: '0.2', B2: 'Silver' },
      ],
    },
  },

  // ------------------------------------------------------------ Teks dan Tanggal
  {
    slug: 'rapikan-nama',
    title: 'Rapikan daftar nama',
    description: 'PROPER dan TRIM untuk nama yang berantakan.',
    topic: 'teks-tanggal',
    difficulty: 'sedang',
    rows: 7,
    cols: 4,
    cells: g([['Nama mentah', 'Nama rapi'], ['  budi   SANTOSO ', ''], ['SITI aminah', ''], [' dewi  lestari', ''], ['rina']]),
    editable: ['B2:B5'],
    task: 'Isi B2:B5 dengan nama yang rapi: spasi berlebih dibuang dan huruf pertama tiap kata kapital, sisanya kecil. Gunakan PROPER dan TRIM.',
    hints: ['TRIM membuang spasi berlebih.', 'PROPER mengatur huruf kapital di awal kata.', '=PROPER(TRIM(A2))'],
    explanation:
      'TRIM menghasilkan "budi SANTOSO", PROPER mengubahnya menjadi "Budi Santoso". Urutan: rapikan spasi dulu dengan TRIM, lalu atur huruf.',
    lessonSlug: 'fungsi-teks',
    validation: {
      targets: [2, 3, 4, 5].map((r) => ({ cell: `B${r}`, solution: `=PROPER(TRIM(A${r}))`, requireFunction: 'PROPER', exactText: true })),
      requirePatterns: [{ pattern: 'TRIM', message: 'Gunakan juga TRIM untuk membuang spasi berlebih.' }],
      variants: [{ A2: ' ANI   lestari  ' }, { A5: 'TONO  budi' }],
    },
  },
  {
    slug: 'ambil-kode-produk',
    title: 'Pecah kode produk',
    description: 'LEFT, MID, dan RIGHT memotong teks pada posisi tertentu.',
    topic: 'teks-tanggal',
    difficulty: 'sedang',
    rows: 6,
    cols: 5,
    cells: g([['Kode', 'Kategori', 'Tahun', 'Urutan'], ['BRS-2025-001'], ['GLA-2024-017'], ['TLR-2026-102']]),
    editable: ['B2:D4'],
    task: 'Dari kode seperti BRS-2025-001: isi Kategori (3 huruf pertama) dengan LEFT, Tahun (4 angka di tengah) dengan MID, dan Urutan (3 angka terakhir) dengan RIGHT, untuk baris 2 sampai 4.',
    hints: [
      'Kategori adalah 3 karakter pertama, jadi LEFT.',
      'Tahun mulai di posisi 5 sepanjang 4 karakter, jadi MID.',
      'B2 =LEFT(A2,3), C2 =MID(A2,5,4), D2 =RIGHT(A2,3)',
    ],
    explanation: 'LEFT(A2;3) = BRS, MID(A2;5;4) = 2025, RIGHT(A2;3) = 001. Hasilnya berupa teks, termasuk bagian yang berisi angka.',
    lessonSlug: 'fungsi-teks',
    validation: {
      targets: [
        ...[2, 3, 4].map((r) => ({ cell: `B${r}`, solution: `=LEFT(A${r},3)`, requireFunction: 'LEFT', exactText: true })),
        ...[2, 3, 4].map((r) => ({ cell: `C${r}`, solution: `=MID(A${r},5,4)`, requireFunction: 'MID', exactText: true })),
        ...[2, 3, 4].map((r) => ({ cell: `D${r}`, solution: `=RIGHT(A${r},3)`, requireFunction: 'RIGHT', exactText: true })),
      ],
      variants: [{ A2: 'KPI-2023-999' }, { A3: 'MNY-2021-005', A4: 'ABC-1999-123' }],
    },
  },
  {
    slug: 'hitung-panjang-teks',
    title: 'Panjang nama pengguna yang sebenarnya',
    description: 'LEN dikombinasikan dengan TRIM.',
    topic: 'teks-tanggal',
    difficulty: 'mudah',
    rows: 7,
    cols: 4,
    cells: g([['Nama pengguna', 'Panjang'], ['  budi99  '], ['ani'], ['  siti_aminah'], ['dewi ']]),
    editable: ['B2:B5'],
    task: 'Hitung panjang nama pengguna yang sebenarnya (tanpa spasi di awal dan akhir) dengan LEN dan TRIM di B2:B5.',
    hints: ['LEN menghitung karakter termasuk spasi.', 'TRIM dulu supaya spasi berlebih tidak ikut dihitung.', '=LEN(TRIM(A2))'],
    explanation: '"  budi99  " menjadi "budi99" (6 karakter), "ani" 3, "  siti_aminah" menjadi 11, "dewi " menjadi 4.',
    lessonSlug: 'fungsi-teks',
    validation: {
      targets: [2, 3, 4, 5].map((r) => ({ cell: `B${r}`, solution: `=LEN(TRIM(A${r}))`, requireFunction: 'LEN' })),
      requirePatterns: [{ pattern: 'TRIM', message: 'Gunakan TRIM agar spasi di awal dan akhir tidak ikut terhitung.' }],
      variants: [{ A3: '   anisa   ' }, { A5: 'x' }],
    },
  },
  {
    slug: 'tahun-bulan-hari',
    title: 'Pecah tanggal menjadi tahun, bulan, dan hari',
    description: 'YEAR, MONTH, dan DAY dari tanggal.',
    topic: 'teks-tanggal',
    difficulty: 'mudah',
    rows: 6,
    cols: 5,
    cells: g([['Tanggal', 'Tahun', 'Bulan', 'Hari'], ['=DATE(2026,3,15)'], ['=DATE(2025,12,1)'], ['=DATE(2024,2,29)']]),
    editable: ['B2:D4'],
    task: 'Isi B2:D4 dengan tahun (YEAR), bulan (MONTH), dan hari (DAY) dari tanggal di kolom A. Angka seperti 46096 di kolom A adalah nomor serial tanggal, itu normal.',
    hints: ['Tiga fungsi untuk tiga kolom.', 'Semuanya menerima sel tanggal sebagai argumen.', 'B2 =YEAR(A2), C2 =MONTH(A2), D2 =DAY(A2)'],
    explanation: '15 Maret 2026 menghasilkan 2026, 3, dan 15. 29 Februari 2024 valid karena 2024 adalah tahun kabisat.',
    lessonSlug: 'fungsi-tanggal',
    validation: {
      targets: [
        ...[2, 3, 4].map((r) => ({ cell: `B${r}`, solution: `=YEAR(A${r})`, requireFunction: 'YEAR' })),
        ...[2, 3, 4].map((r) => ({ cell: `C${r}`, solution: `=MONTH(A${r})`, requireFunction: 'MONTH' })),
        ...[2, 3, 4].map((r) => ({ cell: `D${r}`, solution: `=DAY(A${r})`, requireFunction: 'DAY' })),
      ],
      variants: [{ A2: '=DATE(2030,7,4)' }, { A3: '=DATE(2023,1,31)', A4: '=DATE(2027,11,9)' }],
    },
  },
  {
    slug: 'selisih-hari',
    title: 'Hitung lama pengerjaan dalam hari',
    description: 'Selisih dua tanggal adalah jumlah harinya.',
    topic: 'teks-tanggal',
    difficulty: 'sedang',
    rows: 7,
    cols: 5,
    cells: g([
      ['Mulai', 'Selesai', 'Lama (hari)', 'Status'],
      ['=DATE(2026,1,5)', '=DATE(2026,1,20)'],
      ['=DATE(2026,2,1)', '=DATE(2026,3,15)'],
      ['=DATE(2026,4,10)', '=DATE(2026,4,12)'],
    ]),
    editable: ['C2:D4'],
    task: 'Isi C2:C4 dengan lama pengerjaan (tanggal selesai dikurangi mulai). Isi D2:D4 dengan "Terlambat" bila lama lebih dari 30 hari, selain itu "Tepat waktu".',
    hints: [
      'Tanggal adalah angka, jadi cukup dikurangkan.',
      'Status memakai IF atas hasil di kolom C.',
      'C2 =B2-A2, D2 =IF(C2>30,"Terlambat","Tepat waktu")',
    ],
    explanation: '5 Jan ke 20 Jan: 15 hari. 1 Feb ke 15 Mar: 42 hari (Terlambat). 10 Apr ke 12 Apr: 2 hari.',
    lessonSlug: 'fungsi-tanggal',
    validation: {
      targets: [
        ...[2, 3, 4].map((r) => ({ cell: `C${r}`, solution: `=B${r}-A${r}` })),
        ...[2, 3, 4].map((r) => ({ cell: `D${r}`, solution: `=IF(C${r}>30,"Terlambat","Tepat waktu")`, requireFunction: 'IF' })),
      ],
      variants: [{ B2: '=DATE(2026,3,1)' }, { B4: '=DATE(2026,6,30)', A3: '=DATE(2026,3,1)' }],
    },
  },
  {
    slug: 'susun-jatuh-tempo',
    title: 'Susun tanggal faktur dan jatuh tempo',
    description: 'DATE menyusun tanggal dari tahun, bulan, dan hari; tambahkan 30 hari.',
    topic: 'teks-tanggal',
    difficulty: 'sedang',
    rows: 6,
    cols: 6,
    cells: g([
      ['Tahun', 'Bulan', 'Hari', 'Faktur', 'Jatuh tempo'],
      [2026, 10, 17],
      [2026, 12, 20],
      [2027, 1, 5],
    ]),
    editable: ['D2:E4'],
    task: 'Isi Faktur (D2:D4) dengan tanggal yang disusun dari tahun, bulan, dan hari. Isi Jatuh tempo (E2:E4) dengan 30 hari setelah tanggal faktur.',
    hints: [
      'DATE(tahun; bulan; hari) menyusun tanggal.',
      'Tambahkan 30 ke tanggal faktur untuk jatuh tempo.',
      'D2 =DATE(A2,B2,C2), E2 =D2+30',
    ],
    explanation:
      'Faktur 17 Okt 2026 jatuh tempo 16 Nov 2026. Faktur 20 Des 2026 jatuh tempo 19 Jan 2027, melewati pergantian tahun otomatis.',
    lessonSlug: 'fungsi-tanggal',
    validation: {
      targets: [
        ...[2, 3, 4].map((r) => ({ cell: `D${r}`, solution: `=DATE(A${r},B${r},C${r})`, requireFunction: 'DATE' })),
        ...[2, 3, 4].map((r) => ({ cell: `E${r}`, solution: `=D${r}+30` })),
      ],
      variants: [
        { A2: '2025', B2: '2' },
        { C3: '1', B4: '12' },
      ],
    },
  },

  // ------------------------------------------------------------ Rapi, Aman, dan Ringkas
  {
    slug: 'aturan-validasi-umur',
    title: 'Aturan validasi umur peserta',
    description: 'Tulis aturan Data Validation sebagai rumus TRUE/FALSE.',
    topic: 'rapi-dan-aman',
    difficulty: 'sedang',
    rows: 8,
    cols: 4,
    cells: g([
      ['Nama', 'Umur', 'Valid?'],
      ['Ani', 17],
      ['Beni', 15],
      ['Citra', 60],
      ['Dedi', 61],
      ['Eka', 25],
    ]),
    editable: ['C2:C6'],
    task: 'Peserta valid bila umurnya 17 sampai 60 tahun (termasuk keduanya). Isi C2:C6 dengan rumus aturan yang menghasilkan TRUE atau FALSE memakai AND.',
    hints: ['Dua syarat harus terpenuhi sekaligus.', 'Umur minimal 17 dan maksimal 60.', '=AND(B2>=17,B2<=60)'],
    explanation:
      'Ani (17) dan Citra (60) valid, Beni (15) dan Dedi (61) tidak, Eka (25) valid. Rumus yang sama dipasang sebagai aturan Custom di Data Validation.',
    lessonSlug: 'data-validation',
    validation: {
      targets: [2, 3, 4, 5, 6].map((r) => ({ cell: `C${r}`, solution: `=AND(B${r}>=17,B${r}<=60)`, requireFunction: 'AND' })),
      variants: [
        { B3: '17', B5: '60' },
        { B2: '16', B6: '61' },
      ],
    },
  },
  {
    slug: 'aturan-stok-rendah',
    title: 'Aturan penanda stok rendah',
    description: 'Aturan Conditional Formatting: TRUE bila stok kurang dari minimum.',
    topic: 'rapi-dan-aman',
    difficulty: 'mudah',
    rows: 7,
    cols: 5,
    cells: g([
      ['Barang', 'Stok', 'Minimum', 'Restok?'],
      ['Beras', 8, 10],
      ['Gula', 30, 20],
      ['Telur', 12, 12],
      ['Minyak', 3, 15],
    ]),
    editable: ['D2:D5'],
    task: 'Isi D2:D5 dengan aturan yang bernilai TRUE bila stok kurang dari minimum (stok sama dengan minimum belum dianggap kurang).',
    hints: ['Bandingkan stok dengan minimum.', 'Kurang dari ditulis dengan <.', '=B2<C2'],
    explanation:
      'Beras (8 < 10) dan Minyak (3 < 15) TRUE. Telur tepat 12 sama dengan minimum sehingga FALSE. Rumus ini dipasang pada Conditional Formatting untuk mewarnai sel.',
    lessonSlug: 'conditional-formatting',
    validation: {
      targets: [2, 3, 4, 5].map((r) => ({ cell: `D${r}`, solution: `=B${r}<C${r}` })),
      variants: [{ B4: '11' }, { B3: '5', C5: '2' }],
    },
  },
  {
    slug: 'aturan-duplikat',
    title: 'Aturan penanda data ganda',
    description: 'COUNTIF dengan rentang terkunci mendeteksi nilai yang muncul lebih dari sekali.',
    topic: 'rapi-dan-aman',
    difficulty: 'sulit',
    rows: 9,
    cols: 4,
    cells: g([['Nama', 'Ganda?'], ['Ani'], ['Budi'], ['ani'], ['Citra'], ['Budi'], ['Dedi']]),
    editable: ['B2:B7'],
    task: 'Isi B2:B7 dengan aturan yang bernilai TRUE bila nama pada baris itu muncul lebih dari sekali di A2:A7 (huruf besar-kecil tidak dibedakan). Kunci rentang dengan $.',
    hints: [
      'Hitung berapa kali nama itu muncul dengan COUNTIF.',
      'Rentangnya A2:A7 dan harus dikunci dengan $.',
      '=COUNTIF($A$2:$A$7,A2)>1',
    ],
    explanation: 'Ani muncul dua kali ("Ani" dan "ani"), Budi dua kali, sisanya sekali. COUNTIF tidak membedakan huruf besar-kecil.',
    lessonSlug: 'conditional-formatting',
    validation: {
      targets: [2, 3, 4, 5, 6, 7].map((r) => ({ cell: `B${r}`, solution: `=COUNTIF($A$2:$A$7,A${r})>1`, requireFunction: 'COUNTIF' })),
      requirePatterns: [{ pattern: '\\$A\\$2:\\$A\\$7', message: 'Kunci rentang dengan $A$2:$A$7 agar tidak bergeser saat disalin.' }],
      variants: [{ A5: 'Dedi' }, { A2: 'Eka', A4: 'Fani' }],
    },
  },
  {
    slug: 'ringkasan-penjualan-pivot',
    title: 'Ringkasan dua arah seperti PivotTable',
    description: 'SUMIFS dengan referensi campuran untuk satu rumus di seluruh tabel.',
    topic: 'rapi-dan-aman',
    difficulty: 'sulit',
    rows: 11,
    cols: 8,
    cells: {
      ...place(
        [
          ['Wilayah', 'Kategori', 'Penjualan'],
          ['Jakarta', 'Makanan', 300000],
          ['Jakarta', 'Minuman', 150000],
          ['Bandung', 'Makanan', 80000],
          ['Bandung', 'Minuman', 120000],
          ['Jakarta', 'Makanan', 90000],
          ['Bandung', 'Minuman', 110000],
          ['Bandung', 'Makanan', 70000],
          ['Jakarta', 'Minuman', 40000],
        ],
        0,
      ),
      ...place([['', 'Makanan', 'Minuman'], ['Jakarta'], ['Bandung']], 4),
    },
    editable: ['F2:G3'],
    task: 'Isi tabel ringkasan F2:G3 (Wilayah di baris, Kategori di kolom) dengan SUMIFS atas data A2:C9. Tulis satu rumus lalu salin ke seluruh tabel; gunakan referensi campuran ($E2 dan F$1) dan kunci rentang data.',
    hints: [
      'SUMIFS(jumlah; rentang_wilayah; wilayah; rentang_kategori; kategori).',
      'Judul baris dirujuk dengan $E2 (kolom dikunci) dan judul kolom dengan F$1 (baris dikunci).',
      '=SUMIFS($C$2:$C$9,$A$2:$A$9,$E2,$B$2:$B$9,F$1)',
    ],
    explanation:
      'Jakarta: Makanan 390.000 dan Minuman 190.000. Bandung: Makanan 150.000 dan Minuman 230.000. Hasilnya sama dengan PivotTable berbaris Wilayah, berkolom Kategori, bernilai jumlah Penjualan.',
    lessonSlug: 'pivottable-grafik',
    validation: {
      targets: ['F2', 'G2', 'F3', 'G3'].map((cell) => {
        const col = cell[0]!;
        const row = cell[1]!;
        return { cell, solution: `=SUMIFS($C$2:$C$9,$A$2:$A$9,$E${row},$B$2:$B$9,${col}$1)`, requireFunction: 'SUMIFS' };
      }),
      requirePatterns: [
        { pattern: '\\$E\\d', message: 'Rujuk judul baris dengan $E2 (kolom dikunci dengan $).' },
        { pattern: '[FG]\\$1', message: 'Rujuk judul kolom dengan F$1 (baris dikunci dengan $).' },
      ],
      variants: [{ C2: '500000' }, { A3: 'Bandung', B4: 'Minuman' }],
    },
  },

  // ------------------------------------------------------------ Proyek akhir (satu per modul)
  {
    slug: 'proyek-struk-belanja',
    title: 'Proyek: struk belanja',
    description: 'Subtotal, total, PPN, dan total bayar.',
    topic: 'mengenal-excel',
    difficulty: 'sulit',
    rows: 11,
    cols: 5,
    cells: {
      ...g([
        ['Barang', 'Harga', 'Jumlah', 'Subtotal'],
        ['Beras', 15000, 2],
        ['Gula', 14000, 3],
        ['Minyak', 18000, 1],
        ['Telur', 27000, 2],
        ['Total belanja'],
        ['Tarif PPN', 0.11],
        ['PPN'],
        ['Total bayar'],
      ]),
    },
    editable: ['D2:D5', 'D6', 'D8', 'D9'],
    task: 'Lengkapi struk: Subtotal tiap barang (harga × jumlah) di D2:D5, Total belanja di D6, PPN (total belanja × tarif di B7) di D8, dan Total bayar (total belanja + PPN) di D9. Pakai referensi sel.',
    hints: [
      'Subtotal baris 2: B2*C2, lalu sesuaikan tiap baris.',
      'Total belanja adalah jumlah D2 sampai D5; PPN memakai tarif di B7.',
      'D6 =D2+D3+D4+D5 (atau SUM), D8 =D6*B7, D9 =D6+D8',
    ],
    explanation:
      'Subtotal: 30.000, 42.000, 18.000, 54.000. Total belanja 144.000. PPN 11% = 15.840. Total bayar 159.840. Semua dihitung dari sel sehingga perubahan harga atau tarif otomatis terhitung.',
    lessonSlug: 'proyek-struk-belanja',
    validation: {
      targets: [
        ...[2, 3, 4, 5].map((r) => ({ cell: `D${r}`, solution: `=B${r}*C${r}` })),
        { cell: 'D6', solution: '=D2+D3+D4+D5' },
        { cell: 'D8', solution: '=D6*B7' },
        { cell: 'D9', solution: '=D6+D8' },
      ],
      variants: [
        { B2: '20000', C3: '5' },
        { B7: '0.1', C5: '1', B4: '1000' },
      ],
    },
  },
  {
    slug: 'proyek-merapikan-data-penjualan',
    title: 'Proyek: merapikan data penjualan',
    description: 'Perbaiki data kotor, lalu gunakan filter.',
    topic: 'mengolah-data',
    difficulty: 'sulit',
    rows: 10,
    cols: 6,
    cells: {
      ...g([
        ['Sales', 'Kota', 'Penjualan', '', 'Baris Jakarta:'],
        ['Sari', 'Jakarta', 9200000],
        ['Budi', 'Bandung', 'Rp 6400000'],
        ['Dewi', 'jakarta ', 5100000],
        ['Andi', 'Bandung', 6400000],
        ['Rina', 'JAKARTA', 8100000],
        ['Tono', 'Surabaya', 4300000],
        ['Maya', 'Bandung ', 6900000],
      ]),
    },
    editable: ['B4', 'B6', 'B8', 'C3', 'F1'],
    tools: { filter: { range: 'A1:C8' } },
    task: 'Rapikan data: ganti C3 dengan angka murni 6400000, dan seragamkan penulisan kota di B4, B6, dan B8 ("Jakarta", "Jakarta", "Bandung": huruf pertama kapital, tanpa spasi tambahan). Lalu saring Kota sama dengan Jakarta dan ketik jumlah baris yang ditemukan di F1.',
    hints: [
      'C3 adalah teks "Rp 6400000"; ganti dengan 6400000 saja.',
      'Ketik ulang B4, B6, dan B8 dengan penulisan yang benar.',
      'Setelah dirapikan, filter "sama dengan Jakarta" menemukan 3 baris; ketik 3 di F1.',
    ],
    explanation:
      'Setelah dirapikan, kota Jakarta ada pada Sari, Dewi, dan Rina: 3 baris. Sebelum dirapikan, spasi tambahan membuat baris Dewi tidak cocok dengan filter.',
    lessonSlug: 'proyek-merapikan-data-penjualan',
    validation: {
      targets: [
        { cell: 'C3', solution: '6400000' },
        { cell: 'B4', solution: 'Jakarta', exactText: true },
        { cell: 'B6', solution: 'Jakarta', exactText: true },
        { cell: 'B8', solution: 'Bandung', exactText: true },
        { cell: 'F1', solution: '3' },
      ],
    },
  },
  {
    slug: 'proyek-rekap-gaji',
    title: 'Proyek: rekap gaji karyawan',
    description: 'Gaji bersih dan ringkasannya.',
    topic: 'rumus-dasar',
    difficulty: 'sulit',
    rows: 14,
    cols: 6,
    cells: g([
      ['Nama', 'Pokok', 'Tunjangan', 'Potongan', 'Bersih'],
      ['Ani', 5000000, 500000, 200000],
      ['Beni', 4500000, 300000, 100000],
      ['Citra', 6000000, 800000, 350000],
      ['Dedi', 4000000, 250000, 150000],
      [''],
      ['Total gaji bersih'],
      ['Rata-rata'],
      ['Tertinggi'],
      ['Terendah'],
      ['Jumlah karyawan'],
      ['Rata-rata (ribuan)'],
    ]),
    editable: ['E2:E5', 'B7:B12'],
    task: 'Hitung Gaji bersih (pokok + tunjangan - potongan) di E2:E5. Lalu isi B7 total, B8 rata-rata, B9 tertinggi, B10 terendah dari gaji bersih (E2:E5), B11 jumlah karyawan (COUNTA nama), dan B12 rata-rata dibulatkan ke ribuan (ROUND).',
    hints: ['E2 =B2+C2-D2 dan seterusnya.', 'Pakai SUM, AVERAGE, MAX, MIN, COUNTA untuk B7 sampai B11.', 'B12 =ROUND(B8,-3)'],
    explanation:
      'Gaji bersih: 5.300.000; 4.700.000; 6.450.000; 4.100.000. Total 20.550.000, rata-rata 5.137.500, tertinggi 6.450.000, terendah 4.100.000, 4 karyawan, dan rata-rata ribuan 5.138.000 (setengah dibulatkan ke atas).',
    lessonSlug: 'proyek-rekap-gaji',
    validation: {
      targets: [
        ...[2, 3, 4, 5].map((r) => ({ cell: `E${r}`, solution: `=B${r}+C${r}-D${r}` })),
        { cell: 'B7', solution: '=SUM(E2:E5)', requireFunction: 'SUM' },
        { cell: 'B8', solution: '=AVERAGE(E2:E5)', requireFunction: 'AVERAGE' },
        { cell: 'B9', solution: '=MAX(E2:E5)', requireFunction: 'MAX' },
        { cell: 'B10', solution: '=MIN(E2:E5)', requireFunction: 'MIN' },
        { cell: 'B11', solution: '=COUNTA(A2:A5)', requireFunction: 'COUNTA' },
        { cell: 'B12', solution: '=ROUND(B8,-3)', requireFunction: 'ROUND' },
      ],
      variants: [
        { B2: '5500000', C4: '900000' },
        { D5: '300000', A3: 'Beni Setiawan' },
      ],
    },
  },
  {
    slug: 'proyek-penilaian-siswa',
    title: 'Proyek: penilaian siswa',
    description: 'Nilai akhir, status, dan beasiswa.',
    topic: 'logika',
    difficulty: 'sulit',
    rows: 8,
    cols: 6,
    cells: g([
      ['Siswa', 'Tugas', 'UAS', 'Akhir', 'Status', 'Beasiswa'],
      ['Ani', 80, 74],
      ['Beni', 92, 88],
      ['Citra', 60, 55],
      ['Dedi', 90, 78],
    ]),
    editable: ['D2:F5'],
    task: 'Isi Akhir (D2:D5) = 40% tugas + 60% UAS dibulatkan ke bilangan bulat. Isi Status (E2:E5): "Lulus" bila akhir ≥ 70, selain itu "Remedial". Isi Beasiswa (F2:F5): "Ya" bila akhir ≥ 85 DAN UAS ≥ 80, selain itu "Tidak".',
    hints: ['Akhir: =ROUND(B2*0.4+C2*0.6,0).', 'Status memakai IF atas kolom Akhir.', 'Beasiswa =IF(AND(D2>=85,C2>=80),"Ya","Tidak")'],
    explanation:
      'Akhir: Ani 76 (Lulus, Tidak), Beni 90 (Lulus, Ya), Citra 57 (Remedial, Tidak), Dedi 83 (Lulus, Tidak karena akhir belum 85).',
    lessonSlug: 'proyek-penilaian-siswa',
    validation: {
      targets: [
        ...[2, 3, 4, 5].map((r) => ({ cell: `D${r}`, solution: `=ROUND(B${r}*0.4+C${r}*0.6,0)`, requireFunction: 'ROUND' })),
        ...[2, 3, 4, 5].map((r) => ({ cell: `E${r}`, solution: `=IF(D${r}>=70,"Lulus","Remedial")`, requireFunction: 'IF' })),
        ...[2, 3, 4, 5].map((r) => ({ cell: `F${r}`, solution: `=IF(AND(D${r}>=85,C${r}>=80),"Ya","Tidak")`, requireFunction: 'AND' })),
      ],
      variants: [
        { B2: '100', C2: '100', C5: '90' },
        { B4: '90', C4: '95', C3: '79' },
      ],
    },
  },
  {
    slug: 'proyek-laporan-penjualan',
    title: 'Proyek: laporan penjualan',
    description: 'Ringkasan dengan fungsi bersyarat.',
    topic: 'fungsi-bersyarat',
    difficulty: 'sulit',
    rows: 17,
    cols: 5,
    cells: g([
      ['Kategori', 'Kota', 'Penjualan', 'Status'],
      ['Makanan', 'Jakarta', 300000, 'Lunas'],
      ['Minuman', 'Bandung', 120000, 'Belum'],
      ['Makanan', 'Bandung', 80000, 'Lunas'],
      ['Minuman', 'Jakarta', 150000, 'Lunas'],
      ['Makanan', 'Jakarta', 90000, 'Belum'],
      ['Snack', 'Surabaya', 60000, 'Lunas'],
      ['Makanan', 'Jakarta', 70000, 'Lunas'],
      ['Snack', 'Jakarta', 130000, 'Belum'],
      ['Minuman', 'Surabaya', 85000, 'Lunas'],
      [''],
      ['Total semua penjualan'],
      ['Total kategori Makanan'],
      ['Transaksi di Jakarta'],
      ['Makanan, Jakarta, Lunas'],
      ['Transaksi belum lunas'],
    ]),
    editable: ['B12:B16'],
    task: 'Isi B12 total semua penjualan (SUM), B13 total kategori Makanan (SUMIF), B14 jumlah transaksi di Jakarta (COUNTIF), B15 total penjualan Makanan di Jakarta yang Lunas (SUMIFS), dan B16 jumlah transaksi berstatus Belum (COUNTIF).',
    hints: [
      'Gunakan rentang C2:C10 untuk penjualan, A2:A10 kategori, B2:B10 kota, D2:D10 status.',
      'B15 butuh tiga syarat, jadi SUMIFS dengan rentang jumlah di depan.',
      '=SUMIFS(C2:C10,A2:A10,"Makanan",B2:B10,"Jakarta",D2:D10,"Lunas")',
    ],
    explanation:
      'Total 1.085.000; Makanan 540.000; Jakarta 5 transaksi; Makanan-Jakarta-Lunas 370.000 (300.000 + 70.000); 3 transaksi Belum.',
    lessonSlug: 'proyek-laporan-penjualan',
    validation: {
      targets: [
        { cell: 'B12', solution: '=SUM(C2:C10)', requireFunction: 'SUM' },
        { cell: 'B13', solution: '=SUMIF(A2:A10,"Makanan",C2:C10)', requireFunction: 'SUMIF' },
        { cell: 'B14', solution: '=COUNTIF(B2:B10,"Jakarta")', requireFunction: 'COUNTIF' },
        { cell: 'B15', solution: '=SUMIFS(C2:C10,A2:A10,"Makanan",B2:B10,"Jakarta",D2:D10,"Lunas")', requireFunction: 'SUMIFS' },
        { cell: 'B16', solution: '=COUNTIF(D2:D10,"Belum")', requireFunction: 'COUNTIF' },
      ],
      variants: [
        { C2: '100000', D3: 'Lunas' },
        { A4: 'Makanan', B5: 'Jakarta', D6: 'Lunas', D4: 'Belum' },
      ],
    },
  },
  {
    slug: 'proyek-katalog-harga',
    title: 'Proyek: formulir pesanan dari katalog',
    description: 'Pencarian, total, dan penanganan kode salah.',
    topic: 'fungsi-pencarian',
    difficulty: 'sulit',
    rows: 9,
    cols: 10,
    cells: {
      ...place([['Kode', 'Jumlah', 'Nama', 'Harga', 'Total'], ['GLA', 10], ['BRS', 2], ['XXX', 3], ['KPI', 6], ['Total pesanan']], 0),
      ...place(PRICE_TABLE, 6),
    },
    editable: ['C2:E5', 'E6'],
    task: 'Isi Nama (C2:C5) dan Harga (D2:D5) dari katalog G1:I6 berdasarkan Kode memakai fungsi pencarian pilihanmu. Bila kode tidak ada (XXX), Nama menjadi "Tidak ditemukan" dan Harga 0. Isi Total tiap baris (harga × jumlah) di E2:E5 dan Total pesanan di E6.',
    hints: [
      'Pilih salah satu: VLOOKUP, XLOOKUP, atau INDEX-MATCH.',
      'Tangani kode yang tidak ada dengan IFERROR (atau argumen jika_tidak_ada di XLOOKUP).',
      'C2 =IFERROR(VLOOKUP(A2,$G$2:$I$6,2,FALSE),"Tidak ditemukan"), D2 =IFERROR(VLOOKUP(A2,$G$2:$I$6,3,FALSE),0), E2 =B2*D2, E6 =SUM(E2:E5)',
    ],
    explanation:
      'GLA: Gula 16.000 × 10 = 160.000. BRS: Beras 68.000 × 2 = 136.000. XXX tidak ada: "Tidak ditemukan", 0, total 0. KPI: Kopi 22.000 × 6 = 132.000. Total pesanan 428.000.',
    lessonSlug: 'proyek-katalog-harga',
    validation: {
      targets: [
        ...[2, 3, 4, 5].map((r) => ({ cell: `C${r}`, solution: `=IFERROR(VLOOKUP(A${r},$G$2:$I$6,2,FALSE),"Tidak ditemukan")` })),
        ...[2, 3, 4, 5].map((r) => ({ cell: `D${r}`, solution: `=IFERROR(VLOOKUP(A${r},$G$2:$I$6,3,FALSE),0)` })),
        ...[2, 3, 4, 5].map((r) => ({ cell: `E${r}`, solution: `=B${r}*D${r}` })),
        { cell: 'E6', solution: '=SUM(E2:E5)', requireFunction: 'SUM' },
      ],
      variants: [
        { A4: 'TLR', I2: '70000' },
        { A2: 'ZZZ', B3: '5', H5: 'Minyak Goreng' },
      ],
    },
  },
  {
    slug: 'proyek-data-pelanggan',
    title: 'Proyek: merapikan data pelanggan',
    description: 'Nama rapi, kode seragam, dan tahun daftar.',
    topic: 'teks-tanggal',
    difficulty: 'sulit',
    rows: 7,
    cols: 7,
    cells: g([
      ['Nama mentah', 'Kode mentah', 'Tanggal daftar', 'Nama rapi', 'Kode rapi', 'Tahun daftar'],
      ['  budi   SANTOSO ', ' cst-0012 ', '=DATE(2024,5,12)'],
      ['SITI aminah', 'CST-0045', '=DATE(2025,11,3)'],
      [' dewi  lestari', 'cst-0107 ', '=DATE(2023,1,20)'],
    ]),
    editable: ['D2:F4'],
    task: 'Isi Nama rapi (D2:D4) dengan PROPER+TRIM, Kode rapi (E2:E4) dengan huruf besar tanpa spasi tambahan (UPPER+TRIM), dan Tahun daftar (F2:F4) dengan YEAR dari tanggal daftar.',
    hints: [
      'Nama: PROPER(TRIM(...)). Kode: UPPER(TRIM(...)).',
      'Tahun diambil dengan YEAR dari kolom C.',
      'D2 =PROPER(TRIM(A2)), E2 =UPPER(TRIM(B2)), F2 =YEAR(C2)',
    ],
    explanation:
      '"  budi   SANTOSO " menjadi "Budi Santoso", " cst-0012 " menjadi "CST-0012", dan 12 Mei 2024 menghasilkan tahun 2024. Hasil serupa berlaku untuk dua baris lainnya.',
    lessonSlug: 'proyek-data-pelanggan',
    validation: {
      targets: [
        ...[2, 3, 4].map((r) => ({ cell: `D${r}`, solution: `=PROPER(TRIM(A${r}))`, requireFunction: 'PROPER', exactText: true })),
        ...[2, 3, 4].map((r) => ({ cell: `E${r}`, solution: `=UPPER(TRIM(B${r}))`, requireFunction: 'UPPER', exactText: true })),
        ...[2, 3, 4].map((r) => ({ cell: `F${r}`, solution: `=YEAR(C${r})`, requireFunction: 'YEAR' })),
      ],
      variants: [
        { A2: ' ANI  wulan', B3: ' xyz-1 ', C4: '=DATE(2030,9,9)' },
        { A4: 'TONO', B2: 'abc-9', C2: '=DATE(2019,2,2)' },
      ],
    },
  },
  {
    slug: 'proyek-dashboard-ringkas',
    title: 'Proyek: dashboard stok ringkas',
    description: 'Aturan restok dan ringkasan per kategori.',
    topic: 'rapi-dan-aman',
    difficulty: 'sulit',
    rows: 9,
    cols: 10,
    cells: {
      ...place(
        [
          ['Barang', 'Kategori', 'Stok', 'Minimum', 'Terjual', 'Restok?'],
          ['Beras', 'Makanan', 8, 10, 120],
          ['Gula', 'Makanan', 30, 20, 80],
          ['Teh', 'Minuman', 5, 10, 60],
          ['Kopi', 'Minuman', 14, 12, 95],
          ['Mie', 'Makanan', 3, 15, 200],
        ],
        0,
      ),
      ...place([['Kategori', 'Terjual'], ['Makanan'], ['Minuman']], 7),
      H5: 'Perlu restok',
    },
    editable: ['F2:F6', 'I2:I3', 'I5'],
    task: 'Isi Restok? (F2:F6) dengan aturan TRUE bila stok kurang dari minimum. Isi I2:I3 dengan jumlah Terjual per kategori (SUMIF; rujuk nama kategori di H2:H3 dan kunci rentang dengan $). Isi I5 dengan banyaknya barang yang perlu restok (COUNTIF atas F2:F6).',
    hints: ['Aturan restok: stok < minimum.', 'SUMIF($B$2:$B$6, H2, $E$2:$E$6) untuk ringkasan kategori.', 'I5 =COUNTIF(F2:F6,TRUE)'],
    explanation: 'Restok: Beras (8<10), Teh (5<10), Mie (3<15) = 3 barang. Terjual Makanan 120+80+200 = 400 dan Minuman 60+95 = 155.',
    lessonSlug: 'proyek-dashboard-ringkas',
    validation: {
      targets: [
        ...[2, 3, 4, 5, 6].map((r) => ({ cell: `F${r}`, solution: `=C${r}<D${r}` })),
        { cell: 'I2', solution: '=SUMIF($B$2:$B$6,H2,$E$2:$E$6)', requireFunction: 'SUMIF' },
        { cell: 'I3', solution: '=SUMIF($B$2:$B$6,H3,$E$2:$E$6)', requireFunction: 'SUMIF' },
        { cell: 'I5', solution: '=COUNTIF(F2:F6,TRUE)', requireFunction: 'COUNTIF' },
      ],
      variants: [
        { C2: '50', B3: 'Minuman' },
        { D4: '2', E6: '10', C5: '1' },
      ],
    },
  },
];

const base = 24; // jumlah latihan pada exercises.ts
export const moreExercises: ExerciseDef[] = specs.map((s, i) => ({
  ...s,
  points: POINTS[s.difficulty],
  sortOrder: base + i + 1,
}));
